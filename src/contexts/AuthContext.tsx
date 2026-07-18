'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearAuthCache, getOptimizedSession, getOptimizedUserRole } from '@/lib/optimizedAuth';
import { clearPermissionsCache } from '@/hooks/useUserPermissions';

const DEBUG_ENABLED = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

type UserWithRole = User & {
  role?: 'admin' | 'employee';
  full_name?: string;
  designation?: string;
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

  const fetchUserRole = getOptimizedUserRole;

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        let { session: currentSession, error: sessionError } = await getOptimizedSession();

        if (!currentSession && !sessionError) {
          try {
            const response = await fetch('/api/auth/session', {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            });

            if (response.ok) {
              const data = await response.json();
              if (data.authenticated && data.user) {
                const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
                if (verifiedUser && !userError) {
                  const { data: { session: refreshedSession } } = await supabase.auth.getSession();
                  currentSession = refreshedSession;
                }
              }
            }
          } catch (error) {
            debugLog('Error checking server session:', error);
          }
        }

        setSession(currentSession);

        if (!currentSession?.user) {
          try {
            const response = await fetch('/api/auth/session');
            if (response.ok) {
              const data = await response.json();
              if (data.authenticated && data.user) {
                setUser({
                  id: data.user.id,
                  email: data.user.email,
                  role: data.user.user_metadata?.role || 'employee',
                  full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
                  designation: data.user.user_metadata?.designation || '',
                } as UserWithRole);
                setIsAdmin((data.user.user_metadata?.role || 'employee') === 'admin');
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            debugLog('Could not get server session data:', error);
          }

          setUser(null);
          setIsAdmin(false);
          return;
        }

        const userData = await fetchUserRole(currentSession.user.id);

        if (userData) {
          const userWithRole = {
            ...currentSession.user,
            role: (userData as any).role as 'admin' | 'employee',
            full_name: (userData as any).full_name,
            designation: (userData as any).designation,
          };

          setUser(userWithRole);
          setIsAdmin(userWithRole.role === 'admin');
        } else {
          setUser({
            ...currentSession.user,
            role: 'employee',
            full_name: currentSession.user.email?.split('@')[0] || 'User',
            designation: '',
          });
          setIsAdmin(false);
        }
      } catch (error) {
        debugLog('Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setIsAdmin(false);

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sb:apple-interior-manager:auth-token');
            sessionStorage.clear();
          } catch (clearError) {
            debugLog('Error clearing storage after auth error:', clearError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        try {
          const { data: { user: verifiedUser } } = await supabase.auth.getUser();
          
          if (verifiedUser) {
            try {
              const userData = await fetchUserRole(verifiedUser.id);

              if (userData) {
                const userWithRole = {
                  ...verifiedUser,
                  role: (userData as any).role as 'admin' | 'employee',
                  full_name: (userData as any).full_name,
                  designation: (userData as any).designation,
                };

                setUser(userWithRole);
                setIsAdmin(userWithRole.role === 'admin');
              } else {
                setUser({
                  ...verifiedUser,
                  role: 'employee',
                  full_name: verifiedUser.email?.split('@')[0] || 'User',
                  designation: '',
                });
                setIsAdmin(false);
              }
            } catch (error) {
              debugLog('Error handling auth state change:', error);
              setUser({
                ...verifiedUser,
                role: 'employee',
                full_name: verifiedUser.email?.split('@')[0] || 'User',
                designation: '',
              });
              setIsAdmin(false);
            }
          } else {
            setUser(null);
            setIsAdmin(false);
          }

          setSession(session);
        } catch (error) {
          debugLog('Error in auth state change handler:', error);
          setSession(null);
          setUser(null);
          setIsAdmin(false);

          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('sb:apple-interior-manager:auth-token');
              sessionStorage.clear();
            } catch (clearError) {
              debugLog('Error clearing storage after auth state error:', clearError);
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
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

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
            await signOut();
            if (typeof window !== 'undefined') {
              window.location.replace('/login');
            }
          }
          return;
        }

        const data = await response.json();

        if (data.authenticated && data.user && data.user.id === user.id) {
          failedAttempts = 0;
        } else {
          failedAttempts++;
          if (failedAttempts >= 3) {
            await signOut();
            if (typeof window !== 'undefined') {
              window.location.replace('/login');
            }
          }
        }
      } catch (error) {
        debugLog('Background session check error:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkSession();
      }
    };

    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(checkSession, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      const sessionStorageRef = globalThis?.sessionStorage;
      const now = Date.now();
      const lastAttempt = sessionStorageRef?.getItem('lastLoginAttempt');
      const attemptCount = parseInt(sessionStorageRef?.getItem('loginAttemptCount') || '0', 10);

      if (lastAttempt && attemptCount >= 5 && now - parseInt(lastAttempt, 10) < 300000) {
        return {
          data: null,
          error: { message: 'Too many login attempts. Please try again later.' },
        };
      }

      sessionStorageRef?.setItem('lastLoginAttempt', now.toString());
      sessionStorageRef?.setItem('loginAttemptCount', (attemptCount + 1).toString());

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const errorMessage = error.message || 'Login failed. Please check your credentials and try again.';

        return {
          data: null,
          error: {
            message: errorMessage,
            code: error.code,
            status: error.status,
          },
        };
      }

      const currentSession = data.session;

      if (!currentSession) {
        return {
          data: null,
          error: { message: 'Authentication failed. No session established.' },
        };
      }

      sessionStorageRef?.setItem('loginAttemptCount', '0');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('visibilitychange'));
      }

      return {
        data,
        error: null,
      };
    } catch (error: any) {
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
          status: error?.status,
        },
      };
    }
  };

  const signOut = async () => {
    // Immediately clear state for instant UI feedback
    setUser(null);
    setSession(null);
    setIsAdmin(false);

    try {
      let tourCompleted: string | null = null;
      let pendingPush: string | null = null;
      let womensDayDismissed: string | null = null;

      if (typeof window !== 'undefined') {
        tourCompleted = localStorage.getItem('apple_admin_tour_completed');
        pendingPush = localStorage.getItem('pending_push_route');
        womensDayDismissed = localStorage.getItem('womens_day_2026_dismissed');

        localStorage.clear();

        if (tourCompleted) {
          localStorage.setItem('apple_admin_tour_completed', tourCompleted);
        }
        if (pendingPush) {
          localStorage.setItem('pending_push_route', pendingPush);
        }
        if (womensDayDismissed) {
          localStorage.setItem('womens_day_2026_dismissed', womensDayDismissed);
        }

        sessionStorage.clear();
      }

      clearPermissionsCache();
      clearAuthCache();

      // Cleanups execution helper
      const performCleanups = async () => {
        try {
          // 1. Delete onesignal subscription while still authenticated
          await fetch('/api/onesignal/subscribe', { method: 'DELETE' }).catch(() => {});
          // 2. Perform server auth cookies clear
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          // 3. supabase signOut
          await supabase.auth.signOut().catch(() => {});
        } catch (err) {
          if (DEBUG_ENABLED) {
            console.error('Error during signOut cleanups:', err);
          }
        }
      };

      // Race cleanups against a 600ms hard timeout to prevent hanging UI
      // ponytail: 600ms threshold ensures quick logout redirection even if service worker / networks freeze
      await Promise.race([
        performCleanups(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      // Attempt service worker unregister in background without blocking
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then(regs => regs.forEach(r => r.unregister().catch(() => {})))
          .catch(() => {});
        if (window.caches) {
          caches.keys()
            .then(names => names.forEach(name => caches.delete(name).catch(() => {})))
            .catch(() => {});
        }
      }
    } catch (error) {
      if (DEBUG_ENABLED) {
        console.error('Error during sign out:', error);
      }
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);

      // Force hard reload navigation to login screen to clear memory variables
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signOut,
        isAdmin,
        updateUserEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
