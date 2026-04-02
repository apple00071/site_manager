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

const DEBUG = true; // TEMP: Enable to debug push notification registration on devices

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

    // ==========================================
    // CAPACITOR NATIVE ONESIGNAL IMPLEMENTATION
    // ==========================================
    async function initCapacitorOneSignal(user: any) {
        if (!Capacitor.isNativePlatform()) return;
        
        try {
            console.log("🚀 OneSignalInit: Initializing Native OneSignal");
            if (DEBUG) alert("🚀 Capacitor detected: Initializing Native OneSignal");
            
            // Try multiple ways to access the OneSignal native plugin
            let OneSignal: any = null;
            
            // Method 1: Dynamic import (works when bundled with the app)
            try {
                OneSignal = (await import('onesignal-cordova-plugin')).default;
                if (DEBUG) alert("✅ OneSignal loaded via dynamic import");
            } catch (importErr) {
                console.warn("OneSignal dynamic import failed, trying window fallbacks...", importErr);
                if (DEBUG) alert("⚠️ Dynamic import failed: " + String(importErr));
            }
            
            // Method 2: Cordova global (when plugin is loaded via native bridge)
            if (!OneSignal && (window as any).plugins?.OneSignal) {
                OneSignal = (window as any).plugins.OneSignal;
                if (DEBUG) alert("✅ OneSignal loaded via window.plugins.OneSignal");
            }
            
            // Method 3: Direct global (some versions expose it directly)
            if (!OneSignal && (window as any).OneSignalCordovaPlugin) {
                OneSignal = (window as any).OneSignalCordovaPlugin;
                if (DEBUG) alert("✅ OneSignal loaded via window.OneSignalCordovaPlugin");
            }

            if (!OneSignal) {
                console.error("❌ OneSignal plugin not available via any method");
                if (DEBUG) alert("❌ OneSignal plugin not available. Push notifications will NOT work.");
                return;
            }
            
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
            
            if (!appId) {
                console.warn("OneSignalInit: Missing NEXT_PUBLIC_ONESIGNAL_APP_ID in environment.");
                if (DEBUG) alert("❌ Error: Missing OneSignal App ID");
                return;
            }

            console.log("📲 OneSignal initializing with ID:", appId);
            if (DEBUG) alert("📲 OneSignal ID: " + appId);

            // V5 Initialization
            OneSignal.initialize(appId);
            
            // V5 Request Permission (Explicitly call this to show the prompt)
            console.log("📲 Requesting push notification permission...");
            try {
                const permissionResult = await OneSignal.Notifications.requestPermission(true);
                console.log("📲 Notification permission result:", permissionResult);
                if (DEBUG) alert("Permission Result: " + permissionResult);
                
                // If permission is false, the OS might be blocking the prompt because it was previously denied.
                // We prompt the user with a standard web confirm dialog advising how to fix it.
                if (!permissionResult) {
                     const hasPrompted = localStorage.getItem('push_permission_prompted');
                     // Only prompt them once so it doesn't get annoying on every app launch
                     if (!hasPrompted) {
                         setTimeout(() => {
                             alert(
                                 "Notifications are currently disabled.\n\n" +
                                 "To receive important project updates, please go to your device Settings -> Apps -> Apple Interior -> Permissions and allow Notifications."
                             );
                             localStorage.setItem('push_permission_prompted', 'true');
                         }, 1000);
                     }
                } else {
                     // If they granted it after previously rejecting (maybe via settings), reset the flag
                     localStorage.removeItem('push_permission_prompted');
                }
            } catch (permError) {
                console.error("📲 Permission request failed:", permError);
            }
            
            // V5 Login with external ID
            if (user?.id) {
                const externalId = `user_${user.id}`;
                console.log("📲 Logging in to OneSignal with ID:", externalId);
                try {
                    await OneSignal.login(externalId);
                    console.log("✅ OneSignal login completed for:", externalId);
                } catch (loginErr) {
                    console.error("❌ OneSignal login failed:", loginErr);
                }
                
                if (user.email) {
                    try { OneSignal.User.addEmail(user.email); } catch (e) {}
                }
            }
            
            // V5 Handle Notification Opening (Deep Links)
            OneSignal.Notifications.addEventListener('click', (event: any) => {
                console.log('📲 Notification clicked:', event);
                const data = event.notification.additionalData;
                const route = data?.route || data?.url || data?.path || data?.targetUrl;
                if (route) {
                    router.push(route);
                }
            });

            // V5 Refresh OneSignal ID link with Supabase
            // Retry multiple times because the SDK may take a while to register
            const linkOneSignalId = async (attempt: number) => {
                try {
                    const onesignalId = await OneSignal.User.getOnesignalId();
                    if (onesignalId) {
                        console.log(`✅ OneSignal ID retrieved (attempt ${attempt}):`, onesignalId);
                        await fetch('/api/onesignal/link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oneSignalId: onesignalId }),
                        });
                        return true;
                    }
                    console.warn(`⚠️ OneSignal ID not available yet (attempt ${attempt})`);
                    return false;
                } catch (idErr) {
                    console.warn(`Could not retrieve onesignalId (attempt ${attempt}):`, idErr);
                    return false;
                }
            };

            // Try at 5s, then retry at 15s and 30s if still not linked
            setTimeout(async () => {
                const success = await linkOneSignalId(1);
                if (!success) {
                    setTimeout(async () => {
                        const success2 = await linkOneSignalId(2);
                        if (!success2) {
                            setTimeout(() => linkOneSignalId(3), 15000);
                        }
                    }, 10000);
                }
            }, 5000);

        } catch (error) {
            console.error("❌ Capacitor OneSignal V5 Error:", error);
            if (DEBUG) alert("OneSignal Error: " + JSON.stringify(error));
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
