'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    };

    checkUser();
  }, [router, supabase.auth]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <p className="text-xl font-bold">Apple Interior Manager</p>
      <p>Please login to access the dashboard</p>
    </div>
  );
}
