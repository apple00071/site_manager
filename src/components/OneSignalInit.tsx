'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
        gonative: any;
    }
}

const DEBUG = true; // Set to false after debugging

export default function OneSignalInit() {
    const mounted = useRef(false);

    // Use createBrowserClient from @supabase/ssr to match Middleware's createServerClient
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Helper: Wait for Median Bridge
    function waitForMedianOneSignal(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                // Strict check: wait for .login to be present
                if (
                    window.median?.onesignal &&
                    typeof window.median.onesignal.login === "function"
                ) {
                    clearInterval(interval);
                    resolve();
                }

                if (Date.now() - start > timeout) {
                    if (DEBUG) alert("⚠️ Median bridge Timed Out!");
                    clearInterval(interval);
                    resolve(); // Try anyway
                }
            }, 200);
        });
    }

    // Helper: Wait for Subscription
    function waitForOneSignalSubscription(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(async () => {
                try {
                    if (window.median?.onesignal?.info) {
                        const info = await window.median.onesignal.info();
                        if (info && (info.oneSignalId || info.pushToken || info.subscription?.id)) {
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    } else if (window.median?.onesignal?.onesignalInfo) {
                        const info = await window.median.onesignal.onesignalInfo();
                        if (info && (info.oneSignalId || info.pushToken)) {
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    }
                } catch (e) { }

                if (Date.now() - start > timeout) {
                    if (DEBUG) alert("⚠️ Sub Wait Timed Out - No ID found");
                    clearInterval(interval);
                    resolve();
                }
            }, 500);
        });
    }

    async function registerPushAfterLogin(user: any, eventSource: string) {
        if (DEBUG) alert(`⏩ Starting Sync (${eventSource}) for: ${user.email}`);

        // Pre-flight check
        if (!window.median?.onesignal) {
            if (DEBUG) alert("❌ No median.onesignal found!");
            return;
        }

        try {
            // 1. Permission
            if (typeof window.median.onesignal.requestPermission === 'function') {
                await window.median.onesignal.requestPermission();
            }

            // 2. Subscription
            await waitForOneSignalSubscription();

            // 3. Login
            const externalId = `user_${user.id}`;
            await window.median.onesignal.login(externalId);

            // 4. Set Email (Safely)
            if (user.email) {
                if (typeof window.median.onesignal.setEmail === 'function') {
                    await window.median.onesignal.setEmail(user.email);
                } else {
                    console.warn("OneSignal setEmail not supported");
                }
            }

            // 5. Set Phone (Safely)
            if (user.phone) {
                if (typeof window.median.onesignal.setSMSNumber === 'function') {
                    await window.median.onesignal.setSMSNumber(user.phone);
                } else {
                    console.warn("OneSignal setSMSNumber not supported");
                }
            }

            // 6. Verification View
            if (DEBUG) {
                if (window.median.onesignal.info) {
                    const finalInfo = await window.median.onesignal.info();
                    alert("✅ SUCCESS: " + JSON.stringify(finalInfo));
                }
            }

        } catch (error: any) {
            if (DEBUG) alert("❌ Error: " + error.message);
        }
    }

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        if (DEBUG) alert("✅ Component MOUNTED & Listening (SSR)...");

        // 1. Listen for changes (using SSR client)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent: AuthChangeEvent, session: Session | null) => {

            if (DEBUG) alert(`🔔 Event: ${authEvent}`);

            // Handle BOTH Initial Session (Page Load) and Signed In (New Login)
            if ((authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION") && session?.user) {
                // Wait for bridge logic
                await waitForMedianOneSignal();

                setTimeout(() => {
                    registerPushAfterLogin(session.user, authEvent);
                }, 1000);
            } else if (!session?.user && authEvent === "INITIAL_SESSION") {
                if (DEBUG) alert("❌ INITIAL_SESSION: No User (Logged Out)");
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
