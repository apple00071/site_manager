'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

// Extend window for Median JS Bridge & Global Push state
declare global {
    interface Window {
        median: any;
        gonative: any;
        PENDING_PUSH_PAYLOAD: any;
    }
}

function extractRouteFromPayload(payload: any): string | null {
    if (!payload) return null;

    const data =
        payload?.notification?.additionalData ||
        payload?.additionalData ||
        payload?.result?.notification?.additionalData ||
        payload?.result?.additionalData ||
        payload?.data ||
        payload;

    let route =
        data?.route ||
        data?.url ||
        data?.targetUrl ||
        data?.path ||
        payload?.notification?.launchURL ||
        payload?.launchURL ||
        payload?.result?.url ||
        null;

    if (typeof route === 'string' && route.trim()) {
        route = route.trim();
        // If route is a full URL on our domain or general http URL, extract relative path
        if (route.startsWith('http://') || route.startsWith('https://')) {
            try {
                const parsed = new URL(route);
                route = parsed.pathname + parsed.search + parsed.hash;
            } catch (e) {
                // Ignore parse error
            }
        }
        if (!route.startsWith('/') && !route.startsWith('http')) {
            route = `/${route}`;
        }
        return route;
    }
    return null;
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

    const navigateToRoute = (route: string) => {
        if (!route) return;
        console.log('🎯 [OneSignalInit] Navigating to target route:', route);
        try {
            localStorage.removeItem('pending_push_route');
        } catch (e) {}

        try {
            router.push(route);
        } catch (e) {
            window.location.href = route;
        }
    };

    const handlePushPayload = (payload: any) => {
        console.log('📦 [OneSignalInit] Push payload received:', payload);
        const route = extractRouteFromPayload(payload);
        if (route) {
            try {
                localStorage.setItem('pending_push_route', route);
            } catch (e) {}
            navigateToRoute(route);
        }
    };

    async function getCapacitorOneSignal(timeoutMs = 6000): Promise<any> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const OneSignal = (window as any).plugins?.OneSignal 
                           || (window as any).OneSignalCordovaPlugin 
                           || (window as any).OneSignal;
            if (OneSignal) return OneSignal;
            try {
                const mod: any = (await import('onesignal-cordova-plugin')).default;
                if (mod) return mod;
            } catch (e) {}
            await new Promise(r => setTimeout(r, 300));
        }
        return null;
    }

    async function linkCapacitorUser(user: any) {
        if (!Capacitor.isNativePlatform() || !user?.id) return;
        
        try {
            const OneSignal = await getCapacitorOneSignal();
            
            if (!OneSignal) {
                console.error("❌ OneSignalInit: Plugin not available for user link");
                return;
            }

            const externalId = `user_${user.id}`;
            console.log("📲 [OneSignalInit] Logging into OneSignal with External ID:", externalId);
            
            try {
                await OneSignal.login(externalId);
                console.log("✅ [OneSignalInit] Login success");
            } catch (loginErr) {
                console.error("❌ [OneSignalInit] Login error:", loginErr);
            }

            // Force Retrieval and Linking of OneSignal ID
            const syncSubscription = async (attempt: number) => {
                try {
                    console.log(`📲 [OneSignalInit] Sync attempt ${attempt}...`);
                    const onesignalId = await OneSignal.User.getOnesignalId();
                    
                    if (onesignalId) {
                        console.log(`✅ [OneSignalInit] ID found:`, onesignalId);
                        
                        const response = await fetch('/api/onesignal/link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oneSignalId: onesignalId }),
                        });
                        
                        if (response.ok) {
                            console.log("✅ [OneSignalInit] Backend Link Success");
                            return true;
                        } else {
                            console.error("❌ [OneSignalInit] Backend Link Failed");
                        }
                    } else {
                        console.warn(`⚠️ [OneSignalInit] No ID returned in attempt ${attempt}`);
                    }
                    return false;
                } catch (e) {
                    console.error(`❌ [OneSignalInit] Sync Error (attempt ${attempt}):`, e);
                    return false;
                }
            };

            // Retry logic for obtaining the OneSignal ID
            for (let i = 1; i <= 3; i++) {
                const success = await syncSubscription(i);
                if (success) break;
                await new Promise(r => setTimeout(r, 3000 * i));
            }
        } catch (error) {
            console.error("❌ Capacitor OneSignal User Link Error:", error);
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

        // 1. Immediately handle any pending push captured at boot time
        if (typeof window !== 'undefined' && window.PENDING_PUSH_PAYLOAD) {
            handlePushPayload(window.PENDING_PUSH_PAYLOAD);
            window.PENDING_PUSH_PAYLOAD = null;
        }

        // 2. Check if a route is waiting in localStorage
        try {
            const storedRoute = typeof window !== 'undefined' ? localStorage.getItem('pending_push_route') : null;
            if (storedRoute) {
                console.log('💾 [OneSignalInit] Found stored pending route on mount:', storedRoute);
                navigateToRoute(storedRoute);
            }
        } catch (e) {}

        // 3. Listen for custom push open events
        const onCustomPush = (e: any) => {
            if (e?.detail) handlePushPayload(e.detail);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('push_notification_opened', onCustomPush);
        }

        // 4. Immediately initialize Native OneSignal and attach click listener
        if (Capacitor.isNativePlatform()) {
            getCapacitorOneSignal().then((OneSignal) => {
                if (OneSignal) {
                    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || 'd800d582-08b8-431c-bb19-59a08f7f5379';
                    console.log("📲 [OneSignalInit] Early initialize with App ID:", appId);
                    try {
                        OneSignal.initialize(appId);
                        OneSignal.Notifications.addEventListener('click', handlePushPayload);
                        OneSignal.Notifications.requestPermission(true).catch(() => {});
                        try { OneSignal.Notifications.clearAll(); } catch (e) {}
                    } catch (err) {
                        console.warn("⚠️ Early OneSignal setup warning:", err);
                    }
                }
            }).catch((err) => {
                console.warn("⚠️ Early OneSignal setup error:", err);
            });
        }

        // 5. Auth State Change Listener (for linking user ID)
        const handleAuthChange = async (authEvent: AuthChangeEvent, session: Session | null) => {
            console.log("🔐 OneSignalInit: Auth state change:", authEvent, session?.user?.id);

            // --- LOGIN / STARTUP LINKING ---
            if ((authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION") && session?.user) {
                if (Capacitor.isNativePlatform()) {
                    linkCapacitorUser(session.user);
                } else {
                    await waitForMedianOneSignal();
                    registerLegacyMedianPush(session.user, authEvent);
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
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

        const runImmediateCheck = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                handleAuthChange("INITIAL_SESSION" as AuthChangeEvent, session);
            }
        };
        runImmediateCheck();

        return () => {
            subscription.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('push_notification_opened', onCustomPush);
            }
        };
    }, []);

    return null;
}
