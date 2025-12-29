'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // CRITICAL: Check if there's a pending deep link redirect waiting
      // We wait a tiny bit to see if OneSignalInit.tsx or the boot script has flagged a route
      const pendingRoute = localStorage.getItem('pending_push_route');
      if (pendingRoute) {
        console.log('🏁 Deep link detected in page.tsx, allowing OneSignalInit to handle it');
        return;
      }

      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    };

    checkUser();
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <p className="text-xl font-bold">Apple Interior Manager</p>
      <p>Please login to access the dashboard</p>
    </div>
  );
}
