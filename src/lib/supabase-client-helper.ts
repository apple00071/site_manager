import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  // For Vercel deployment, we need to use the exact values from the environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Only validate in browser or non-production builds
  const isBrowser = typeof window !== 'undefined';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isBrowser || !isProduction) {
    // Debug log environment variables (will only show in browser or non-production)
    console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
    
    // Validate URL format in browser or non-production
    if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
      console.error('Invalid Supabase URL:', supabaseUrl);
      if (isBrowser) {
        console.error('Please check your environment variables.');
      } else {
        // In production build, we'll use a placeholder URL to allow the build to complete
        if (isProduction) {
          console.warn('Using placeholder Supabase URL for build process');
          supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
            auth: { persistSession: false },
            global: { headers: { 'x-application-name': 'apple-interior-manager' } },
          });
          return supabaseClient;
        }
        throw new Error('Invalid Supabase URL. Must start with http:// or https://');
      }
    }
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
