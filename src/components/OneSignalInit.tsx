'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        OneSignal?: any;
    }
}

export default function OneSignalInit() {
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Use the recommended OneSignal push queue pattern
        window.OneSignal = window.OneSignal || [];

        const syncWithOneSignal = async (targetUser: any) => {
            const userId = targetUser?.id;
            const email = targetUser?.email;
            const phone = targetUser?.user_metadata?.phone_number || targetUser?.app_metadata?.phone_number;

            if (!userId) {
                console.log('🔔 OneSignal: No user to sync');
                return;
            }

            console.log('🎯 OneSignal Syncing:', { userId, email, phone });

            // 1. Median Native Bridge (Most reliable for Median apps)
            const isMedian = typeof navigator !== 'undefined' && /GoNative/i.test(navigator.userAgent);

            if (isMedian) {
                console.log('📲 Using Median JS Bridge for OneSignal sync');

                // Set External ID
                window.location.href = `gonative://onesignal/externalid/set?id=${userId}`;

                // Set Email (if available)
                if (email) {
                    window.location.href = `gonative://onesignal/email/set?email=${encodeURIComponent(email)}`;
                }

                // Set Phone (if available)
                if (phone) {
                    window.location.href = `gonative://onesignal/user/addSms?phone=${encodeURIComponent(phone)}`;
                }
            }

            // 2. OneSignal Web SDK (Standard way)
            window.OneSignal.push(async () => {
                try {
                    console.log('🐝 OneSignal SDK push queue processing...');

                    // Identify User (External ID)
                    if (typeof window.OneSignal.login === 'function') {
                        await window.OneSignal.login(userId);
                        console.log('✅ Web SDK OneSignal.login successful');
                    } else if (typeof window.OneSignal.setExternalUserId === 'function') {
                        await window.OneSignal.setExternalUserId(userId);
                        console.log('✅ Web SDK OneSignal.setExternalUserId successful');
                    }

                    // Sync Email/Phone
                    if (email && window.OneSignal.User?.addEmail) {
                        window.OneSignal.User.addEmail(email);
                    }
                    if (phone && window.OneSignal.User?.addSms) {
                        window.OneSignal.User.addSms(phone);
                    }

                    // Backup: Store Player ID to our DB
                    let playerId = null;
                    if (window.OneSignal.getUser) {
                        const osUser = window.OneSignal.getUser();
                        playerId = osUser?.onesignalId;
                    } else if (window.OneSignal.getUserId) {
                        playerId = await new Promise((resolve) => window.OneSignal.getUserId(resolve));
                    }

                    if (playerId) {
                        console.log('💾 Backup: Syncing Player ID to DB:', playerId);
                        fetch('/api/onesignal/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ playerId }),
                        }).catch(() => { });
                    }
                } catch (err) {
                    console.error('❌ OneSignal Web SDK Sync Failed:', err);
                }
            });
        };

        // Listen for auth state changes
        const { data: authData } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth State Change in OneSignalInit:', event);
            if (event === 'SIGNED_IN' || (event as string) === 'INITIAL_SESSION') {
                if (session?.user) {
                    syncWithOneSignal(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                // Optional: Logout from OneSignal
                window.OneSignal.push(() => {
                    if (window.OneSignal.logout) window.OneSignal.logout();
                });
            }
        });

        const subscription = authData?.subscription;

        // Initial sync if already logged in
        if (isFirstRun.current) {
            isFirstRun.current = false;
            supabase.auth.getUser().then(({ data }: any) => {
                if (data?.user) syncWithOneSignal(data.user);
            });
        }

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
