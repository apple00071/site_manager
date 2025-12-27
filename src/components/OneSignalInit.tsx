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
            // Wait for OneSignal to be available
            if (!window.OneSignal) {
                console.log('⏳ Waiting for OneSignal to load...');
                setTimeout(setupOneSignal, 1000);
                return;
            }

            console.log('✅ OneSignal SDK detected');

            // Get current user from Supabase
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;

            if (!userId) {
                console.log('⚠️ No user logged in, will retry OneSignal setup later');
                setTimeout(setupOneSignal, 5000);
                return;
            }

            console.log('🔔 Setting up OneSignal for user:', userId);

            try {
                // 1. Set External User ID (Best for Median/Native apps)
                // This allows targeting by our database userId
                if (window.OneSignal.setExternalUserId) {
                    window.OneSignal.setExternalUserId(userId);
                    console.log('📲 OneSignal External User ID set:', userId);
                }

                // Median-specific bridge for OneSignal External ID
                const isMedian = typeof navigator !== 'undefined' && /GoNative/i.test(navigator.userAgent);
                if (isMedian) {
                    window.location.href = "gonative://onesignal/externalid/set?id=" + userId;
                    console.log('📲 Median External ID bridge called');
                }

                // 2. Get the OneSignal Player ID and save it as backup
                window.OneSignal.getUserId((playerId: string) => {
                    if (playerId) {
                        console.log('📲 OneSignal Player ID:', playerId);

                        // Save Player ID to database as backup
                        fetch('/api/onesignal/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ playerId }),
                        })
                            .then(response => {
                                if (response.ok) {
                                    console.log('✅ OneSignal Player ID saved to database!');
                                } else {
                                    console.error('❌ Failed to save OneSignal Player ID');
                                }
                            })
                            .catch(error => {
                                console.error('❌ Error saving OneSignal Player ID:', error);
                            });
                    } else {
                        console.log('⚠️ No Player ID available yet, will retry...');
                        setTimeout(setupOneSignal, 5000);
                    }
                });
            } catch (error) {
                console.error('❌ Error setting up OneSignal:', error);
            }
        };

        // Start checking for OneSignal
        setupOneSignal();
    }, []);

    return null;
}
