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
                requestPermission: () => void; // Android 13+ permission request
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
    const hasRequestedPermissionRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Helper function to check if Median bridge is available
        const isMedianBridgeAvailable = (): boolean => {
            const hasMedian = typeof window.median?.onesignal?.login === 'function';
            console.log('🔍 Median Bridge Available:', hasMedian);
            return hasMedian;
        };

        // Wait for Median bridge to be available (with timeout)
        const waitForMedianBridge = (maxAttempts = 20, interval = 300): Promise<boolean> => {
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

        // Request notification permission (Android 13+)
        const requestNotificationPermission = async () => {
            if (hasRequestedPermissionRef.current) return;

            console.log('📲 Requesting notification permission...');

            const hasMedian = await waitForMedianBridge(10, 500);

            if (hasMedian && window.median?.onesignal?.requestPermission) {
                try {
                    window.median.onesignal.requestPermission();
                    hasRequestedPermissionRef.current = true;
                    console.log('✅ Permission request triggered via Median bridge');
                } catch (err) {
                    console.error('❌ Failed to request permission:', err);
                }
            } else {
                // Fallback: Try URL scheme
                console.log('📲 Trying URL scheme for permission request...');
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = 'gonative://onesignal/requestPermission';
                    document.body.appendChild(iframe);
                    setTimeout(() => document.body.removeChild(iframe), 100);
                    hasRequestedPermissionRef.current = true;
                    console.log('✅ Permission request triggered via URL scheme');
                } catch (err) {
                    console.error('❌ URL scheme failed:', err);
                }
            }
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
                    }, 2000);

                    hasSyncedRef.current = true;
                    console.log('========================================');
                    console.log('🎉 OneSignal SYNC COMPLETE');
                    console.log('========================================');

                } catch (err) {
                    console.error('❌ Median OneSignal Sync Error:', err);
                }
            } else {
                // Fallback: Try URL scheme bridge
                console.log('📲 Trying URL scheme bridge (gonative://)...');

                try {
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
                    // First request permission, then sync user data
                    requestNotificationPermission().then(() => {
                        syncWithOneSignal(session.user);
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                hasSyncedRef.current = false;
                if (window.median?.onesignal?.logout) {
                    window.median.onesignal.logout();
                }
            }
        });

        const subscription = authData?.subscription;

        // Request permission on app load (for Android 13+)
        requestNotificationPermission();

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
