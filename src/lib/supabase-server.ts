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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete(name);
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
        .select('role')
        .eq('id', user.id)
        .single();
      role = userData?.role || null;
    }

    return { user, supabase, error: null, role };
  } catch (error: any) {
    console.error('Error getting auth user:', error);
    return { user: null, supabase: null, error: error.message, role: null };
  }
}

// Secure helper function to get current authenticated user with full profile from the users table
export async function getCurrentUser() {
  try {
    const { user: authUser, error: authError } = await getAuthUser();

    if (authError || !authUser) {
      return { user: null, error: authError || 'User not authenticated' };
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return { user: null, error: userError?.message || 'User data not found' };
    }

    return { user: userData, error: null };
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return { user: null, error: error.message };
  }
}

// Export configuration for other files
export const supabaseConfig = {
  url: supabaseUrl as string,
  anonKey: supabaseAnonKey as string,
  serviceKey: supabaseServiceKey as string
};
