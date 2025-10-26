'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

type AdminAuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Helper function to check if window is defined
const isBrowser = typeof window !== 'undefined';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    session,
    isLoading,
    isAdmin,
    signIn,
    signOut,
  }), [user, session, isLoading, isAdmin]);

  useEffect(() => {
    // Only run on client-side
    if (!isBrowser) return;

    // Set up session listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(true);

        if (session?.user) {
          try {
            // Check if user is admin
            const { data, error } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!error && data) {
              setIsAdmin(data.role === 'admin');
              
              // If on login page and user is admin, redirect to dashboard
              if (pathname === '/admin/login') {
                router.push('/admin/dashboard');
              }
            } else if (pathname.startsWith('/admin')) {
              // If missing profile or error and in admin area, sign out
              await supabase.auth.signOut();
              router.push('/admin/login');
            }
          } catch (error) {
            console.error('Error checking admin status:', error);
            if (pathname.startsWith('/admin')) {
              await supabase.auth.signOut();
              router.push('/admin/login');
            }
          }
        } else if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
          // Redirect to login if not authenticated and trying to access admin pages
          router.push('/admin/login');
        }

        setIsLoading(false);
      }
    );

    // Initial session check
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Check if user is admin
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && data) {
            setIsAdmin(data.role === 'admin');
            
            // If on login page and user is admin, redirect to dashboard
            if (pathname === '/admin/login') {
              router.push('/admin/dashboard');
            }
          } else if (pathname.startsWith('/admin')) {
            // If missing profile or error and in admin area, sign out
            await supabase.auth.signOut();
            router.push('/admin/login');
          }
        } else if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
          // Redirect to login if not authenticated and trying to access admin pages
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
          router.push('/admin/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, pathname]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      if (!userData) {
        throw new Error('User profile not found. Please contact an admin.');
      }

      if (userData.role !== 'admin') {
        throw new Error('Access denied. Admin privileges required.');
      }

      // Set user and session
      setUser(data.user);
      setSession(data.session);
      setIsAdmin(true);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    router.push('/admin/login');
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}