'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getOneSignalStats } from '@/app/actions/onesignal';

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
        if (!user) return;

        try {
            console.log('📱 Syncing User to OneSignal:', user.email);

            let identityHash = '';
            try {
                identityHash = (await getOneSignalStats(user.id)) || '';
            } catch (e) {
                console.warn('⚠️ Could not generate OneSignal Identity Hash locally');
            }

            if (!identityHash) {
                console.warn('⚠️ No Identity Hash generated - check ONESIGNAL_REST_API_KEY if Identity Verification is enabled');
            } else {
                console.log('🔐 Identity Hash generated');
            }

            const waitForMedian = () => {
                return new Promise<boolean>((resolve) => {
                    // Check if OneSignal bridge exists
                    if (window.median?.onesignal) return resolve(true);

                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        if (window.median?.onesignal) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (attempts > 50) { // 5 seconds timeout
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 100);
                });
            };

            const hasMedian = await waitForMedian();
            if (!hasMedian) {
                console.warn('⚠️ Median bridge not available for OneSignal sync - retrying in 3s...');
                // Retry once after a delay if bridge failed
                setTimeout(() => syncUserToOneSignal(user), 3000);
                return;
            }

            const externalId = user.id;
            console.log('📲 Setting External ID:', externalId);

            // TRY ALL METHODS - OneSignal SDK versions have changed method names
            // 1. New V4/V5 method
            if (window.median.onesignal.login) {
                console.log('🔹 Using onesignal.login()');
                if (identityHash) {
                    window.median.onesignal.login(externalId, identityHash);
                } else {
                    window.median.onesignal.login(externalId);
                }
            }
            // 2. Older method
            else if (window.median.onesignal.setExternalUserId) {
                console.log('🔹 Using onesignal.setExternalUserId()');
                if (identityHash) {
                    window.median.onesignal.setExternalUserId(externalId, identityHash);
                } else {
                    window.median.onesignal.setExternalUserId(externalId);
                }
            }
            // 3. Fallback generic run wrapper if available
            else if (window.median.run) {
                console.log('🔹 Using median.run to inject OneSignal code');
                window.median.run(`
                    if (window.OneSignal) {
                        var extId = '${externalId}';
                        var hash = '${identityHash || ''}';
                        if (window.OneSignal.login) {
                             window.OneSignal.login(extId, hash);
                        } else if (window.OneSignal.setExternalUserId) {
                             window.OneSignal.setExternalUserId(extId, hash);
                        }
                    }
                `);
            }

            // Sync email and phone if available
            if (user.email && window.median.onesignal.setEmail) {
                if (identityHash) {
                    window.median.onesignal.setEmail(user.email, identityHash);
                } else {
                    window.median.onesignal.setEmail(user.email);
                }
            }

            // Log success
            console.log('✅ OneSignal sync command sent');
            hasSyncedRef.current = true;

        } catch (err) {
            console.error('❌ OneSignal sync error:', err);
        }
    };

    useEffect(() => {
        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data }: any) => {
            if (data.session?.user) {
                setAuthSession(data.session);
                syncUserToOneSignal(data.session.user);
            }
        });

        // 2. Auth State Change Listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth event:', event);
            setAuthSession(session);

            if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
                // Always attempt sync on valid session events to ensure ID is set
                syncUserToOneSignal(session.user);
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                } else if (window.median?.onesignal?.removeExternalUserId) {
                    window.median.onesignal.removeExternalUserId();
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
