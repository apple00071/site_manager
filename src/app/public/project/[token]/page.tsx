'use client';

import { useState, useEffect, use } from 'react';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { FiLock, FiShield, FiArrowRight, FiInfo } from 'react-icons/fi';

const inter = Inter({ subsets: ['latin'] });

export default function PublicProjectRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push('/portal/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className={`min-h-screen bg-[#fafaf8] flex items-center justify-center p-6 ${inter.className}`}>
      <div className="w-full max-w-xl text-center">
        <div className="mb-10 inline-flex items-center justify-center w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 text-[#eab308]">
          <FiShield size={40} />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">Secure Portal Migration</h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto mb-12">
          Your project information is now protected by a secure, password-protected account for enhanced privacy and full communication features.
        </p>

        <div className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/20 mb-12">
          <div className="flex items-center gap-6 text-left mb-8">
            <div className="w-12 h-12 bg-yellow-50 text-[#eab308] rounded-2xl flex items-center justify-center flex-shrink-0">
              <FiLock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1">New Secure Access</h3>
              <p className="text-xs text-gray-400">Please log in to see full site updates, including photos and voice notes.</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/portal/login')}
            className="w-full bg-gray-900 text-white rounded-2xl py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg"
          >
            Go to Secure Portal <FiArrowRight />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] animate-pulse">
            <FiInfo /> Redirecting in {countdown} seconds...
        </div>
      </div>
    </div>
  );
}
