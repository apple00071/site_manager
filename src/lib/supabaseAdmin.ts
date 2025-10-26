import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if we have the required environment variables
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key in environment variables');
  console.error('Available environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '[SET]' : '[MISSING]',
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? '[SET]' : '[MISSING]'
  });
}

// Helper function to get the admin client
const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseUrl || !serviceRoleKey) {
    // Return a mock client to prevent build errors
    return {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Database not available - missing environment variables' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Database not available - missing environment variables' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Database not available - missing environment variables' } }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Database not available - missing environment variables' } }),
      }),
    } as any;
  }

  // Create the real client if we have the required variables
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-application-name': 'apple-interior-manager-admin',
      },
    },
  });
};

export const supabaseAdmin = getSupabaseAdminClient();