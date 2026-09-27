import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isDev = process.env.NODE_ENV !== 'production';

const missingServerEnvMessage =
  'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  if (isDev) {
    console.warn(missingServerEnvMessage);
  } else {
    throw new Error(missingServerEnvMessage);
  }
}

export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl as string, supabaseServiceKey as string)
  : (null as any);

export async function createAuthenticatedClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error(missingServerEnvMessage);
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl as string, supabaseAnonKey as string, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* ignored in Server Components */ }
      },
    },
  });
}

export interface AuthUser {
  id: string;
  email?: string;
  role: string | null;
  role_id: string | null;
  designation: string | null;
  full_name: string | null;
  username: string | null;
  /** All permission codes granted to this user's role (flat set for O(1) lookup). */
  permissionCodes: Set<string>;
  isAdmin: boolean;
  /** Pass-through from Supabase auth.User for backwards compat with existing call sites. */
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
}

/**
 * getAuthUser — single round-trip version.
 *
 * Previously: auth.getUser() + users query + 2×(users + role_permissions) = 5-6 DB hits.
 * Now: auth.getUser() + one joined users+role_permissions query = 2 DB hits total.
 *
 * The returned AuthUser.permissionCodes set lets checkPermission() work in-memory (0 extra DB hits).
 * ponytail: no request-level cache needed — Next.js API routes are short-lived; 2 hits is fine.
 */
export async function getAuthUser(): Promise<{
  user: AuthUser | null;
  /** @deprecated use user.role */ role: string | null;
  error: string | null;
}> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { user: null, role: null, error: authError?.message || 'Not authenticated' };
    }

    if (!supabaseAdmin) {
      return { user: null, role: null, error: 'Server misconfigured' };
    }

    // Single query: user row + their role's permissions in one join
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        role,
        role_id,
        designation,
        full_name,
        username,
        roles:role_id (
          name,
          role_permissions (
            permissions ( code )
          )
        )
      `)
      .eq('id', authUser.id)
      .single();

    const roleRow = (userData?.roles as any);
    const roleName: string = roleRow?.name || userData?.role || '';
    const isAdmin =
      userData?.role?.toLowerCase() === 'admin' ||
      roleName.toLowerCase() === 'admin';

    // Flatten permission codes into a Set for O(1) lookup
    const permissionCodes = new Set<string>();
    if (isAdmin) {
      permissionCodes.add('*'); // admins have everything
    } else {
      const rolePerms: any[] = roleRow?.role_permissions || [];
      for (const rp of rolePerms) {
        const code = rp?.permissions?.code;
        if (code) permissionCodes.add(code);
      }
    }

    const user: AuthUser = {
      id: authUser.id,
      email: authUser.email,
      role: userData?.role?.toLowerCase() || roleName.toLowerCase() || null,
      role_id: userData?.role_id || null,
      designation: userData?.designation || null,
      full_name: userData?.full_name || null,
      username: userData?.username || null,
      permissionCodes,
      isAdmin,
      user_metadata: authUser.user_metadata || {},
      app_metadata: authUser.app_metadata || {},
    };

    return { user, role: user.role, error: null };
  } catch (err: any) {
    console.error('Error in getAuthUser:', err);
    return { user: null, role: null, error: err.message };
  }
}
