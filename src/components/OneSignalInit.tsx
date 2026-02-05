'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
        gonative: any;
    }
}

const DEBUG = false; // Set to false after debugging

export default function OneSignalInit() {
    const mounted = useRef(false);
    const router = useRouter();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('OneSignalInit: Missing Supabase environment variables. Push registration will be skipped.');
        return null;
    }

    // Use createBrowserClient from @supabase/ssr to match Middleware's createServerClient
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

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
            // 1. Permission (Using 'register' as per Median Docs)
            if (typeof window.median.onesignal.register === 'function') {
                if (DEBUG) alert("📱 Calling median.onesignal.register()...");
                await window.median.onesignal.register();
            } else if (typeof window.median.onesignal.requestPermission === 'function') {
                if (DEBUG) alert("📱 Calling requestPermission fallback...");
                await window.median.onesignal.requestPermission();
            } else {
                if (DEBUG) alert("⚠️ No Permission function found (register/requestPermission)");
            }

            // 2. Subscription
            await waitForOneSignalSubscription();

            // 3. Server-side Link (More reliable than JS bridge login for initial targeting)
            try {
                let oneSignalId = null;
                if (window.median?.onesignal?.info) {
                    const info = await window.median.onesignal.info();
                    oneSignalId = info.oneSignalId || info.subscription?.id;
                }

                if (oneSignalId) {
                    if (DEBUG) alert(`🔗 Linking OneSignal ID: ${oneSignalId}`);
                    await fetch('/api/onesignal/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oneSignalId }),
                    });
                }
            } catch (linkError) {
                console.error("Link error:", linkError);
            }

            // 4. Login (JS Bridge)
            const externalId = `user_${user.id}`;
            await window.median.onesignal.login(externalId);

            // 5. Set Email (Safely)
            if (user.email) {
                if (typeof window.median.onesignal.setEmail === 'function') {
                    await window.median.onesignal.setEmail(user.email);
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

            // --- DEEP LINK HANDLING ---
            const pendingRoute = localStorage.getItem('pending_push_route');
            if (pendingRoute) {
                console.log('🔗 OneSignalInit: Consuming pending deep link:', pendingRoute);
                localStorage.removeItem('pending_push_route');
                router.push(pendingRoute);
            }

            // Handle BOTH Initial Session (Page Load) and Signed In (New Login)
            if ((authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION") && session?.user) {
                // Wait for bridge logic
                await waitForMedianOneSignal();

                setTimeout(() => {
                    registerPushAfterLogin(session.user, authEvent);
                }, 1000);
            }
            else if (authEvent === "SIGNED_OUT") {
                if (DEBUG) alert("🚪 User SIGNED_OUT: Clearing OneSignal Identity");

                // 1. Tell Median Bridge to logout
                if (window.median?.onesignal?.logout) {
                    try {
                        await window.median.onesignal.logout();
                        if (DEBUG) alert("✅ OneSignal Bridge Logout Success");
                    } catch (e) {
                        console.error("OneSignal bridge logout error:", e);
                    }
                }

                // 2. Clear association on server
                try {
                    await fetch('/api/onesignal/subscribe', { method: 'DELETE' });
                } catch (e) {
                    console.error("Failed to clear OneSignal association on server:", e);
                }
            }
            else if (!session?.user && authEvent === "INITIAL_SESSION") {
                if (DEBUG) alert("❌ INITIAL_SESSION: No User (Logged Out)");
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
