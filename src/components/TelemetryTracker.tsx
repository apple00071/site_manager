'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function TelemetryTracker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastLoggedPathRef = useRef<string | null>(null);

  // 1. Log page view on pathname change
  useEffect(() => {
    if (!user) return;

    // Prevent duplicate logs for the same page view on re-renders
    if (lastLoggedPathRef.current === pathname) return;
    lastLoggedPathRef.current = pathname;

    const logPageView = async () => {
      try {
        const response = await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: pathname,
            action: 'page_view',
          }),
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn('Telemetry error (page view):', errData.error || response.statusText);
        }
      } catch (err) {
        // Silently catch error to prevent app crashes
      }
    };

    logPageView();
  }, [pathname, user]);

  // 2. Log heartbeat every 60 seconds when focused
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(async () => {
      // Only log if the document is visible and has focus
      const isVisible = typeof document !== 'undefined' && !document.hidden;
      const isFocused = typeof document !== 'undefined' && document.hasFocus();
      
      if (!isVisible || !isFocused) {
        return;
      }

      try {
        const currentPathname = typeof window !== 'undefined' ? window.location.pathname : pathname;

        const response = await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: currentPathname,
            action: 'heartbeat',
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn('Telemetry error (heartbeat):', errData.error || response.statusText);
        }
      } catch (err) {
        // Silently catch
      }
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user, pathname]);

  return null;
}
