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

    // 2️⃣ After login, poll until subscription is ready
    async function waitForSubscription(timeout = 30000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            try {
                // Check if median exists first to avoid errors
                // We assume onesignalInfo based on user snippet, but check safe access
                if (window.median?.onesignal?.onesignalInfo) {
                    const info = await window.median.onesignal.onesignalInfo();

                    // User Rule: Check if subscribed and userId exists
                    if (info?.subscribed === true && info?.userId) {
                        return info;
                    }
                }
                // Fallback for different OS/Versions where 'info' might be used
                else if (window.median?.onesignal?.info) {
                    const info = await window.median.onesignal.info();
                    if (info?.subscribed === true && info?.userId) {
                        return info;
                    }
                }
            } catch (e) {
                // Ignore transient errors during polling
            }

            await new Promise(res => setTimeout(res, 700));
        }

        throw new Error("OneSignal subscription not ready");
    }

    // 3️⃣ Bind identity ONLY after that
    async function bindOneSignalIdentity(user: any) {
        // Basic check to bail if not in Median at all
        if (!window.median?.onesignal) return;

        try {
            console.log("⏳ [OneSignal] Waiting for native subscription...");

            // 🔑 Wait for native subscription to fully complete
            const subInfo = await waitForSubscription();
            console.log("✅ [OneSignal] Subscription Ready:", subInfo);

            // 🔑 NOW bind user
            const externalId = `user_${user.id}`;
            console.log(`🔐 [OneSignal] Binding Identity: ${externalId}`);
            await window.median.onesignal.login(externalId);

            if (user.email) {
                await window.median.onesignal.setEmail(user.email);
            }

            if (user.phone || user.user_metadata?.phone_number) {
                const phone = user.phone || user.user_metadata?.phone_number;
                await window.median.onesignal.setSMSNumber(phone);
            }

            console.log("✅ [OneSignal] Identity Binding Complete");

        } catch (e) {
            console.error("❌ [OneSignal] bind failed", e);
        }
    }

    // 4️⃣ Call ONLY after login success
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((authEvent: AuthChangeEvent, session: Session | null) => {
            const user = session?.user;

            if (authEvent === "SIGNED_IN" && user) {
                bindOneSignalIdentity(user);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
