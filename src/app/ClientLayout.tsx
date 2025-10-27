'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  // Don't render anything until client-side hydration is complete
  if (!isMounted) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
