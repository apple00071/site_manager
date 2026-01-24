'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { createContext, useContext, useEffect, useState } from 'react';

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

  async function signIn(email: string, password: string) {
    console.log('🔐 AdminAuthContext signIn called');
    console.log('Email:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('📋 Admin signIn response:', {
      hasData: !!data,
      hasUser: !!data?.user,
      hasError: !!error,
      errorMessage: error?.message
    });

    if (error) {
      console.error('❌ Admin login failed:', error);
      throw error;
    }

    if (data.user) {
      console.log('👤 Admin login successful, checking role from metadata...');
      // Check if user is admin using auth metadata
      const userRole = data.user.user_metadata?.role || 'employee';

      console.log('📋 Admin role check from metadata:', {
        role: userRole,
        isAdmin: userRole === 'admin'
      });

      if (userRole !== 'admin') {
        console.error('❌ Access denied - not admin:', userRole);
        throw new Error('Access denied. Admin privileges required.');
      }

      console.log('✅ Admin authentication successful');
      // Set user and session
      setUser(data.user);
      setSession(data.session);
      setIsAdmin(true);
    }
  };

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    router.push('/admin/login');
  };

  const contextValue: AdminAuthContextType = {
    user,
    session,
    isLoading,
    isAdmin,
    signIn,
    signOut,
  };

  useEffect(() => {
    // Only run on client-side
    if (!isBrowser) return;

    // Set up session listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(true);

        if (session?.user) {
          try {
            // Skip database query and check admin status from auth metadata
            console.log('🔍 Checking admin status from auth metadata...');
            const userRole = session.user.user_metadata?.role || 'employee';
            const isAdminUser = userRole === 'admin';

            console.log('📋 Admin check result:', {
              role: userRole,
              isAdmin: isAdminUser
            });

            setIsAdmin(isAdminUser);

            // If on login page and user is admin, redirect to dashboard
            if (pathname === '/admin/login') {
              console.log('🔄 Redirecting admin to dashboard');
              router.push('/admin/dashboard');
            }
          } catch (error) {
            console.error('💥 Error checking admin status:', error);
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

          // Check if user is admin using auth metadata
          console.log('🔍 Checking admin status from auth metadata...');
          const userRole = session.user.user_metadata?.role || 'employee';
          const isAdminUser = userRole === 'admin';

          console.log('📋 Admin check result:', {
            role: userRole,
            isAdmin: isAdminUser
          });

          setIsAdmin(isAdminUser);

          // If on login page and user is admin, redirect to dashboard
          if (pathname === '/admin/login') {
            console.log('🔄 Redirecting admin to dashboard');
            router.push('/admin/dashboard');
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
