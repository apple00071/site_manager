'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Declare global types for Median JS Bridge
declare global {
    interface Window {
        OneSignal?: any;
        median?: {
            onesignal?: {
                login: (externalId: string) => void;
                logout: () => void;
                setEmail: (email: string) => void;
                setSMSNumber: (phone: string) => void;
                onesignalInfo: () => Promise<{
                    oneSignalUserId: string;
                    oneSignalPushToken: string;
                    oneSignalSubscribed: boolean;
                }>;
            };
        };
    }
}

export default function OneSignalInit() {
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncWithOneSignal = async (targetUser: any) => {
            const userId = targetUser?.id;
            const email = targetUser?.email;
            const phone = targetUser?.user_metadata?.phone_number || targetUser?.app_metadata?.phone_number;

            if (!userId) {
                console.log('🔔 OneSignal: No user to sync');
                return;
            }

            console.log('🎯 OneSignal Syncing:', { userId, email, phone });

            // Check if running in Median native app
            const isMedian = typeof window.median?.onesignal !== 'undefined';

            if (isMedian) {
                // Use Median JS Bridge (recommended for Median apps)
                console.log('📲 Using Median JS Bridge for OneSignal sync');

                try {
                    // Set External ID (links this device to the user)
                    window.median!.onesignal!.login(userId);
                    console.log('✅ Median: External ID set to:', userId);

                    // Set Email (appears in dashboard)
                    if (email) {
                        window.median!.onesignal!.setEmail(email);
                        console.log('📧 Median: Email set to:', email);
                    }

                    // Set Phone (appears in dashboard)
                    if (phone) {
                        window.median!.onesignal!.setSMSNumber(phone);
                        console.log('📱 Median: Phone set to:', phone);
                    }

                    // Backup: Sync OneSignal User ID to our database
                    try {
                        const info = await window.median!.onesignal!.onesignalInfo();
                        if (info?.oneSignalUserId) {
                            console.log('💾 Syncing OneSignal ID to DB:', info.oneSignalUserId);
                            fetch('/api/onesignal/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ playerId: info.oneSignalUserId }),
                            }).catch(() => { });
                        }
                    } catch (infoError) {
                        console.log('OneSignal info not available yet, will sync later');
                    }
                } catch (err) {
                    console.error('❌ Median OneSignal Sync Failed:', err);
                }
            } else {
                // Fallback: Use standard OneSignal Web SDK (for non-Median browsers)
                console.log('🌐 Using OneSignal Web SDK (non-Median environment)');
                window.OneSignal = window.OneSignal || [];

                window.OneSignal.push(async () => {
                    try {
                        if (typeof window.OneSignal.login === 'function') {
                            await window.OneSignal.login(userId);
                            console.log('✅ Web SDK: OneSignal.login successful');
                        }

                        if (email && window.OneSignal.User?.addEmail) {
                            window.OneSignal.User.addEmail(email);
                        }
                        if (phone && window.OneSignal.User?.addSms) {
                            window.OneSignal.User.addSms(phone);
                        }
                    } catch (err) {
                        console.error('❌ OneSignal Web SDK Sync Failed:', err);
                    }
                });
            }
        };

        // Listen for auth state changes
        const { data: authData } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth State Change in OneSignalInit:', event);
            if (event === 'SIGNED_IN' || (event as string) === 'INITIAL_SESSION') {
                if (session?.user) {
                    syncWithOneSignal(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                // Logout from OneSignal
                if (window.median?.onesignal) {
                    window.median.onesignal.logout();
                } else {
                    window.OneSignal?.push(() => {
                        if (window.OneSignal.logout) window.OneSignal.logout();
                    });
                }
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
            subscription?.unsubscribe();
        };
    }, []);

    return null;
}
