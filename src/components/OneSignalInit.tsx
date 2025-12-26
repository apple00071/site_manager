'use client';

import { useEffect } from 'react';

declare global {
    interface Window {
        OneSignal: unknown[];
    }
}

export default function OneSignalInit() {
    useEffect(() => {
        // Only initialize in production or when running in Median app
        const isMedianApp = typeof window !== 'undefined' &&
            (window.navigator.userAgent.includes('gonative') ||
                window.navigator.userAgent.includes('median'));

        // Skip initialization in development unless it's Median
        if (process.env.NODE_ENV === 'development' && !isMedianApp) {
            console.log('Skipping OneSignal initialization in development');
            return;
        }

        // Initialize OneSignal
        window.OneSignal = window.OneSignal || [];
        const OneSignal = window.OneSignal;

        OneSignal.push(() => {
            OneSignal.push(['init', {
                appId: 'd080d582-0b88-431c-bb19-59a08f7f5379',
                safari_web_id: 'web.onesignal.auto.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                notifyButton: {
                    enable: false, // Don't show the default notification button
                },
                allowLocalhostAsSecureOrigin: true,
            }]);

            // Get current user from localStorage or session
            const getUserId = () => {
                try {
                    // Try to get user from session storage
                    const userData = sessionStorage.getItem('user');
                    if (userData) {
                        const user = JSON.parse(userData);
                        return user?.id;
                    }
                    return null;
                } catch (error) {
                    console.error('Error getting user ID:', error);
                    return null;
                }
            };

            const userId = getUserId();

            // Set external user ID if user is logged in
            if (userId) {
                OneSignal.push(['setExternalUserId', userId]);
                console.log('OneSignal: External User ID set:', userId);
            }

            // Listen for subscription changes
            OneSignal.push(['addListenerForNotificationOpened', (data: unknown) => {
                console.log('Notification opened:', data);
                // Handle notification click if needed
            }]);

            // Get the OneSignal Player ID and save it to the database
            OneSignal.push(['getUserId', async (playerId: string) => {
                if (playerId && userId) {
                    console.log('OneSignal Player ID:', playerId);

                    // Save to database
                    try {
                        const response = await fetch('/api/onesignal/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ playerId }),
                        });

                        if (response.ok) {
                            console.log('✅ OneSignal Player ID saved to database');
                        } else {
                            console.error('Failed to save OneSignal Player ID');
                        }
                    } catch (error) {
                        console.error('Error saving OneSignal Player ID:', error);
                    }
                }
            }]);
        });
    }, []);

    return null; // This component doesn't render anything
}
