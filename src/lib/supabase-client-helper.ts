import { createClient } from '@supabase/supabase-js';

// Get environment variables (no hard-coded keys)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isDev = process.env.NODE_ENV !== 'production';

const missingEnvMessage =
  'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

if (!supabaseUrl || !supabaseAnonKey) {
  if (isDev) {
    // In development, warn but do not crash the entire app
    console.warn(missingEnvMessage);
  } else {
    // In production, fail fast
    throw new Error(missingEnvMessage);
  }
} else {
  console.log('🔧 Supabase configuration ready');
}

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

// Create and export the Supabase client with enhanced error handling.
// In development without env vars, we export a "dummy" client that logs errors
// instead of throwing at module evaluation time. This lets the app boot for UI work.
let supabaseInstance: any;

if (!supabaseUrl || !supabaseAnonKey) {
  if (isDev) {
    const errorFactory = () => new Error(missingEnvMessage);

    supabaseInstance = {
      auth: {
        async getSession() {
          const error = errorFactory();
          console.warn(error.message);
          return { data: { session: null }, error };
        },
        async getUser() {
          const error = errorFactory();
          console.warn(error.message);
          return { data: { user: null }, error };
        },
        async signInWithPassword() {
          const error = errorFactory();
          console.warn(error.message);
          return { data: null, error };
        },
        async signOut() {
          const error = errorFactory();
          console.warn(error.message);
          return { error };
        },
        onAuthStateChange(callback: any) {
          console.warn(missingEnvMessage);
          // Return a mock subscription that does nothing
          return {
            data: {
              subscription: {
                unsubscribe: () => { },
              },
            },
          };
        },
      },
      from() {
        const error = errorFactory();
        console.warn(error.message);
        throw error;
      },
    };
  } else {
    // In production this block is unreachable because we throw above,
    // but keep the branch for type completeness.
    throw new Error(missingEnvMessage);
  }
} else {
  supabaseInstance = createClient(supabaseUrl as string, supabaseAnonKey as string, {
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
}

export const supabase = supabaseInstance;
