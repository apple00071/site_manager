'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import WomensDayPopup from '@/components/WomensDayPopup';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      console.log('[App] Service worker controller changed, reloading page...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered successfully');

        refreshInterval = setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] New version detected, updating automatically...');
              newWorker.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((registrationError) => {
        console.error('[App] Service Worker registration failed:', registrationError);
      });

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <WomensDayPopup />
          {children}
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

