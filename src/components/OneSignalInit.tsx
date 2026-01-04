'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getOneSignalIdentityHash } from '@/app/actions/onesignal';

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
            console.log('📱 [OneSignal] Starting sync for:', user.email);

            // 1. Generate Identity Hashes (for Identity Verification)
            // OneSignal requires distinct hashes for the ID and the Email if verification is enabled.
            let idHash = '';
            let emailHash = '';

            try {
                const [idResult, emailResult] = await Promise.all([
                    getOneSignalIdentityHash(user.id),
                    user.email ? getOneSignalIdentityHash(user.email) : Promise.resolve(null)
                ]);
                idHash = idResult || '';
                emailHash = emailResult || '';
                console.log('🔐 [OneSignal] Identity hashes prepared');
            } catch (e) {
                console.warn('⚠️ [OneSignal] Could not generate Identity Hashes');
            }

            // 2. Wait for Median Bridge
            const waitForMedian = () => {
                return new Promise<boolean>((resolve) => {
                    if (window.median?.onesignal) return resolve(true);

                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        if (window.median?.onesignal) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (attempts > 100) { // 10 seconds timeout (increased for reliability)
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 100);
                });
            };

            const hasMedian = await waitForMedian();
            if (!hasMedian) {
                console.warn('⚠️ [OneSignal] Median bridge not available after timeout - sync failed');
                return;
            }

            const externalId = user.id;
            const onesignal = window.median.onesignal;

            // 3. Set External ID (Primary User Identification)
            // We use the Supabase User ID as the OneSignal External ID
            if (onesignal.login) {
                console.log('🔹 [OneSignal] Syncing External ID via login()');
                onesignal.login(externalId, idHash || undefined);
            } else if (onesignal.setExternalUserId) {
                console.log('🔹 [OneSignal] Syncing External ID via setExternalUserId()');
                onesignal.setExternalUserId(externalId, idHash || undefined);
            }

            // 4. Set Email (For notification deliverability)
            if (user.email && onesignal.setEmail) {
                console.log('🔹 [OneSignal] Syncing Email');
                onesignal.setEmail(user.email, emailHash || undefined);
            }

            // 5. Secondary Link (Save Player ID to our DB for backend push)
            // Attempt to get the OneSignal ID (Player ID) and link it in our backend
            const getOneSignalId = () => {
                return new Promise<string | null>((resolve) => {
                    if (onesignal.onesignal_id) return resolve(onesignal.onesignal_id);
                    if (onesignal.playerId) return resolve(onesignal.playerId);

                    // Fallback to getPlayerId callback if available
                    if (onesignal.getPlayerId) {
                        onesignal.getPlayerId((id: string) => resolve(id));
                    } else {
                        resolve(null);
                    }
                });
            };

            const oneSignalId = await getOneSignalId();
            if (oneSignalId) {
                console.log('🔗 [OneSignal] Linking ID in backend:', oneSignalId);
                await fetch('/api/onesignal/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oneSignalId })
                }).catch(err => console.error('❌ [OneSignal] Backend link failed:', err));
            }

            console.log('✅ [OneSignal] Sync sequence complete');
            hasSyncedRef.current = true;

        } catch (err) {
            console.error('❌ [OneSignal] Sync error:', err);
        }
    };

    useEffect(() => {
        // 1. Auth State Monitoring
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 [Auth] Event:', event);

            if (session?.user) {
                setAuthSession(session);
                // Trigger sync on sign in or initial load
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                    syncUserToOneSignal(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                setAuthSession(null);
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                } else if (window.median?.onesignal?.removeExternalUserId) {
                    window.median.onesignal.removeExternalUserId();
                }
            }
        });

        // 2. Initial Session Check (Bootstrap)
        supabase.auth.getSession().then(({ data }: any) => {
            if (data.session?.user) {
                setAuthSession(data.session);
                syncUserToOneSignal(data.session.user);
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
