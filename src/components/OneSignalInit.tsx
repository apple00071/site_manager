'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

/**
 * OneSignal Integration for Median Apps
 * 
 * For Median/GoNative apps, OneSignal is initialized NATIVELY by Median.
 * This component calls Median's JS bridge + our backend API to:
 * - Set External User ID (to link the device to our user)
 * - Get subscription info for our database
 */

// Declare global types for Median JS Bridge
declare global {
    interface Window {
        median?: {
            onesignal?: {
                login: (externalId: string) => void;
                logout: () => void;
                setEmail: (email: string) => void;
                setSMSNumber: (phone: string) => void;
                requestPermission: () => void;
                setExternalUserId: (externalId: string) => void;
                onNotificationOpened: (callback: (event: any) => void) => void;
                onesignalInfo: () => Promise<{
                    oneSignalUserId: string;
                    oneSignalPushToken: string;
                    oneSignalSubscribed: boolean;
                    externalUserId?: string;
                }>;
            };
        };
        median_onesignal_push_opened?: (data: any) => void;
    }
}

export default function OneSignalInit() {
    const hasSyncedRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isMedianApp = (): boolean => {
            return typeof window.median?.onesignal !== 'undefined';
        };

        const waitForMedian = (maxAttempts = 50, interval = 200): Promise<boolean> => {
            return new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                    attempts++;
                    if (isMedianApp()) {
                        console.log(`✅ Median OneSignal bridge ready (attempt ${attempts})`);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        console.log('⚠️ Not a Median app or bridge not available');
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                };
                check();
            });
        };

        const syncUserToOneSignal = async (user: any) => {
            if (!user?.id) {
                console.log('🔔 No user to sync');
                return;
            }

            if (hasSyncedRef.current) {
                console.log('🔔 Already synced in this session');
                return;
            }

            const hasMedian = await waitForMedian();
            if (!hasMedian) {
                console.log('⚠️ Skipping OneSignal sync (not a Median app)');
                return;
            }

            const userId = user.id;
            const email = user.email;

            console.log('═══════════════════════════════════════');
            console.log('🎯 SYNCING USER TO ONESIGNAL VIA MEDIAN');
            console.log('   User ID:', userId);
            console.log('   Email:', email);
            console.log('═══════════════════════════════════════');

            try {
                // 1. Request notification permission (Android 13+)
                if (window.median?.onesignal?.requestPermission) {
                    console.log('1️⃣ Requesting notification permission...');
                    window.median.onesignal.requestPermission();
                }

                // 2. Set External ID via Median bridge
                console.log('2️⃣ Setting External User ID via login/setExternalUserId...');
                if (typeof window.median?.onesignal?.login === 'function') {
                    window.median.onesignal.login(userId);
                    console.log('   ✅ login() called');
                } else if (typeof window.median?.onesignal?.setExternalUserId === 'function') {
                    window.median.onesignal.setExternalUserId(userId);
                    console.log('   ✅ setExternalUserId() called');
                }

                // 3. Get OneSignal info and link via backend API (delayed to ensure setExternalUserId took effect)
                setTimeout(async () => {
                    try {
                        console.log('3️⃣ Getting OneSignal subscription info...');

                        if (typeof window.median?.onesignal?.onesignalInfo === 'function') {
                            const info = await window.median.onesignal.onesignalInfo();
                            console.log('   📊 OneSignal Info:', JSON.stringify(info, null, 2));

                            if (info?.oneSignalUserId) {
                                // Link External ID via backend API
                                console.log('4️⃣ Linking External ID via backend API...');
                                try {
                                    const linkResponse = await fetch('/api/onesignal/link', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ oneSignalId: info.oneSignalUserId }),
                                    });
                                    const linkResult = await linkResponse.json();
                                    console.log('   ✅ Link result:', linkResult);
                                } catch (e) {
                                    console.log('   ⚠️ Link API error:', e);
                                }

                                // Save Player ID to database
                                console.log('5️⃣ Saving Player ID to database...');
                                try {
                                    const subResponse = await fetch('/api/onesignal/subscribe', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ playerId: info.oneSignalUserId }),
                                    });
                                    const subResult = await subResponse.json();
                                    console.log('   ✅ Database result:', subResult);
                                } catch (e) {
                                    console.log('   ⚠️ Subscribe error:', e);
                                }
                            } else {
                                console.log('   ⚠️ No OneSignal User ID - permission may not be granted');
                            }
                        }
                    } catch (err) {
                        console.log('   ⚠️ OneSignal info error:', err);
                    }
                }, 3000);

                hasSyncedRef.current = true;
                console.log('🎉 ONESIGNAL SYNC INITIATED');

            } catch (err) {
                console.error('❌ OneSignal sync error:', err);
            }
        };

        console.log('🔔 OneSignalInit mounted');

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth event:', event);

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    if (event === 'SIGNED_IN') {
                        hasSyncedRef.current = false;
                    }
                    syncUserToOneSignal(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                if (window.median?.onesignal?.logout) {
                    console.log('🔓 Logging out of OneSignal...');
                    window.median.onesignal.logout();
                }
            }
        });

        supabase.auth.getSession().then(({ data }: any) => {
            if (data?.session?.user) {
                console.log('📱 Found existing session, syncing...');
                syncUserToOneSignal(data.session.user);
            }
        });

        // Handle deep linking from OneSignal push notifications via Median bridge
        const handlePushOpened = (event: any) => {
            const eventStr = JSON.stringify(event, null, 2);
            console.log('🔔 OneSignal Push Opened event:', eventStr);

            // Log to a global for the debug UI
            // @ts-ignore
            window.LAST_PUSH_EVENT = event;

            // Extract route from notification data payload
            const additionalData = event?.notification?.additionalData || event?.additionalData || event;

            const route = additionalData?.route ||
                additionalData?.url ||
                additionalData?.path ||
                additionalData?.targetUrl ||
                additionalData?.link ||
                event?.notification?.launchURL;

            if (route) {
                console.log('🚀 Navigating to route:', route);

                // Store in localStorage as a backup
                localStorage.setItem('pending_push_route', route);

                // Perform navigation immediately
                if (route.startsWith('http')) {
                    window.location.href = route;
                } else {
                    const baseUrl = window.location.origin;
                    const targetUrl = route.startsWith('/') ? `${baseUrl}${route}` : `${baseUrl}/${route}`;
                    window.location.href = targetUrl;
                }
            } else {
                console.log('⚠️ No route found in notification payload');
            }
        };

        // Check for a pending redirect on mount (survives middleware redirects)
        const checkPendingRoute = () => {
            const pendingRoute = localStorage.getItem('pending_push_route');
            if (pendingRoute) {
                console.log('🔄 Attending to pending route:', pendingRoute);

                // Perform navigation if we're on a default page
                const currentPath = window.location.pathname;
                if (currentPath === '/' || currentPath === '/dashboard' || currentPath === '/login') {
                    localStorage.removeItem('pending_push_route'); // Clear only when used
                    if (pendingRoute.startsWith('http')) {
                        window.location.href = pendingRoute;
                    } else {
                        const baseUrl = window.location.origin;
                        const targetUrl = pendingRoute.startsWith('/') ? `${baseUrl}${pendingRoute}` : `${baseUrl}/${pendingRoute}`;
                        window.location.href = targetUrl;
                    }
                }
            }
        };

        // Use Median's native onNotificationOpened callback
        const registerBridge = async () => {
            checkPendingRoute();

            // Periodically check for pending route in case of slow redirects
            const interval = setInterval(checkPendingRoute, 1000);

            // Check if a payload was captured before this component mounted
            // @ts-ignore
            if (window.PENDING_PUSH_PAYLOAD) {
                // @ts-ignore
                console.log('🎯 Processing boot-time captured payload');
                // @ts-ignore
                handlePushOpened(window.PENDING_PUSH_PAYLOAD);
                // @ts-ignore
                window.PENDING_PUSH_PAYLOAD = null;
            }

            const hasMedian = await waitForMedian();
            if (hasMedian && window.median?.onesignal?.onNotificationOpened) {
                console.log('📲 Registering Median onNotificationOpened callback');
                window.median.onesignal.onNotificationOpened(handlePushOpened);
            }

            // Fallbacks for various Median/GoNative versions
            window.median_onesignal_push_opened = handlePushOpened;
            // @ts-ignore
            window.gonative_onesignal_push_opened = handlePushOpened;

            return () => clearInterval(interval);
        };

        let stopInterval: (() => void) | null = null;

        const setupBridge = async () => {
            const cleanup = await registerBridge();
            if (cleanup) stopInterval = cleanup;
        };

        setupBridge();

        return () => {
            authSubscription.unsubscribe();
            if (stopInterval) stopInterval();
        };
    }, [router]);

    return null;
}
