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

export default function OneSignalInit() {

    // 1️⃣ Hard check: Median environment
    function isRunningInMedian() {
        return (
            typeof window !== "undefined" &&
            !!window.median &&
            !!window.median.onesignal
        );
    }

    // 2️⃣ Wait for Median OneSignal bridge
    function waitForMedianOneSignal(timeout = 15000): Promise<void> {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const interval = setInterval(() => {
                if (
                    window.median?.onesignal &&
                    typeof window.median.onesignal.login === "function"
                ) {
                    clearInterval(interval);
                    resolve();
                }

                if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject("Median OneSignal bridge not ready");
                }
            }, 400);
        });
    }

    // 3️⃣ Identity sync (FINAL)
    async function syncIdentityToOneSignal(user: {
        id: string;
        email?: string;
        phone?: string;
    }) {
        if (!isRunningInMedian()) return;

        try {
            // 1. Wait for native bridge
            await waitForMedianOneSignal();

            // 2. Request permission (Android 13+)
            if (window.median.onesignal.requestPermission) {
                await window.median.onesignal.requestPermission();
            }

            // 3. Login (this sets External ID)
            const externalId = `user_${user.id}`;
            await window.median.onesignal.login(externalId);

            // 4. Optional attributes
            if (user.email) {
                await window.median.onesignal.setEmail(user.email);
            }

            if (user.phone) {
                await window.median.onesignal.setSMSNumber(user.phone);
            }

            // 5. Verify
            if (window.median.onesignal.onesignalInfo) {
                const info = await window.median.onesignal.onesignalInfo();
                console.log("✅ OneSignal identity synced:", info);
            } else if (window.median.onesignal.info) {
                // Fallback if onesignalInfo isn't present but info is (documentation mismatch coverage)
                const info = await window.median.onesignal.info();
                console.log("✅ OneSignal identity synced (via info):", info);
            }

        } catch (e) {
            console.error("❌ OneSignal identity sync failed", e);
        }
    }

    // 4️⃣ Call it ONLY on real login
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((authEvent: AuthChangeEvent, session: Session | null) => {
            const user = session?.user;

            if (authEvent === "SIGNED_IN" && user) {
                syncIdentityToOneSignal({
                    id: user.id,
                    email: user.email,
                    phone: user.user_metadata?.phone_number
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
