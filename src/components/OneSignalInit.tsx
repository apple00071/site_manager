'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

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
    const [authSession, setAuthSession] = useState<Session | null>(null);

    // Sync user information to OneSignal
    const syncUserToOneSignal = async (user: any) => {
        if (!user || hasSyncedRef.current) return;

        try {
            console.log('📱 Syncing User to OneSignal:', user.email);

            const waitForMedian = () => {
                return new Promise<boolean>((resolve) => {
                    if (window.median?.onesignal) return resolve(true);
                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        if (window.median?.onesignal) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (attempts > 50) {
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 100);
                });
            };

            const hasMedian = await waitForMedian();
            if (!hasMedian) {
                console.log('⚠️ Median bridge not available for OneSignal sync');
                return;
            }

            // Sync External User ID
            const externalId = user.id;
            if (window.median.onesignal.login) {
                window.median.onesignal.login(externalId);
            } else if (window.median.onesignal.setExternalUserId) {
                window.median.onesignal.setExternalUserId(externalId);
            }

            // Sync email and phone if available
            if (user.email && window.median.onesignal.setEmail) {
                window.median.onesignal.setEmail(user.email);
            }
            if (user.phone && window.median.onesignal.setSMSNumber) {
                window.median.onesignal.setSMSNumber(user.phone);
            }

            // Mark as synced
            hasSyncedRef.current = true;
            console.log('✅ OneSignal sync complete');

        } catch (err) {
            console.error('❌ OneSignal sync error:', err);
        }
    };

    useEffect(() => {
        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data }: any) => {
            if (data.session) {
                setAuthSession(data.session);
                syncUserToOneSignal(data.session.user);
            }
        });

        // 2. Auth State Change Listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth event:', event);
            setAuthSession(session);

            if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                syncUserToOneSignal(session.user);
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                }
            }
        });

        // 🎯 DEFERRED NAVIGATION LOGIC
        // This function attempts to navigate if a pending route exists and session is ready
        const processPendingRoute = () => {
            const pendingRoute = localStorage.getItem('pending_push_route');
            if (pendingRoute && authSession) {
                console.log('🚀 [Deferred] Navigating to pending route:', pendingRoute);
                localStorage.removeItem('pending_push_route');

                // Use router.push for smooth SPA navigation
                // Wrap in a tiny timeout to ensure router is ready
                setTimeout(() => {
                    if (pendingRoute.startsWith('http')) {
                        window.location.href = pendingRoute;
                    } else {
                        router.push(pendingRoute);
                    }
                }, 100);
            }
        };

        // Run whenever this mount/update occurs
        processPendingRoute();

        // 3. OneSignal Push Opened Handler (Capture Only)
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

                // Re-run processing logic (in case we are already authenticated)
                processPendingRoute();
            }
        };

        // 4. Register Median Bridge
        const registerBridge = async () => {
            // Check if boot script captured anything
            if (window.PENDING_PUSH_PAYLOAD) {
                handlePushOpened(window.PENDING_PUSH_PAYLOAD);
                window.PENDING_PUSH_PAYLOAD = null;
            }

            const waitForMedianReady = () => {
                return new Promise<boolean>((resolve) => {
                    if (window.median?.onesignal) return resolve(true);
                    let iters = 0;
                    const check = setInterval(() => {
                        iters++;
                        if (window.median?.onesignal) {
                            clearInterval(check);
                            resolve(true);
                        } else if (iters > 100) {
                            clearInterval(check);
                            resolve(false);
                        }
                    }, 100);
                });
            };

            const isReady = await waitForMedianReady();
            if (isReady && window.median?.onesignal?.onNotificationOpened) {
                console.log('📲 OneSignal bridge registered');
                window.median.onesignal.onNotificationOpened(handlePushOpened);
            }

            // Standard Global Fallbacks
            window.median_onesignal_push_opened = handlePushOpened;
            window.gonative_onesignal_push_opened = handlePushOpened;
        };

        registerBridge();

        return () => {
            authSubscription.unsubscribe();
        };
    }, [router, authSession]); // Re-run when session or router changes

    return null;
}
