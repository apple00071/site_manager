'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
        gonative: any;
        median_onesignal_push_opened: (event: any) => void;
        gonative_onesignal_push_opened: (event: any) => void;
        PENDING_PUSH_PAYLOAD: any;
        LAST_PUSH_EVENT: any;
    }
}

export default function OneSignalInit() {
    const router = useRouter();
    const hasSyncedRef = useRef(false);

    /**
     * ✅ STEP 1: Wait for Median + OneSignal bridge (CRITICAL)
     * Polls until window.median.onesignal.login is available.
     */
    const waitForMedianOneSignal = (timeout = 10000): Promise<void> => {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const interval = setInterval(() => {
                if (
                    window.median &&
                    window.median.onesignal &&
                    typeof window.median.onesignal.login === "function"
                ) {
                    clearInterval(interval);
                    resolve();
                }

                if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject("Median OneSignal bridge not ready");
                }
            }, 300);
        });
    };

    /**
     * ✅ STEP 2: Request permission BEFORE syncing user
     * Android 13+ will silently block identity sync if permission is not granted.
     */
    const ensureNotificationPermission = async () => {
        if (window.median?.onesignal?.requestPermission) {
            await window.median.onesignal.requestPermission();
        }
    };

    /**
     * ✅ STEP 3: Sync user ONLY after login (FINAL FIX)
     */
    const syncUserToOneSignal = async (user: {
        id: string;
        email?: string;
        phone?: string;
    }) => {
        try {
            console.log("🔄 Waiting for Median OneSignal bridge...");
            await waitForMedianOneSignal();

            console.log("📱 Requesting notification permission...");
            await ensureNotificationPermission();

            const externalId = `user_${user.id}`;

            console.log("🔐 Setting External ID:", externalId);
            await window.median.onesignal.login(externalId);

            if (user.email) {
                console.log("📧 Setting email:", user.email);
                await window.median.onesignal.setEmail(user.email);
            }

            if (user.phone) {
                console.log("📞 Setting phone:", user.phone);
                await window.median.onesignal.setSMSNumber(user.phone);
            }

            // Optional: Verify sync status
            if (window.median.onesignal.info) {
                const info = await window.median.onesignal.info();
                console.log("✅ OneSignal info after sync:", info);
            }

            hasSyncedRef.current = true;

        } catch (err) {
            console.error("❌ OneSignal sync failed:", err);
        }
    };

    useEffect(() => {
        // 1. Auth State Monitoring
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            console.log('🔑 [Auth] Event:', event);

            const user = session?.user;

            // ✅ STEP 4: Call it ONLY on SIGNED_IN
            if (event === 'SIGNED_IN' && user) {
                // Prepare user data mapping
                const userData = {
                    id: user.id,
                    email: user.email,
                    phone: user.user_metadata?.phone_number || undefined
                };

                // Prevent duplicate syncs if possible, though idempotency is handled by OneSignal mostly
                // We rely on the event type as the primary guard
                await syncUserToOneSignal(userData);
            }
            else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                // Logout from OneSignal if bridge is ready
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                } else if (window.median?.onesignal?.removeExternalUserId) {
                    window.median.onesignal.removeExternalUserId();
                }
            }
        });

        // 🎯 DEFERRED NAVIGATION LOGIC
        // Keeps existing logic for handling notification clicks functionality
        const processPendingRoute = () => {
            // Logic to handle deferred navigation can remain if needed, 
            // but user request focused on fixing identity sync.
            // We'll keep the storage check just in case.
            const pendingRoute = localStorage.getItem('pending_push_route');
            if (pendingRoute) {
                console.log('🚀 [Deferred] Pending route found:', pendingRoute);
                // Actual navigation would typically require a session, handled elsewhere or lazily here
            }
        };

        // 3. OneSignal Push Opened Handler (Capture Only)
        // Re-implementing the capture logic to ensure we don't lose that functionality
        const handlePushOpened = (event: any) => {
            console.log('🔔 OneSignal Push Opened:', event);
            window.LAST_PUSH_EVENT = event;

            const additionalData = event?.notification?.additionalData || event?.additionalData || event;
            const route = additionalData?.route ||
                additionalData?.url ||
                additionalData?.path ||
                additionalData?.targetUrl ||
                additionalData?.link ||
                event?.notification?.launchURL;

            if (route) {
                console.log('💾 [Capture] Storing route for deferred navigation:', route);
                localStorage.setItem('pending_push_route', route);

                if (route.startsWith('http')) {
                    window.location.href = route;
                } else {
                    router.push(route);
                }
            }
        };

        // Register global handlers for Median to call
        window.median_onesignal_push_opened = handlePushOpened;
        window.gonative_onesignal_push_opened = handlePushOpened;

        // Attempt to register bridge listener if already ready
        if (window.median?.onesignal?.onNotificationOpened) {
            window.median.onesignal.onNotificationOpened(handlePushOpened);
        }

        return () => {
            authSubscription.unsubscribe();
        };
    }, [router]);

    return null;
}
