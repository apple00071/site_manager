'use client';

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
      // First, try to get the user from the public.users table (our custom table)
      console.log('Fetching user from public.users table...');
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (publicUser) {
        console.log('Found user in public.users:', {
          id: publicUser.id,
          email: publicUser.email,
          role: publicUser.role,
          full_name: publicUser.full_name
        });
        
        // Update auth metadata to keep it in sync
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { 
              role: publicUser.role,
              full_name: publicUser.full_name
            }
          });
          
          if (updateError) {
            console.error('Error updating auth metadata:', updateError);
          }
        } catch (updateError) {
          console.error('Error updating user metadata:', updateError);
        }
        
        return {
          role: publicUser.role || 'employee',
          full_name: publicUser.full_name || publicUser.email?.split('@')[0] || 'User'
        };
      }
      
      if (publicError) {
        console.error('Error fetching from public.users:', {
          code: publicError.code,
          message: publicError.message,
          details: publicError.details
        });
      }
      
      // Fallback to auth metadata if user not found in public.users
      console.log('User not found in public.users, trying auth metadata...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user from auth:', userError);
        throw userError;
      }
      
      if (user) {
        const userRole = user.user_metadata?.role || 'employee';
        console.log('User role from auth metadata:', {
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
      
      // If we get here, the user wasn't found in either table
      console.warn(`User with ID ${userId} not found in any user table`);
      
      // Return default role (employee) if user not found
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
      
      console.error('Unexpected error in fetchUserRole:', errorInfo);
      
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
      try {
        setIsLoading(true);
        
        // First, try to get the current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          return;
        }
        
        console.log('Initial session:', currentSession);
        setSession(currentSession);
        
        if (!currentSession?.user) {
          console.log('No user session found');
          setUser(null);
          setIsAdmin(false);
          return;
        }
        
        // Fetch user role
        const userData = await fetchUserRole(currentSession.user.id);
        
        if (userData) {
          const userWithRole = {
            ...currentSession.user,
            role: userData.role as 'admin' | 'employee',
            full_name: userData.full_name
          };
          
          setUser(userWithRole);
          setIsAdmin(userWithRole.role === 'admin');
          console.log('User initialized:', { 
            email: userWithRole.email, 
            role: userWithRole.role,
            isAdmin: userWithRole.role === 'admin' 
          });
        } else {
          // If we can't fetch the role, set default values
          console.warn('Could not fetch user role, using default values');
          setUser({
            ...currentSession.user,
            role: 'employee',
            full_name: currentSession.user.email?.split('@')[0] || 'User'
          });
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);
        
        if (newSession?.user) {
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
              console.log('User updated on auth change:', { 
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
            console.error('Error handling auth state change:', error);
            setUser({
              ...newSession.user,
              role: 'employee',
              full_name: newSession.user.email?.split('@')[0] || 'User'
            });
            setIsAdmin(false);
          }
        } else {
          console.log('User signed out');
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
    try {
      // Add rate limiting check
      const sessionStorage = globalThis?.sessionStorage;
      const now = Date.now();
      const lastAttempt = sessionStorage?.getItem('lastLoginAttempt');
      const attemptCount = parseInt(sessionStorage?.getItem('loginAttemptCount') || '0');
      
      if (lastAttempt && attemptCount >= 5 && now - parseInt(lastAttempt) < 300000) {
        return { 
          data: null, 
          error: { message: 'Too many login attempts. Please try again later.' } 
        };
      }
      
      // Update attempt tracking
      sessionStorage?.setItem('lastLoginAttempt', now.toString());
      sessionStorage?.setItem('loginAttemptCount', (attemptCount + 1).toString());
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        // Reset attempt count on successful login
        sessionStorage?.setItem('loginAttemptCount', '0');
      }
      
      return { data, error };
    } catch (error: any) {
      console.error('Error signing in:', error);
      return { data: null, error: { message: 'Authentication failed. Please try again.' } };
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