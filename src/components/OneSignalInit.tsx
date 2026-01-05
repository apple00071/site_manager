'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Extend window for Median JS Bridge
declare global {
    interface Window {
        median: any;
    }
}

export default function OneSignalInit() {

    // Helper: Wait for Median Bridge to be injected
    function waitForMedianBridge(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (window.median?.onesignal) {
                    clearInterval(interval);
                    resolve();
                }
                if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve(); // Resolve anyway to let the specific checks handle it
                }
            }, 100);
        });
    }

    // Helper: Wait for OneSignal Subscription (Push Token/ID)
    function waitForOneSignalSubscription(timeout = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(async () => {
                try {
                    // Check if we have subscription info
                    // "info" is the method documented, but we check both just in case of version diffs
                    if (window.median?.onesignal?.info) {
                        const info = await window.median.onesignal.info();
                        // Ready if we have a OneSignal ID (Player ID) or Push Token
                        if (info && (info.oneSignalId || info.pushToken || info.subscription?.id)) {
                            console.log("✅ OneSignal Subscription Active:", info);
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    } else if (window.median?.onesignal?.onesignalInfo) {
                        const info = await window.median.onesignal.onesignalInfo();
                        if (info && (info.oneSignalId || info.pushToken)) {
                            console.log("✅ OneSignal Subscription Active (legacy):", info);
                            clearInterval(interval);
                            resolve();
                            return;
                        }
                    }
                } catch (e) {
                    // Ignore errors during polling
                }

                if (Date.now() - start > timeout) {
                    console.warn("⚠️ OneSignal subscription wait timed out, proceeding anyway...");
                    clearInterval(interval);
                    resolve();
                }
            }, 500);
        });
    }

    // ✅ THE FIX (FINAL & RELIABLE)
    async function registerPushAfterLogin(user: any) {
        if (!window.median?.onesignal) {
            console.warn("❌ Median OneSignal usage attempted but bridge not found.");
            return;
        }

        try {
            console.log("🔄 Starting Push Registration Sequence...");

            // 1. Ask permission explicitly
            if (window.median.onesignal.requestPermission) {
                console.log("📱 Requesting Permission...");
                await window.median.onesignal.requestPermission();
            }

            // 2. Wait for subscription
            console.log("⏳ Waiting for Subscription...");
            await waitForOneSignalSubscription();

            // 3. Bind identity
            const externalId = `user_${user.id}`;
            console.log("🔐 Binding Identity:", externalId);
            await window.median.onesignal.login(externalId);

            if (user.email) {
                console.log("📧 Setting Email:", user.email);
                await window.median.onesignal.setEmail(user.email);
            }

            if (user.phone || user.user_metadata?.phone_number) {
                const phone = user.phone || user.user_metadata?.phone_number;
                console.log("📞 Setting Phone:", phone);
                await window.median.onesignal.setSMSNumber(phone);
            }

            console.log("✅ Push Registration Complete");
        } catch (error) {
            console.error("❌ Push Registration Failed:", error);
        }
    }

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent: AuthChangeEvent, session: Session | null) => {
            const user = session?.user;

            if (authEvent === "SIGNED_IN" && user) {
                // Wait for bridge to inject before firing the logic
                await waitForMedianBridge();
                registerPushAfterLogin(user);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
