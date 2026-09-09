import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase configuration - require environment variables (no hard-coded keys)
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

// Admin client for server-side operations
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl as string, supabaseServiceKey as string)
  : (null as any);

// Helper function to create authenticated server client
export async function createAuthenticatedClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(missingServerEnvMessage);
    console.warn(error.message);
    throw error;
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl as string,
    supabaseAnonKey as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignored when called from Server Component
          }
        },
      },
    }
  );
}

// Lightweight helper to get the authenticated user without hitting the users table
export async function getAuthUser() {
  try {
    const supabase = await createAuthenticatedClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('User authentication error:', error);
      return { user: null, supabase: null, error: error?.message || 'User not authenticated', role: null };
    }

    // Get user role from database
    let role: string | null = null;
    if (supabaseAdmin) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('role, role_id, roles(name)')
        .eq('id', user.id)
        .single();
      const rawRole = userData?.role || (userData?.roles as any)?.name || null;
      role = rawRole ? rawRole.toLowerCase() : null;
    }

    return { user, supabase, error: null, role };
  } catch (error: any) {
    console.error('Error getting auth user:', error);
    return { user: null, supabase: null, error: error.message, role: null };
  }
}

