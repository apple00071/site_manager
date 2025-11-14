import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase configuration with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uswdtcmemgfqlkzmfkxs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzc4NTgsImV4cCI6MjA3NjkxMzg1OH0.KcOcDTGYC7x8ZNSjNhpAE_y4LNq_j3Fz_c6t0Fi63wc';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNzg1OCwiZXhwIjoyMDc2OTEzODU4fQ.4k5EGYhCQ1V3WvxjIHCfoPdRnw7CBhWIiSmkhqRJNKA';

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to create authenticated server client
export async function createAuthenticatedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

// Secure helper function to get current authenticated user
export async function getCurrentUser() {
  try {
    const supabase = await createAuthenticatedClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('User authentication error:', error);
      return { user: null, error: error?.message || 'User not authenticated' };
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
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
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  serviceKey: supabaseServiceKey
};
