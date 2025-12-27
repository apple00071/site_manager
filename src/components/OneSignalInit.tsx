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
        gonative?: any; // Alternative Median bridge
    }
}

export default function OneSignalInit() {
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Helper function to check if Median bridge is available
        const isMedianBridgeAvailable = (): boolean => {
            const hasMedian = typeof window.median?.onesignal?.login === 'function';
            const hasGonative = typeof window.gonative !== 'undefined';
            console.log('🔍 Median Bridge Check:', { hasMedian, hasGonative });
            return hasMedian;
        };

        // Wait for Median bridge to be available (with timeout)
        const waitForMedianBridge = (maxAttempts = 10, interval = 500): Promise<boolean> => {
            return new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                    attempts++;
                    if (isMedianBridgeAvailable()) {
                        console.log(`✅ Median bridge found after ${attempts} attempts`);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        console.log(`⚠️ Median bridge not found after ${maxAttempts} attempts`);
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                };
                check();
            });
        };

        // Main sync function
        const syncWithOneSignal = async (targetUser: any) => {
            const userId = targetUser?.id;
            const email = targetUser?.email;
            const phone = targetUser?.user_metadata?.phone_number || targetUser?.app_metadata?.phone_number;

            if (!userId) {
                console.log('🔔 OneSignal: No user ID to sync');
                return;
            }

            // Prevent duplicate syncs
            if (hasSyncedRef.current) {
                console.log('🔔 OneSignal: Already synced, skipping');
                return;
            }

            console.log('========================================');
            console.log('🎯 OneSignal SYNC STARTING');
            console.log('User ID:', userId);
            console.log('Email:', email);
            console.log('Phone:', phone);
            console.log('========================================');

            // Wait for Median bridge
            const hasMedian = await waitForMedianBridge();

            if (hasMedian && window.median?.onesignal) {
                console.log('📲 Using MEDIAN JS Bridge');

                try {
                    // Step 1: Login (set External ID)
                    console.log('Step 1: Calling median.onesignal.login...');
                    window.median.onesignal.login(userId);
                    console.log('✅ median.onesignal.login() called with:', userId);

                    // Step 2: Set Email
                    if (email) {
                        console.log('Step 2: Calling median.onesignal.setEmail...');
                        window.median.onesignal.setEmail(email);
                        console.log('✅ median.onesignal.setEmail() called with:', email);
                    }

                    // Step 3: Set Phone
                    if (phone) {
                        console.log('Step 3: Calling median.onesignal.setSMSNumber...');
                        window.median.onesignal.setSMSNumber(phone);
                        console.log('✅ median.onesignal.setSMSNumber() called with:', phone);
                    }

                    // Step 4: Get OneSignal Info and save to DB
                    console.log('Step 4: Getting OneSignal info...');
                    setTimeout(async () => {
                        try {
                            const info = await window.median!.onesignal!.onesignalInfo();
                            console.log('📊 OneSignal Info:', info);

                            if (info?.oneSignalUserId) {
                                console.log('💾 Saving OneSignal ID to database:', info.oneSignalUserId);
                                const response = await fetch('/api/onesignal/subscribe', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ playerId: info.oneSignalUserId }),
                                });
                                const result = await response.json();
                                console.log('📊 DB Save Result:', result);
                            }
                        } catch (infoError) {
                            console.log('⚠️ Could not get OneSignal info:', infoError);
                        }
                    }, 2000); // Wait 2 seconds for OneSignal to process the login

                    hasSyncedRef.current = true;
                    console.log('========================================');
                    console.log('🎉 OneSignal SYNC COMPLETE');
                    console.log('========================================');

                } catch (err) {
                    console.error('❌ Median OneSignal Sync Error:', err);
                }
            } else {
                // Fallback: Try URL scheme bridge (gonative://)
                console.log('📲 Trying URL scheme bridge (gonative://)...');

                try {
                    // Create hidden iframe to trigger URL scheme
                    const triggerUrlScheme = (url: string) => {
                        console.log('Triggering:', url);
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = url;
                        document.body.appendChild(iframe);
                        setTimeout(() => document.body.removeChild(iframe), 100);
                    };

                    triggerUrlScheme(`gonative://onesignal/externalUserId/set?externalUserId=${encodeURIComponent(userId)}`);

                    if (email) {
                        setTimeout(() => {
                            triggerUrlScheme(`gonative://onesignal/setEmail?email=${encodeURIComponent(email)}`);
                        }, 500);
                    }

                    hasSyncedRef.current = true;
                    console.log('✅ URL scheme triggers sent');
                } catch (err) {
                    console.error('❌ URL scheme bridge error:', err);
                }
            }
        };

        // Listen for auth state changes
        console.log('🔔 OneSignalInit: Setting up auth listener...');
        const { data: authData } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth Event:', event, 'Has User:', !!session?.user);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    // Reset sync flag on new sign in
                    hasSyncedRef.current = false;
                    syncWithOneSignal(session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                }
            }
        });

        const subscription = authData?.subscription;

        // Check if already logged in on mount
        console.log('🔔 OneSignalInit: Checking existing session...');
        supabase.auth.getSession().then(({ data }: any) => {
            console.log('📊 Existing session check:', !!data?.session?.user);
            if (data?.session?.user) {
                syncWithOneSignal(data.session.user);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    return null;
}
