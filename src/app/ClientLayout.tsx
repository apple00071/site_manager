'use client';

// Force dynamic rendering to avoid build-time context issues
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';


export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Add a small delay to ensure hydration is complete
    const timer = setTimeout(() => {
      setHydrationComplete(true);
    }, 100);

    // Register service worker for PWA with update handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[App] Service Worker registered successfully');

          // Check for updates every hour
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available, prompt user to reload
                  console.log('[App] New version available! Please refresh the page.');
                  // TODO: Replace with toast notification
                  if (confirm('A new version is available. Reload to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((registrationError) => {
          console.error('[App] Service Worker registration failed:', registrationError);
        });
    }

    return () => clearTimeout(timer);
  }, []);

  // Don't render anything until client-side hydration is complete
  if (!isMounted || !hydrationComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>

          {children}
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

