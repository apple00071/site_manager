'use client';

import { useEffect, useRef } from 'react';
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
        // alert(`[OS]: ${msg} ${dataStr}`); 
        // Commented out general log alert to reduce noise, kept explicit alerts below
    }
    console.log(`[OS]: ${msg}`, data);
}

export default function OneSignalInit() {
    const mounted = useRef(false);

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
        if (DEBUG) alert(`⏩ Starting Sync for: ${user.email || user.id}`);

        // Pre-flight check
        if (!window.median?.onesignal) {
            if (DEBUG) alert("❌ No median.onesignal found!");
            return;
        }

        try {
            // 1. Permission
            if (typeof window.median.onesignal.requestPermission === 'function') {
                // Only alert if we think we need to
                // alert("Requesting Permission..."); 
                await window.median.onesignal.requestPermission();
            } else {
                if (DEBUG) alert("⚠️ requestPermission function MISSING");
            }

            // 2. Subscription
            // alert("Waiting for Sub ID...");
            await waitForOneSignalSubscription();

            // 3. Login
            const externalId = `user_${user.id}`;
            // alert(`Logging in: ${externalId}`);
            await window.median.onesignal.login(externalId);

            // 4. Verification View
            if (DEBUG) {
                if (window.median.onesignal.info) {
                    const finalInfo = await window.median.onesignal.info();
                    alert("✅ SUCCESS: " + JSON.stringify(finalInfo));
                } else {
                    alert("✅ SUCCESS (No info)");
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
        if (mounted.current) return;
        mounted.current = true;

        if (DEBUG) alert("✅ Component MOUNTED");

        // 1. Check existing session immediately
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                if (DEBUG) alert("Found Session on Load");
                await waitForMedianOneSignal();
                setTimeout(() => registerPushAfterLogin(session.user), 1000);
            } else {
                if (DEBUG) alert("No Session on Load");
            }
        };
        checkSession();

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent: AuthChangeEvent, session: Session | null) => {

            // Only trigger on explicit SIGNED_IN (ignore INITIAL_SESSION since we handled it above)
            if (authEvent === "SIGNED_IN" && session?.user) {
                if (DEBUG) alert("Event: SIGNED_IN");
                await waitForMedianOneSignal();
                setTimeout(() => registerPushAfterLogin(session.user), 1000);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
