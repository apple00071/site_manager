'use client';

import { Inter } from 'next/font/google';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If not loading and no user, redirect to login
    // Except if already on the login page
    if (!loading && !user && pathname !== '/portal/login') {
      router.push('/portal/login');
    }
  }, [user, loading, pathname, router]);

  return (
    <div className={`min-h-screen bg-[#fafaf8] ${inter.className}`}>
      {children}
    </div>
  );
}
