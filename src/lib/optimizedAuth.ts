import { supabase } from './supabase';
import { userCache } from './cache';

const DEBUG_ENABLED = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

let sessionCache: {
  session: any;
  user: any;
  timestamp: number;
  ttl: number;
} | null = null;

const SESSION_CACHE_TTL = 10 * 60 * 1000;
const MIN_AUTH_INTERVAL = 5000;
let lastAuthCheck = 0;
let pendingAuthPromise: Promise<any> | null = null;

export async function getOptimizedSession() {
  const now = Date.now();

  if (sessionCache && now - sessionCache.timestamp < sessionCache.ttl) {
    debugLog('Using cached session');
    return {
      session: sessionCache.session,
      user: sessionCache.user,
      error: null,
    };
  }

  if (now - lastAuthCheck < MIN_AUTH_INTERVAL) {
    debugLog('Auth rate limited, using cache or pending promise');

    if (pendingAuthPromise) {
      return await pendingAuthPromise;
    }

    if (sessionCache) {
      return {
        session: sessionCache.session,
        user: sessionCache.user,
        error: null,
      };
    }
  }

  if (!pendingAuthPromise) {
    pendingAuthPromise = performAuthCheck();
  }

  try {
    return await pendingAuthPromise;
  } finally {
    pendingAuthPromise = null;
    lastAuthCheck = now;
  }
}

async function performAuthCheck() {
  try {
    debugLog('Performing secure auth check...');

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      const isMissingSession =
        error.message?.includes('Auth session missing') ||
        error.name === 'AuthSessionMissingError' ||
        (error as any).status === 400;

      if (!isMissingSession) {
        console.error('Auth error:', error);
      }

      sessionCache = null;
      return { session: null, user: null, error: isMissingSession ? null : error };
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (user && session) {
      sessionCache = {
        session,
        user,
        timestamp: Date.now(),
        ttl: SESSION_CACHE_TTL,
      };

      userCache.set(`user_${user.id}`, user, 15 * 60 * 1000);
    } else {
      sessionCache = null;
    }

    return { session, user, error: null };
  } catch (error) {
    console.error('Auth check failed:', error);
    return { session: null, user: null, error };
  }
}

export async function getOptimizedUserRole(userId: string) {
  if (!userId) {
    return null;
  }

  const cacheKey = `user_role_${userId}`;
  const cached = userCache.get(cacheKey);
  if (cached) {
    debugLog('Using cached user role');
    return cached;
  }

  try {
    const { session } = await getOptimizedSession();
    if (session?.user?.id === userId) {
      const role = session.user.user_metadata?.role || 'employee';
      const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
      const designation = session.user.user_metadata?.designation || '';

      const userData = { role, full_name: fullName, designation };
      userCache.set(cacheKey, userData, 15 * 60 * 1000);
      return userData;
    }

    debugLog('Fallback to user API call');
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { role: 'employee', full_name: 'User', designation: '' };
    }

    const role = user.user_metadata?.role || 'employee';
    const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const designation = user.user_metadata?.designation || '';

    const userData = { role, full_name: fullName, designation };
    userCache.set(cacheKey, userData, 15 * 60 * 1000);

    return userData;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return { role: 'employee', full_name: 'User', designation: '' };
  }
}

export function setupSmartTokenRefresh(): () => void {
  let refreshInterval: ReturnType<typeof setInterval>;

  const checkAndRefresh = async () => {
    try {
      const { session } = await getOptimizedSession();

      if (!session?.expires_at) {
        return;
      }

      const expiresAt = session.expires_at * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < 10 * 60 * 1000 && timeUntilExpiry > 0) {
        debugLog('Smart token refresh triggered');
        const { error } = await supabase.auth.refreshSession();

        if (!error) {
          sessionCache = null;
          debugLog('Token refreshed successfully');
        }
      }
    } catch (error) {
      console.error('Smart refresh error:', error);
    }
  };

  refreshInterval = setInterval(checkAndRefresh, 5 * 60 * 1000);
  void checkAndRefresh();

  return () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  };
}

export function clearAuthCache() {
  sessionCache = null;
  userCache.clear();
  lastAuthCheck = 0;
  pendingAuthPromise = null;
}

let authStateChangeQueue: Array<() => void> = [];
let authStateChangeTimeout: ReturnType<typeof setTimeout> | null = null;

export function batchAuthStateChange(callback: () => void) {
  authStateChangeQueue.push(callback);

  if (authStateChangeTimeout) {
    clearTimeout(authStateChangeTimeout);
  }

  authStateChangeTimeout = setTimeout(() => {
    const callbacks = [...authStateChangeQueue];
    authStateChangeQueue = [];
    authStateChangeTimeout = null;

    callbacks.forEach((cb) => {
      try {
        cb();
      } catch (error) {
        console.error('Auth state change callback error:', error);
      }
    });
  }, 100);
}
