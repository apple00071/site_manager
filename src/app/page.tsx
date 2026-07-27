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
        const { data: { user } } = await supabase.auth.getUser();

        // Check if there's a pending deep link redirect waiting
        const pendingRoute = typeof window !== 'undefined' ? localStorage.getItem('pending_push_route') : null;
        if (pendingRoute) {
          console.log('🏁 Deep link detected in page.tsx, allowing OneSignalInit to handle it');
          return;
        }

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
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none safe-area-inset-top safe-area-inset-bottom">
      {/* Brand Splash Container */}
      <div className="flex flex-col items-center gap-6">
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white/10 p-4 backdrop-blur-md border border-white/15 shadow-2xl flex items-center justify-center relative overflow-hidden animate-pulse">
          <Image
            src="/New-logo.png"
            alt="Apple Interior Manager Logo"
            width={128}
            height={128}
            priority
            className="object-contain w-full h-full drop-shadow-md"
          />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
            Apple Interiors
          </h1>
          <p className="text-xs font-bold text-amber-400/90 tracking-widest uppercase">
            Project Manager
          </p>
        </div>

        {/* Pulsing Dots Loader */}
        <div className="flex items-center gap-2 mt-4">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
