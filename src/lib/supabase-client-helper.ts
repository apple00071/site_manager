import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

// Helper to get environment variables with better error handling
const getEnvVar = (key: string, isRequired = true): string => {
  // First try process.env (for server-side)
  const value = process.env[key] || '';
  
  // If not found and we're in the browser, try window._env_ (for client-side)
  if (!value && typeof window !== 'undefined' && (window as any)._env_) {
    return (window as any)._env_[key] || '';
  }
  
  if (!value && isRequired && typeof window === 'undefined') {
    console.error(`Missing required environment variable: ${key}`);
  }
  
  return value;
};

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Get environment variables
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // If we're in a browser environment, we can proceed with the values we have
  const isBrowser = typeof window !== 'undefined';
  
  // If we don't have required variables in a non-browser environment, throw an error
  if ((!supabaseUrl || !supabaseAnonKey) && !isBrowser) {
    console.error('Missing Supabase configuration. Please check your environment variables.');
    // Return a dummy client to prevent build errors
    return createClient('https://dummy.supabase.co', 'dummy-key', {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'apple-interior-manager' } },
    });
  }

  // Create the Supabase client with the actual URL and key
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'sb:apple-interior-manager:auth-token',
    },
    global: {
      headers: {
        'x-application-name': 'apple-interior-manager',
      },
    },
  });

  return supabaseClient;
};

export const supabase = getSupabaseClient();
