'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        OneSignal?: any;
    }
}

export default function OneSignalInit() {
    useEffect(() => {
        // Only run client-side
        if (typeof window === 'undefined') return;

        const setupOneSignal = async () => {
            // Use the recommended OneSignal push queue pattern
            window.OneSignal = window.OneSignal || [];

            window.OneSignal.push(async () => {
                console.log('🔔 OneSignal SDK ready, attempting user identification...');

                // 1. Get current user from Supabase
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                const userId = user?.id;

                if (authError || !userId) {
                    console.log('⚠️ OneSignal: No active user session found. Waiting for login...');
                    return;
                }

                console.log('🎯 Identifying user in OneSignal:', userId);

                try {
                    // 2. Identify User (External ID)
                    // The standard modern way (Web SDK 16+)
                    if (typeof window.OneSignal.login === 'function') {
                        await window.OneSignal.login(userId);
                        console.log('✅ OneSignal.login successful');
                    } else if (typeof window.OneSignal.setExternalUserId === 'function') {
                        // Support for older SDK versions or specific wrappers
                        await window.OneSignal.setExternalUserId(userId);
                        console.log('✅ OneSignal.setExternalUserId successful');
                    }

                    // 3. Sync Email and Phone (to show in dashboard)
                    if (user?.email && window.OneSignal.User?.addEmail) {
                        window.OneSignal.User.addEmail(user.email);
                        console.log('📧 Email synced to OneSignal:', user.email);
                    }

                    // Note: Phone number is usually in user_metadata or app_metadata
                    const phone = user.user_metadata?.phone_number || user.app_metadata?.phone_number;
                    if (phone && window.OneSignal.User?.addSms) {
                        window.OneSignal.User.addSms(phone);
                        console.log('📱 Phone synced to OneSignal:', phone);
                    }

                    // 4. Median Native Bridge
                    // Ensures the native iOS/Android SDK is also informed of the user identity
                    const isMedian = typeof navigator !== 'undefined' && /GoNative/i.test(navigator.userAgent);
                    if (isMedian) {
                        console.log('📲 Triggering Median native bridge for External ID');
                        window.location.href = "gonative://onesignal/externalid/set?id=" + userId;
                    }

                    // 5. Backup: Sync OneSignal Player ID to our database
                    // This is still useful as a fallback for targeting
                    let playerId = null;

                    if (window.OneSignal.getUser && typeof window.OneSignal.getUser === 'function') {
                        // Web SDK 16+ way
                        const osUser = window.OneSignal.getUser();
                        playerId = osUser?.onesignalId;
                    } else if (typeof window.OneSignal.getUserId === 'function') {
                        // Older SDK way
                        playerId = await new Promise((resolve) => window.OneSignal.getUserId(resolve));
                    }

                    if (playerId) {
                        console.log('💾 Saving OneSignal ID to database:', playerId);
                        fetch('/api/onesignal/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ playerId }),
                        }).catch(e => console.error('Failed to sync OneSignal ID to DB', e));
                    }
                } catch (err) {
                    console.error('❌ OneSignal User Identification failed:', err);
                }
            });
        };

        // Initialize setup
        setupOneSignal();
    }, []);

    return null;
}
