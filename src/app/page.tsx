'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const pendingRoute = typeof window !== 'undefined' ? localStorage.getItem('pending_push_route') : null;

        // 1. Fast local check (instant ~1ms, no network roundtrip)
        const { data: { session } } = await supabase.auth.getSession();

        if (pendingRoute) {
          localStorage.removeItem('pending_push_route');
          if (session?.user) {
            router.replace(pendingRoute);
          } else {
            localStorage.setItem('pending_push_route', pendingRoute);
            router.replace('/login');
          }
          return;
        }

        if (session?.user) {
          router.replace('/dashboard');
          return;
        }

        // 2. Fallback network check only if no local session found
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      } catch (err) {
        console.error('Error during startup auth check:', err);
        router.replace('/login');
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-6 text-center select-none safe-area-inset-top safe-area-inset-bottom">
      {/* Brand Splash Container */}
      <div className="flex flex-col items-center gap-6">
        <div className="w-36 h-36 sm:w-48 sm:h-48 p-2 flex items-center justify-center relative overflow-hidden animate-pulse">
          <Image
            src="/New-logo.png"
            alt="Apple Interior Manager Logo"
            width={180}
            height={180}
            priority
            className="object-contain w-full h-full"
          />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider uppercase">
            Apple Interiors
          </h1>
          <p className="text-xs font-black text-amber-500 tracking-widest uppercase">
            Project Manager
          </p>
        </div>

        {/* Pulsing Dots Loader */}
        <div className="flex items-center gap-2 mt-4">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
