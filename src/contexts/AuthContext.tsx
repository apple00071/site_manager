'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { getOptimizedSession, getOptimizedUserRole, setupSmartTokenRefresh, clearAuthCache } from '@/lib/optimizedAuth';

// Set to false to disable all debug logs
const DEBUG_ENABLED = false;

// Debug logger that only logs when enabled
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Cache for session and user data to prevent excessive API calls
let sessionCache: { session: Session | null; timestamp: number } | null = null;
let userRoleCache: Map<string, { role: string; full_name: string; timestamp: number }> = new Map();
const CACHE_DURATION = 60000; // 1 minute cache
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests
let lastRequestTime = 0;

type UserWithRole = User & {
  role?: 'admin' | 'employee';
  full_name?: string;
};

type AuthContextType = {
  user: UserWithRole | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: any | null;
    data: any | null;
  }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  updateUserEmail: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Use optimized user role fetching
  const fetchUserRole = getOptimizedUserRole;

  useEffect(() => {
    const initializeAuth = async () => {
      debugLog('🚀 Initializing optimized authentication...');

      try {
        setIsLoading(true);

        // Use optimized session fetching
        let { session: currentSession, user: currentUser, error: sessionError } = await getOptimizedSession();

        // Only check server-side if client-side session is missing but we might be authenticated
        if (!currentSession && !sessionError) {
          try {
            const response = await fetch('/api/auth/session', {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              }
            });
            if (response.ok) {
              const data = await response.json();
              debugLog('📋 Server session fallback check:', data);

              if (data.authenticated && data.user) {
                // Refresh client session if server has valid session
                await supabase.auth.refreshSession();
                const { data: { session: refreshedSession } } = await supabase.auth.getSession();
                currentSession = refreshedSession;
              }
            }
          } catch (error) {
            debugLog('⚠️ Error checking server session:', error);
          }
        }

        debugLog('📋 Initial session check:', {
          hasSession: !!currentSession,
          hasError: !!sessionError,
          sessionUser: currentSession?.user?.email,
          errorMessage: sessionError?.message
        });

        if (sessionError) {
          debugLog('❌ Session error detected, but continuing...');
          // Don't immediately fail - middleware handles authentication
        }

        debugLog('✅ Session retrieved:', currentSession ? 'Active' : 'None');
        setSession(currentSession);

        // If no session but middleware let us through, try to get user metadata from server
        if (!currentSession?.user) {
          debugLog('ℹ️ No client-side session found, but middleware authenticated us');

          // Try to get user from server-side session API
          try {
            const response = await fetch('/api/auth/session');
            if (response.ok) {
              const data = await response.json();
              if (data.authenticated && data.user) {
                // Create a basic user object from server data
                setUser({
                  id: data.user.id,
                  email: data.user.email,
                  role: data.user.user_metadata?.role || 'employee',
                  full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User'
                } as UserWithRole);
                setIsAdmin((data.user.user_metadata?.role || 'employee') === 'admin');
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            debugLog('⚠️ Could not get server session data:', error);
          }

          debugLog('ℹ️ No user session found');
          setUser(null);
          setIsAdmin(false);
          return;
        }

        debugLog('👤 User found, fetching role...');
        // Fetch user role using optimized function
        const userData = await fetchUserRole(currentSession.user.id);

        debugLog('📋 User role fetch result:', {
          hasData: !!userData,
          role: (userData as any)?.role,
          fullName: (userData as any)?.full_name
        });

        if (userData) {
          const userWithRole = {
            ...currentSession.user,
            role: (userData as any).role as 'admin' | 'employee',
            full_name: (userData as any).full_name
          };

          setUser(userWithRole);
          setIsAdmin(userWithRole.role === 'admin');
          debugLog('✅ User initialized:', {
            email: userWithRole.email,
            role: userWithRole.role,
            isAdmin: userWithRole.role === 'admin'
          });
        } else {
          // If we can't fetch the role, set default values
          if (DEBUG_ENABLED) console.warn('⚠️ Could not fetch user role, using default values');
          setUser({
            ...currentSession.user,
            role: 'employee',
            full_name: currentSession.user.email?.split('@')[0] || 'User'
          });
          setIsAdmin(false);
        }
      } catch (error) {
        debugLog('💥 Error initializing auth:', error);
        // Clear any corrupted state on error
        setSession(null);
        setUser(null);
        setIsAdmin(false);

        // Clear storage on error
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sb:apple-interior-manager:auth-token');
            sessionStorage.clear();
          } catch (clearError) {
            debugLog('⚠️ Error clearing storage after auth error:', clearError);
          }
        }
      } finally {
        debugLog('🏁 Authentication initialization completed');
        setIsLoading(false);
      }
    };
    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, newSession: Session | null) => {
        debugLog('🔄 Auth state changed:', event);
        debugLog('📋 New session:', {
          hasSession: !!newSession,
          sessionUser: newSession?.user?.email
        });

        try {
          if (newSession?.user) {
            debugLog('👤 User signed in, fetching role...');
            try {
              // Use optimized fetchUserRole function
              const userData = await fetchUserRole(newSession.user.id);

              if (userData) {
                const userWithRole = {
                  ...newSession.user,
                  role: (userData as any).role as 'admin' | 'employee',
                  full_name: (userData as any).full_name
                };

                setUser(userWithRole);
                setIsAdmin(userWithRole.role === 'admin');
                debugLog('✅ User updated on auth change:', {
                  email: userWithRole.email,
                  role: userWithRole.role
                });
              } else {
                // If we can't fetch the role, set default values
                setUser({
                  ...newSession.user,
                  role: 'employee',
                  full_name: newSession.user.email?.split('@')[0] || 'User'
                });
                setIsAdmin(false);
              }
            } catch (error) {
              debugLog('💥 Error handling auth state change:', error);
              setUser({
                ...newSession.user,
                role: 'employee',
                full_name: newSession.user.email?.split('@')[0] || 'User'
              });
              setIsAdmin(false);
            }
          } else {
            debugLog('🚪 User signed out');
            setUser(null);
            setIsAdmin(false);
          }

          setSession(newSession);
        } catch (error) {
          debugLog('💥 Error in auth state change handler:', error);
          // Clear state on any error
          setSession(null);
          setUser(null);
          setIsAdmin(false);

          // Clear storage on error
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('sb:apple-interior-manager:auth-token');
              sessionStorage.clear();
            } catch (clearError) {
              debugLog('⚠️ Error clearing storage after auth state error:', clearError);
            }
          }
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let failedAttempts = 0;
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });

        if (!response.ok) {
          failedAttempts++;
          if (failedAttempts >= 3) {
            debugLog('🚫 Background session check failed repeatedly, logging out...');
            await signOut();
            if (typeof window !== 'undefined') {
              window.location.replace('/login');
            }
          }
          return;
        }

        const data = await response.json();

        if (data.authenticated && data.user && data.user.id === user.id) {
          failedAttempts = 0; // Reset on success
        } else {
          failedAttempts++;
          if (failedAttempts >= 3) {
            debugLog('🚫 Session mismatch or unauthenticated in background check, logging out...');
            await signOut();
            if (typeof window !== 'undefined') {
              window.location.replace('/login');
            }
          }
        }
      } catch (error) {
        debugLog('⚠️ Background session check error:', error);
        // Don't count network errors as failures for logout
      }
    };

    const intervalId = setInterval(checkSession, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    debugLog('🔐 AuthContext signIn called');
    debugLog('Email:', email);

    try {
      // Add rate limiting check
      const sessionStorage = globalThis?.sessionStorage;
      const now = Date.now();
      const lastAttempt = sessionStorage?.getItem('lastLoginAttempt');
      const attemptCount = parseInt(sessionStorage?.getItem('loginAttemptCount') || '0');

      debugLog('Rate limiting check:', { attemptCount, lastAttempt, now });

      if (lastAttempt && attemptCount >= 5 && now - parseInt(lastAttempt) < 300000) {
        debugLog('🚫 Rate limit exceeded');
        return {
          data: null,
          error: { message: 'Too many login attempts. Please try again later.' }
        };
      }

      // Update attempt tracking
      sessionStorage?.setItem('lastLoginAttempt', now.toString());
      sessionStorage?.setItem('loginAttemptCount', (attemptCount + 1).toString());

      debugLog('📡 Calling Supabase signInWithPassword...');
      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      debugLog('📋 Supabase response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        hasError: !!error,
        errorMessage: error?.message
      });

      if (error) {
        if (DEBUG_ENABLED) console.error('❌ Supabase login failed:', error);
        debugLog('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status
        });

        // Ensure we return a proper error object with a message
        const errorMessage = error.message || 'Login failed. Please check your credentials and try again.';

        return {
          data: null,
          error: {
            message: errorMessage,
            code: error.code,
            status: error.status
          }
        };
      }

      debugLog('✅ Supabase login successful');

      // Session is already in the data response, no need to fetch again
      const session = data.session;

      debugLog('📋 Post-login session check:', {
        hasSession: !!session,
        sessionUser: session?.user?.email
      });

      if (!session) {
        if (DEBUG_ENABLED) console.error('❌ No session after successful login');
        return {
          data: null,
          error: { message: 'Authentication failed. No session established.' }
        };
      }

      debugLog('✅ Session established, resetting rate limit');
      // Reset attempt count on successful login
      sessionStorage?.setItem('loginAttemptCount', '0');

      // Force a page reload to ensure all auth state is properly set
      // This helps with Next.js static optimization and ensures middleware runs
      if (typeof window !== 'undefined') {
        debugLog('🔄 Triggering visibility change event');
        window.dispatchEvent(new Event('visibilitychange'));
      }

      debugLog('✅ SignIn completed successfully');
      return {
        data,
        error: null
      };
    } catch (error: any) {
      if (DEBUG_ENABLED) console.error('💥 AuthContext signIn error:', error);
      debugLog('Error details:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        stack: error?.stack
      });

      // Provide a meaningful error message
      let errorMessage = 'Authentication failed. Please try again.';

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code === 'invalid_credentials') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error?.status === 400) {
        errorMessage = 'Invalid login credentials. Please check your email and password.';
      } else if (error?.status === 429) {
        errorMessage = 'Too many login attempts. Please wait before trying again.';
      }

      return {
        data: null,
        error: {
          message: errorMessage,
          code: error?.code,
          status: error?.status
        }
      };
    }
  };

  const signOut = async () => {
    try {
      // Clear any local storage/session data if needed
      if (typeof window !== 'undefined') {
        // Save persistent values we don't want to clear
        const tourCompleted = localStorage.getItem('apple_admin_tour_completed');
        const pendingPush = localStorage.getItem('pending_push_route');
        
        localStorage.clear();
        
        // Restore persistent values
        if (tourCompleted) {
          localStorage.setItem('apple_admin_tour_completed', tourCompleted);
        }
        if (pendingPush) {
          localStorage.setItem('pending_push_route', pendingPush);
        }
        
        sessionStorage.clear();
      }

      // Sign out on server (clears httpOnly cookies) first
      try {
        await Promise.all([
          fetch('/api/auth/logout', { method: 'POST' }),
          fetch('/api/onesignal/subscribe', { method: 'DELETE' }).catch(() => { })
        ]);
      } catch (_) {
        // ignore
      }

      // Sign out from Supabase as a fallback
      const { error } = await supabase.auth.signOut();

      if (error) {
        if (DEBUG_ENABLED) console.error('Error signing out:', error);
        // Don't throw error, continue with logout process
      }

      // Reset all auth state
      setUser(null);
      setSession(null);
      setIsAdmin(false);

      // Best-effort: unregister service workers and clear caches to avoid SW intercept issues
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          if (window.caches) {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
          }
        } catch (_) { }
      }

    } catch (error) {
      if (DEBUG_ENABLED) console.error('Error during sign out:', error);
      // Reset auth state even if there's an error
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    }
  };

  const updateUserEmail = async (email: string) => {
    const response = await fetch('/api/auth/update-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to update email');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    isAdmin,
    updateUserEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
