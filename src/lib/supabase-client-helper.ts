import { createClient } from '@supabase/supabase-js';

// Get environment variables (no hard-coded keys)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

console.log('🔧 Supabase configuration ready');

// Custom storage implementation that handles corrupted cookies gracefully
const customStorage = {
  getItem: (key: string) => {
    // Most defensive browser environment check
    const isBrowser = typeof window !== 'undefined' ||
                     (typeof globalThis !== 'undefined' && globalThis.localStorage);

    if (!isBrowser) {
      return null;
    }

    try {
      return (globalThis.localStorage || localStorage).getItem(key);
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    // Most defensive browser environment check
    const isBrowser = typeof window !== 'undefined' ||
                     (typeof globalThis !== 'undefined' && globalThis.localStorage);

    if (!isBrowser) {
      return;
    }

    try {
      (globalThis.localStorage || localStorage).setItem(key, value);
    } catch (error) {
      console.warn('Error writing to localStorage:', error);
    }
  },
  removeItem: (key: string) => {
    // Most defensive browser environment check
    const isBrowser = typeof window !== 'undefined' ||
                     (typeof globalThis !== 'undefined' && globalThis.localStorage);

    if (!isBrowser) {
      return;
    }

    try {
      (globalThis.localStorage || localStorage).removeItem(key);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  },
};

// Create and export the Supabase client with enhanced error handling
export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'sb:apple-interior-manager:auth-token',
    // Add error handling for auth state changes
    flowType: 'pkce',
    storage: customStorage,
  },
  global: {
    headers: {
      'x-application-name': 'apple-interior-manager',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
