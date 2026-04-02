'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
        gonative: any;
    }
}

export default function OneSignalInit() {
    const mounted = useRef(false);
    const router = useRouter();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('OneSignalInit: Missing Supabase environment variables. Push registration will be skipped.');
        return null;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    const DEBUG_ALERTS = false; // Set to true to show alerts on the phone for debugging

    async function initCapacitorOneSignal(user: any) {
        if (!Capacitor.isNativePlatform()) return;
        
        try {
            console.log("🚀 OneSignalInit: Initializing Native OneSignal");
            if (DEBUG_ALERTS) alert("🚀 Initializing OneSignal...");
            
            // Access the OneSignal native plugin (Cordova plugin via global)
            const OneSignal = (window as any).plugins?.OneSignal || (window as any).OneSignalCordovaPlugin;
            
            if (!OneSignal) {
                console.error("❌ OneSignal plugin not available on window.plugins or window");
                if (DEBUG_ALERTS) alert("❌ Error: OneSignal Plugin Missing");
                return;
            }
            
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || 'd800d582-08b8-431c-bb19-59a08f7f5379';
            console.log("📲 OneSignal App ID:", appId);

            // 1. Initialize
            OneSignal.initialize(appId);
            
            // 2. Clear badge
            try { OneSignal.Notifications.clearAll(); } catch (e) {}

            // 3. User Login & Linking
            if (user?.id) {
                const externalId = `user_${user.id}`;
                console.log("📲 Attempting OneSignal Login:", externalId);
                
                // Use a promise-based delay to ensure SDK is ready
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                    await OneSignal.login(externalId);
                    console.log("✅ OneSignal login result success");
                    if (DEBUG_ALERTS) alert(`✅ Logged in as: ${externalId}`);
                } catch (loginErr) {
                    console.error("❌ OneSignal login error:", loginErr);
                }

                // 4. Force Retrieval and Linking of OneSignal ID
                const syncSubscription = async (attempt: number) => {
                    try {
                        const onesignalId = await OneSignal.User.getOnesignalId();
                        if (onesignalId) {
                            console.log(`✅ OneSignal ID sync (attempt ${attempt}):`, onesignalId);
                            if (DEBUG_ALERTS) alert(`✅ ID Synced: ${onesignalId}`);
                            
                            await fetch('/api/onesignal/link', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ oneSignalId: onesignalId }),
                            });
                            return true;
                        }
                        return false;
                    } catch (e) {
                        return false;
                    }
                };

                // Retry logic for obtaining the OneSignal ID
                for (let i = 1; i <= 3; i++) {
                    const success = await syncSubscription(i);
                    if (success) break;
                    await new Promise(r => setTimeout(r, 7000 * i));
                }
            }
            
            // 5. Handle Clicks
            OneSignal.Notifications.addEventListener('click', (event: any) => {
                const data = event.notification.additionalData;
                const route = data?.route || data?.url;
                if (route) router.push(route);
            });

        } catch (error) {
            console.error("❌ Capacitor OneSignal V5 Error:", error);
            if (DEBUG_ALERTS) alert("Fatal Error: " + JSON.stringify(error));
        }
    }

    async function logoutCapacitorOneSignal() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const OneSignal: any = (await import('onesignal-cordova-plugin')).default;
            OneSignal.logout();
            await fetch('/api/onesignal/subscribe', { method: 'DELETE' });
        } catch (error) {
            console.error("Capacitor OneSignal Logout Error:", error);
        }
    }


    // ==========================================
    // LEGACY MEDIAN.CO IMPLEMENTATION
    // ==========================================
    function waitForMedianOneSignal(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (
                    window.median?.onesignal &&
                    typeof window.median.onesignal.login === "function"
                ) {
                    clearInterval(interval);
                    resolve();
                }

                if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve();
                }
            }, 200);
        });
    }

    function waitForOneSignalSubscription(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(async () => {
                try {
                    if (window.median?.onesignal?.info) {
                        const info = await window.median.onesignal.info();
                        if (info && (info.oneSignalId || info.pushToken || info.subscription?.id)) {
                            clearInterval(interval); resolve(); return;
                        }
                    } else if (window.median?.onesignal?.onesignalInfo) {
                        const info = await window.median.onesignal.onesignalInfo();
                        if (info && (info.oneSignalId || info.pushToken)) {
                            clearInterval(interval); resolve(); return;
                        }
                    }
                } catch (e) { }

                if (Date.now() - start > timeout) {
                    clearInterval(interval); resolve();
                }
            }, 500);
        });
    }

    async function registerLegacyMedianPush(user: any, eventSource: string) {
        if (!window.median?.onesignal) return;

        try {
            if (typeof window.median.onesignal.register === 'function') {
                await window.median.onesignal.register();
            } else if (typeof window.median.onesignal.requestPermission === 'function') {
                await window.median.onesignal.requestPermission();
            }

            await waitForOneSignalSubscription();

            try {
                let oneSignalId = null;
                if (window.median?.onesignal?.info) {
                    const info = await window.median.onesignal.info();
                    oneSignalId = info.oneSignalId || info.subscription?.id;
                }

                if (oneSignalId) {
                    await fetch('/api/onesignal/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oneSignalId }),
                    });
                }
            } catch (linkError) {}

            const externalId = `user_${user.id}`;
            await window.median.onesignal.login(externalId);

            if (user.email && typeof window.median.onesignal.setEmail === 'function') {
                await window.median.onesignal.setEmail(user.email);
            }
        } catch (error: any) {}
    }


    // ==========================================
    // LIFECYCLE HOOK
    // ==========================================
    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent: AuthChangeEvent, session: Session | null) => {
            
            // --- DEEP LINK HANDLING ---
            const pendingRoute = localStorage.getItem('pending_push_route');
            if (pendingRoute) {
                localStorage.removeItem('pending_push_route');
                router.push(pendingRoute);
            }

            // --- LOGIN / STARTUP ---
            if ((authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION") && session?.user) {
                if (Capacitor.isNativePlatform()) {
                    // Start Capacitor Native OneSignal
                    setTimeout(() => initCapacitorOneSignal(session.user), 1000);
                } else {
                    // Fallback to Median (if running in legacy wrapper)
                    await waitForMedianOneSignal();
                    setTimeout(() => registerLegacyMedianPush(session.user, authEvent), 1000);
                }
            }
            
            // --- LOGOUT ---
            else if (authEvent === "SIGNED_OUT") {
                if (Capacitor.isNativePlatform()) {
                    await logoutCapacitorOneSignal();
                } else {
                    if (window.median?.onesignal?.logout) {
                        try { await window.median.onesignal.logout(); } catch (e) {}
                    }
                    try { await fetch('/api/onesignal/subscribe', { method: 'DELETE' }); } catch (e) {}
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
