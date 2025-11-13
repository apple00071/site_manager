import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallback for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uswdtcmemgfqlkzmfkxs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzc4NTgsImV4cCI6MjA3NjkxMzg1OH0.KcOcDTGYC7x8ZNSjNhpAE_y4LNq_j3Fz_c6t0Fi63wc';

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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
