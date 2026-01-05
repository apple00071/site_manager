'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
        gonative: any;
    }
}

const DEBUG = true; // Set to false after debugging

function log(msg: string, data?: any) {
    if (DEBUG) {
        // Prepare safe string for alert
        const dataStr = data ? JSON.stringify(data, null, 2) : '';
        alert(`[OS]: ${msg} ${dataStr}`);
    }
    console.log(`[OS]: ${msg}`, data);
}

export default function OneSignalInit() {

    // Helper: Wait for Median Bridge
    function waitForMedianOneSignal(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                // Strict check: wait for .login to be present
                if (
                    window.median?.onesignal &&
                    typeof window.median.onesignal.login === "function"
                ) {
                    clearInterval(interval);
                    resolve();
                }

                if (Date.now() - start > timeout) {
                    if (DEBUG) alert("⚠️ Median bridge Timed Out!");
                    clearInterval(interval);
                    resolve(); // Try anyway
                }
            }, 200);
        });
    }

    // Helper: Wait for Subscription
    function waitForOneSignalSubscription(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(async () => {
                try {
                    if (window.median?.onesignal?.info) {
                        const info = await window.median.onesignal.info();
                        if (info && (info.oneSignalId || info.pushToken || info.subscription?.id)) {
                            // log("Sub Active", info); // Too spammy for alert
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    } else if (window.median?.onesignal?.onesignalInfo) {
                        const info = await window.median.onesignal.onesignalInfo();
                        if (info && (info.oneSignalId || info.pushToken)) {
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    }
                } catch (e) { }

                if (Date.now() - start > timeout) {
                    if (DEBUG) alert("⚠️ Sub Wait Timed Out - No ID found");
                    clearInterval(interval);
                    resolve();
                }
            }, 500);
        });
    }

    async function registerPushAfterLogin(user: any) {
        if (DEBUG) alert("Starting Register Push Sequence");

        // Pre-flight check
        if (!window.median?.onesignal) {
            if (DEBUG) alert("❌ No median.onesignal found!");
            return;
        }

        try {
            // 1. Permission
            if (typeof window.median.onesignal.requestPermission === 'function') {
                if (DEBUG) alert("Requesting Permission...");
                await window.median.onesignal.requestPermission();
            } else {
                if (DEBUG) alert("⚠️ requestPermission function MISSING");
            }

            // 2. Subscription
            if (DEBUG) alert("Waiting for Sub ID...");
            await waitForOneSignalSubscription();

            // 3. Login
            const externalId = `user_${user.id}`;
            if (DEBUG) alert(`Logging in: ${externalId}`);
            await window.median.onesignal.login(externalId);

            // 4. Verification View
            if (DEBUG) {
                if (window.median.onesignal.info) {
                    const finalInfo = await window.median.onesignal.info();
                    alert("Final State: " + JSON.stringify(finalInfo));
                }
            }

            // Set extras silently
            if (user.email) await window.median.onesignal.setEmail(user.email);
            if (user.phone) await window.median.onesignal.setSMSNumber(user.phone);

        } catch (error: any) {
            if (DEBUG) alert("❌ Error: " + error.message);
        }
    }

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent: AuthChangeEvent, session: Session | null) => {
            const user = session?.user;

            // Only trigger on SIGNED_IN
            if (authEvent === "SIGNED_IN" && user) {
                if (DEBUG) alert("Auth: SIGNED_IN detected. Waiting for bridge...");

                await waitForMedianOneSignal();

                if (DEBUG) alert("Bridge Ready? " + (!!window.median?.onesignal));

                // Add Small delay to ensure bridge is chemically pure
                setTimeout(() => {
                    registerPushAfterLogin(user);
                }, 1000);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
