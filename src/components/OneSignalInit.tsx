'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * OneSignal Integration for Median Apps
 * 
 * IMPORTANT: For Median/GoNative apps, OneSignal is initialized NATIVELY by Median.
 * We should NOT load the OneSignal Web SDK or call init methods from JavaScript.
 * 
 * This component only calls Median's JS bridge methods to:
 * - Set External User ID (to link the device to our user)
 * - Set Email/Phone for targeting
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
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Check if Median bridge is available (we're in a Median app)
        const isMedianApp = (): boolean => {
            return typeof window.median?.onesignal?.login === 'function';
        };

        // Wait for Median bridge with polling
        const waitForMedian = (maxAttempts = 30, interval = 200): Promise<boolean> => {
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

        // Main sync function - ONLY uses Median bridge
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
            const phone = user.user_metadata?.phone_number || user.app_metadata?.phone_number;

            console.log('═══════════════════════════════════════');
            console.log('🎯 SYNCING USER TO ONESIGNAL VIA MEDIAN');
            console.log('   User ID:', userId);
            console.log('   Email:', email);
            console.log('   Phone:', phone);
            console.log('═══════════════════════════════════════');

            try {
                // 1. Set External User ID (links device to user)
                console.log('1️⃣ Setting External User ID...');
                window.median!.onesignal!.login(userId);
                console.log('   ✅ login() called');

                // 2. Set Email if available
                if (email) {
                    console.log('2️⃣ Setting Email...');
                    window.median!.onesignal!.setEmail(email);
                    console.log('   ✅ setEmail() called');
                }

                // 3. Set Phone if available
                if (phone) {
                    console.log('3️⃣ Setting Phone...');
                    window.median!.onesignal!.setSMSNumber(phone);
                    console.log('   ✅ setSMSNumber() called');
                }

                // 4. Get OneSignal info and save to our database (delayed to let SDK process)
                setTimeout(async () => {
                    try {
                        console.log('4️⃣ Getting OneSignal subscription info...');
                        const info = await window.median!.onesignal!.onesignalInfo();
                        console.log('   📊 OneSignal Info:', JSON.stringify(info));

                        if (info?.oneSignalUserId) {
                            console.log('5️⃣ Saving to database...');
                            const response = await fetch('/api/onesignal/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ playerId: info.oneSignalUserId }),
                            });
                            const result = await response.json();
                            console.log('   ✅ Database result:', result);
                        }
                    } catch (err) {
                        console.log('   ⚠️ Could not get/save OneSignal info:', err);
                    }
                }, 3000);

                hasSyncedRef.current = true;
                console.log('═══════════════════════════════════════');
                console.log('🎉 ONESIGNAL SYNC COMPLETE');
                console.log('═══════════════════════════════════════');

            } catch (err) {
                console.error('❌ OneSignal sync error:', err);
            }
        };

        // Set up auth state listener
        console.log('🔔 OneSignalInit mounted, setting up auth listener...');

        const { data: authData } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth event:', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    hasSyncedRef.current = false; // Reset for new sign in
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

        const subscription = authData?.subscription;

        // Check for existing session on mount
        supabase.auth.getSession().then(({ data }: any) => {
            if (data?.session?.user) {
                console.log('📱 Found existing session, syncing...');
                syncUserToOneSignal(data.session.user);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    return null;
}
