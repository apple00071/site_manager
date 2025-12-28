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
                setExternalUserId: (externalId: string) => void; // Alternative method
                onesignalInfo: () => Promise<{
                    oneSignalUserId: string;
                    oneSignalPushToken: string;
                    oneSignalSubscribed: boolean;
                    externalUserId?: string;
                }>;
            };
        };
        // Also check for global OneSignal Web SDK (fallback)
        OneSignal?: {
            login: (externalId: string) => Promise<void>;
            User?: {
                addAlias: (label: string, id: string) => void;
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
            return typeof window.median?.onesignal !== 'undefined';
        };

        // Wait for Median bridge with polling
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
            console.log('   Available methods:', Object.keys(window.median?.onesignal || {}));
            console.log('═══════════════════════════════════════');

            try {
                // 0. Request notification permission FIRST (Android 13+ requirement)
                if (window.median?.onesignal?.requestPermission) {
                    console.log('0️⃣ Requesting notification permission (Android 13+)...');
                    window.median.onesignal.requestPermission();
                    // Wait for permission dialog to process
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 1. Set External User ID - try multiple methods
                console.log('1️⃣ Setting External User ID...');

                // Method A: login() - Median's recommended method
                if (typeof window.median?.onesignal?.login === 'function') {
                    try {
                        window.median.onesignal.login(userId);
                        console.log('   ✅ login() called with:', userId);
                    } catch (e) {
                        console.log('   ⚠️ login() failed:', e);
                    }
                }

                // Method B: setExternalUserId() - Alternative/legacy method
                if (typeof window.median?.onesignal?.setExternalUserId === 'function') {
                    try {
                        window.median.onesignal.setExternalUserId(userId);
                        console.log('   ✅ setExternalUserId() called with:', userId);
                    } catch (e) {
                        console.log('   ⚠️ setExternalUserId() failed:', e);
                    }
                }

                // Method C: Global OneSignal SDK (if available)
                if (typeof window.OneSignal?.login === 'function') {
                    try {
                        await window.OneSignal.login(userId);
                        console.log('   ✅ OneSignal.login() called with:', userId);
                    } catch (e) {
                        console.log('   ⚠️ OneSignal.login() failed:', e);
                    }
                }

                // 2. Set Email if available
                if (email && typeof window.median?.onesignal?.setEmail === 'function') {
                    console.log('2️⃣ Setting Email...');
                    try {
                        window.median.onesignal.setEmail(email);
                        console.log('   ✅ setEmail() called');
                    } catch (e) {
                        console.log('   ⚠️ setEmail() failed:', e);
                    }
                }

                // 3. Set Phone if available
                if (phone && typeof window.median?.onesignal?.setSMSNumber === 'function') {
                    console.log('3️⃣ Setting Phone...');
                    try {
                        window.median.onesignal.setSMSNumber(phone);
                        console.log('   ✅ setSMSNumber() called');
                    } catch (e) {
                        console.log('   ⚠️ setSMSNumber() failed:', e);
                    }
                }

                // 4. Get OneSignal info and save to our database
                // Use longer delay (8s) for the SDK to process all the above calls
                setTimeout(async () => {
                    try {
                        console.log('4️⃣ Getting OneSignal subscription info...');

                        if (typeof window.median?.onesignal?.onesignalInfo === 'function') {
                            const info = await window.median.onesignal.onesignalInfo();
                            console.log('   📊 OneSignal Info:', JSON.stringify(info, null, 2));

                            if (info?.oneSignalUserId) {
                                console.log('5️⃣ Saving to database...');
                                const response = await fetch('/api/onesignal/subscribe', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        playerId: info.oneSignalUserId,
                                        externalUserId: userId
                                    }),
                                });
                                const result = await response.json();
                                console.log('   ✅ Database result:', result);

                                // Log if external ID was set
                                if (info.externalUserId) {
                                    console.log('   ✅ External User ID confirmed:', info.externalUserId);
                                } else {
                                    console.log('   ⚠️ External User ID NOT set in OneSignal yet');
                                    console.log('   ℹ️ This may take a few moments to sync');
                                }
                            } else {
                                console.log('   ⚠️ No OneSignal User ID - permission may not be granted');
                            }
                        } else {
                            console.log('   ⚠️ onesignalInfo() not available');
                        }
                    } catch (err) {
                        console.log('   ⚠️ Could not get/save OneSignal info:', err);
                    }
                }, 8000);

                hasSyncedRef.current = true;
                console.log('═══════════════════════════════════════');
                console.log('🎉 ONESIGNAL SYNC INITIATED');
                console.log('   Note: External ID sync may take a few seconds');
                console.log('═══════════════════════════════════════');

            } catch (err) {
                console.error('❌ OneSignal sync error:', err);
            }
        };

        // Set up auth state listener
        console.log('🔔 OneSignalInit mounted, setting up auth listener...');

        const { data: authData } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log('🔑 Auth event:', event);

            // Sync on sign-in and also on INITIAL_SESSION (for page refresh)
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    // Reset sync flag on new sign in
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
