'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

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

  const fetchUserRole = async (userId: string) => {
    // First, let's verify the user ID is valid
    if (!userId) {
      console.error('No user ID provided to fetchUserRole');
      return null;
    }

    console.log('===== fetchUserRole started =====');
    console.log('User ID:', userId);

    try {
      // Skip database query for now and go directly to auth metadata
      // This prevents hanging on missing database tables
      console.log('⚡ Skipping database query, using auth metadata directly...');

      // Get user from auth metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      console.log('Auth user check:', {
        hasUser: !!user,
        hasError: !!userError,
        userEmail: user?.email
      });

      if (userError) {
        console.error('❌ Error getting user from auth:', userError);
        // Return default role even if there's an error
        return {
          role: 'employee',
          full_name: 'User'
        };
      }

      if (user) {
        const userRole = user.user_metadata?.role || 'employee';
        console.log('✅ User role from auth metadata:', {
          id: user.id,
          email: user.email,
          role: userRole,
          metadata: user.user_metadata
        });

        return {
          role: userRole,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        };
      }

      // Return default role if user not found
      console.warn(`⚠️ User with ID ${userId} not found`);
      return {
        role: 'employee',
        full_name: 'User'
      };

    } catch (error) {
      // Handle any unexpected errors
      const errorInfo = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : {
        name: 'UnknownError',
        message: String(error)
      };

      console.error('💥 Unexpected error in fetchUserRole:', errorInfo);

      // Return default values in case of error
      return {
        role: 'employee',
        full_name: 'User'
      };
    } finally {
      console.log('===== fetchUserRole completed =====\n');
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication...');

      try {
        setIsLoading(true);

        console.log('📡 Getting current session...');
        // First, try to get the current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        console.log('📋 Initial session check:', {
          hasSession: !!currentSession,
          hasError: !!sessionError,
          sessionUser: currentSession?.user?.email,
          errorMessage: sessionError?.message
        });

        if (sessionError) {
          console.error('❌ Error getting session:', sessionError);
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          return;
        }

        console.log('✅ Session retrieved:', currentSession ? 'Active' : 'None');
        setSession(currentSession);

        if (!currentSession?.user) {
          console.log('ℹ️ No user session found');
          setUser(null);
          setIsAdmin(false);
          return;
        }

        console.log('👤 User found, fetching role...');
        // Fetch user role
        const userData = await fetchUserRole(currentSession.user.id);

        console.log('📋 User role fetch result:', {
          hasData: !!userData,
          role: userData?.role,
          fullName: userData?.full_name
        });

        if (userData) {
          const userWithRole = {
            ...currentSession.user,
            role: userData.role as 'admin' | 'employee',
            full_name: userData.full_name
          };

          setUser(userWithRole);
          setIsAdmin(userWithRole.role === 'admin');
          console.log('✅ User initialized:', {
            email: userWithRole.email,
            role: userWithRole.role,
            isAdmin: userWithRole.role === 'admin'
          });
        } else {
          // If we can't fetch the role, set default values
          console.warn('⚠️ Could not fetch user role, using default values');
          setUser({
            ...currentSession.user,
            role: 'employee',
            full_name: currentSession.user.email?.split('@')[0] || 'User'
          });
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('💥 Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      } finally {
        console.log('🏁 Authentication initialization completed');
        setIsLoading(false);
      }
    };
    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔄 Auth state changed:', event);
        console.log('📋 New session:', {
          hasSession: !!newSession,
          sessionUser: newSession?.user?.email
        });

        if (newSession?.user) {
          console.log('👤 User signed in, fetching role...');
          try {
            const userData = await fetchUserRole(newSession.user.id);

            if (userData) {
              const userWithRole = {
                ...newSession.user,
                role: userData.role as 'admin' | 'employee',
                full_name: userData.full_name
              };

              setUser(userWithRole);
              setIsAdmin(userWithRole.role === 'admin');
              console.log('✅ User updated on auth change:', {
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
            console.error('💥 Error handling auth state change:', error);
            setUser({
              ...newSession.user,
              role: 'employee',
              full_name: newSession.user.email?.split('@')[0] || 'User'
            });
            setIsAdmin(false);
          }
        } else {
          console.log('🚪 User signed out');
          setUser(null);
          setIsAdmin(false);
        }

        setSession(newSession);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 AuthContext signIn called');
    console.log('Email:', email);

    try {
      // Add rate limiting check
      const sessionStorage = globalThis?.sessionStorage;
      const now = Date.now();
      const lastAttempt = sessionStorage?.getItem('lastLoginAttempt');
      const attemptCount = parseInt(sessionStorage?.getItem('loginAttemptCount') || '0');

      console.log('Rate limiting check:', { attemptCount, lastAttempt, now });

      if (lastAttempt && attemptCount >= 5 && now - parseInt(lastAttempt) < 300000) {
        console.log('🚫 Rate limit exceeded');
        return {
          data: null,
          error: { message: 'Too many login attempts. Please try again later.' }
        };
      }

      // Update attempt tracking
      sessionStorage?.setItem('lastLoginAttempt', now.toString());
      sessionStorage?.setItem('loginAttemptCount', (attemptCount + 1).toString());

      console.log('📡 Calling Supabase signInWithPassword...');
      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📋 Supabase response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        hasError: !!error,
        errorMessage: error?.message
      });

      if (error) {
        console.error('❌ Supabase login failed:', error);
        console.log('Error details:', {
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

      console.log('✅ Supabase login successful, getting session...');
      // Get the session after successful sign in
      const { data: { session } } = await supabase.auth.getSession();

      console.log('📋 Post-login session check:', {
        hasSession: !!session,
        sessionUser: session?.user?.email
      });

      if (!session) {
        console.error('❌ No session after successful login');
        return {
          data: null,
          error: { message: 'Authentication failed. No session established.' }
        };
      }

      console.log('✅ Session established, resetting rate limit');
      // Reset attempt count on successful login
      sessionStorage?.setItem('loginAttemptCount', '0');

      // Force a page reload to ensure all auth state is properly set
      // This helps with Next.js static optimization and ensures middleware runs
      if (typeof window !== 'undefined') {
        console.log('🔄 Triggering visibility change event');
        window.dispatchEvent(new Event('visibilitychange'));
      }

      console.log('✅ SignIn completed successfully');
      return {
        data: { ...data, session },
        error: null
      };
    } catch (error: any) {
      console.error('💥 AuthContext signIn error:', error);
      console.log('Error details:', {
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
      localStorage.clear();
      sessionStorage.clear();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }

      // Reset all auth state
      setUser(null);
      setSession(null);
      setIsAdmin(false);

      // Force a hard redirect to the login page
      window.location.href = '/login';

    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, still try to redirect to login
      window.location.href = '/login';
    }
  };

  const updateUserEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
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