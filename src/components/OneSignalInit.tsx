'use client';

import { useEffect } from 'react';

declare global {
    interface Window {
        OneSignal?: any;
    }
}

export default function OneSignalInit() {
    useEffect(() => {
        // Only run client-side
        if (typeof window === 'undefined') return;

        // Wait for OneSignal to be available (loaded by Median)
        const checkOneSignal = () => {
            if (!window.OneSignal) {
                console.log('⏳ Waiting for OneSignal to load...');
                setTimeout(checkOneSignal, 1000);
                return;
            }

            console.log('✅ OneSignal SDK detected');

            // Get current user from storage
            const getUserId = () => {
                try {
                    const sessionData = sessionStorage.getItem('user');
                    const localData = localStorage.getItem('user');
                    const userData = sessionData || localData;

                    if (userData) {
                        const user = JSON.parse(userData);
                        return user?.id;
                    }
                } catch (error) {
                    console.error('Error getting user ID:', error);
                }
                return null;
            };

            const userId = getUserId();

            if (!userId) {
                console.log('⚠️ No user logged in, skipping OneSignal setup');
                // Retry after some time in case user logs in later
                setTimeout(checkOneSignal, 5000);
                return;
            }

            console.log('🔔 Setting up OneSignal for user:', userId);

            try {
                // Get the OneSignal Player ID
                window.OneSignal.getUserId((playerId: string) => {
                    if (playerId) {
                        console.log('📲 OneSignal Player ID:', playerId);

                        // Save Player ID to database
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
                        setTimeout(checkOneSignal, 5000);
                    }
                });
            } catch (error) {
                console.error('❌ Error setting up OneSignal:', error);
            }
        };

        // Start checking for OneSignal
        checkOneSignal();
    }, []);

    return null;
}
