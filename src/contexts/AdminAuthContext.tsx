'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Set up session listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(true);

        if (session?.user) {
          // Check if user is admin
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && data) {
            setIsAdmin(data.role === 'admin');
          } else {
            // If missing profile or error and in admin area, sign out
            if (window.location.pathname.startsWith('/admin')) {
              await supabase.auth.signOut();
              router.push('/admin/login');
            }
          }
        } else if (window.location.pathname.startsWith('/admin') && 
                  window.location.pathname !== '/admin/login') {
          // Redirect to login if not authenticated and trying to access admin pages
          router.push('/admin/login');
        }

        setIsLoading(false);
      }
    );

    // Initial session check
    const initializeAuth = async () => {
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
        } else {
          // If missing profile or error and in admin area, sign out from admin area
          if (window.location.pathname.startsWith('/admin')) {
            await supabase.auth.signOut();
            router.push('/admin/login');
          }
        }
      } else if (window.location.pathname.startsWith('/admin') && 
                window.location.pathname !== '/admin/login') {
        // Redirect to login if not authenticated and trying to access admin pages
        router.push('/admin/login');
      }
      
      setIsLoading(false);
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

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
    <AdminAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        signIn,
        signOut,
      }}
    >
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