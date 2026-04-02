const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === 'true' || true;

// Use new API endpoint per OneSignal migration guide
const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

interface SendNotificationParams {
    userIds?: string[]; // OneSignal IDs (V5 UUIDs)
    externalUserIds?: string[]; // Database user IDs (e.g. user_UUID)
    title: string;
    message: string;
    data?: Record<string, unknown>; // Optional custom data
    url?: string; // Launch URL
    targetUrl?: string; // App-specific internal navigation URL
}

/**
 * Send push notification to specific users via OneSignal
 * Supports both Player IDs (Subscription IDs) and External User IDs
 */
export async function sendPushNotification(params: SendNotificationParams): Promise<boolean> {
    try {
        const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;

        if (DEBUG_ENABLED) {
            console.log('📲 OneSignal Debug Start:', {
                hasAppId: !!appId,
                hasApiKey: !!apiKey,
                targets: {
                    externalUserIds: params.externalUserIds?.length || 0,
                    subscriptionIds: params.userIds?.length || 0
                }
            });
        }

        if (!appId || !apiKey) {
            console.warn('OneSignal not configured. Skipping push.');
            return false;
        }

        const targetUrl = params.targetUrl || params.url;
        const basePayload: any = {
            app_id: appId,
            headings: { en: params.title },
            contents: { en: params.message },
            data: {
                ...(params.data || {}),
                route: targetUrl,
                url: targetUrl
            },
            target_channel: "push",
            android_accent_color: "FFFFFF"
        };

        // AUTHENTICATION HEADER
        const authHeader = apiKey.startsWith('os_v2_')
            ? `Bearer ${apiKey}`
            : `Basic ${apiKey}`;

        // Helper to fire a single OneSignal request
        const fireRequest = async (payload: any, label: string): Promise<{ success: boolean; recipients: number }> => {
            if (DEBUG_ENABLED) {
                console.log(`📲 OneSignal Payload (${label}):`, JSON.stringify(payload, null, 2));
            }

            const response = await fetch(ONESIGNAL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error(`❌ OneSignal API Error (${label}):`, {
                    status: response.status,
                    statusText: response.statusText,
                    data: result
                });
                return { success: false, recipients: 0 };
            }

            if (result.errors?.invalid_aliases) {
                console.warn(`⚠️ OneSignal (${label}): invalid_aliases — device not registered:`,
                    JSON.stringify(result.errors.invalid_aliases));
            }

            const recipients = result.recipients || 0;
            if (recipients > 0) {
                console.log(`✅ OneSignal Push Sent (${label}) to ${recipients} device(s):`, result.id);
            } else {
                console.warn(`⚠️ OneSignal (${label}): 0 recipients.`);
            }

            return { success: true, recipients };
        };

        // STRATEGY: Try external_id first, fallback to subscription_id.
        // OneSignal does NOT support both in the same request.

        // Attempt 1: External User ID (modern V5 alias)
        if (params.externalUserIds && params.externalUserIds.length > 0) {
            console.log('🎯 Attempt 1: Targeting via external_id:', params.externalUserIds);
            const aliasPayload = {
                ...basePayload,
                include_aliases: { external_id: params.externalUserIds },
            };
            const result = await fireRequest(aliasPayload, 'external_id');
            if (result.recipients > 0) {
                return true; // Delivered successfully, no need to try subscription_id
            }
            console.warn('⚠️ external_id delivery failed, trying subscription_id fallback...');
        }

        // Attempt 2: Subscription ID (classic player ID)
        if (params.userIds && params.userIds.length > 0) {
            console.log('🎯 Attempt 2: Targeting via subscription_id:', params.userIds);
            const subPayload = {
                ...basePayload,
                include_subscription_ids: params.userIds,
            };
            const result = await fireRequest(subPayload, 'subscription_id');
            if (result.recipients > 0) {
                return true;
            }
        }

        // If we get here, neither method delivered
        if (!params.externalUserIds?.length && !params.userIds?.length) {
            console.warn('⚠️ No targeting provided. Skipping push notification.');
        } else {
            console.warn('⚠️ Push notification could not be delivered via any method. User may need to re-open the app.');
        }
        return false;
    } catch (error) {
        console.error('❌ Exception in sendPushNotification:', error);
        return false;
    }
}

/**
 * Send push notification to a user by their database user ID
 */
export async function sendPushNotificationByUserId(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    url?: string
): Promise<boolean> {
    try {
        console.log('📲 Sending push notification to user:', userId);

        // Import supabaseAdmin dynamically to avoid circular dependencies
        const { supabaseAdmin } = await import('@/lib/supabase-server');

        // Fetch user's OneSignal Player ID from database (as fallback/verification)
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('onesignal_player_id')
            .eq('id', userId)
            .single();

        // We can ALWAYS attempt to send using external_id (userId)
        // OneSignal is clever enough to ignore it if no device is linked to this external_id
        // IMPORTANT: Client registers as `user_${id}`, so we must match that format.
        const externalUserIds = [`user_${userId}`];
        const userIds = user?.onesignal_player_id ? [user.onesignal_player_id] : [];

        if (userIds.length > 0) {
            console.log('✅ Found OneSignal ID in DB:', userIds[0]);
        }
        console.log('🎯 Targeting External ID:', externalUserIds[0]);

        // Send using both for maximum reliability
        return await sendPushNotification({
            externalUserIds,
            userIds,
            title,
            message,
            data,
            url,
        });
    } catch (error) {
        console.error('Error sending push notification by user ID:', error);
        return false;
    }
}

/**
 * Send push notification to multiple users by their database user IDs
 */
export async function sendPushNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, unknown>,
    url?: string
): Promise<boolean> {
    try {
        console.log('📲 Sending push notification to multiple users:', userIds);

        // Import supabaseAdmin dynamically to avoid circular dependencies
        const { supabaseAdmin } = await import('@/lib/supabase-server');

        // Fetch OneSignal Player IDs for all users (as fallback)
        const { data: users } = await supabaseAdmin
            .from('users')
            .select('onesignal_player_id')
            .in('id', userIds);

        const playerIds = users
            ? users.map((u: { onesignal_player_id: string | null }) => u.onesignal_player_id).filter((id: string | null): id is string => !!id)
            : [];

        console.log(`✅ Targeted ${userIds.length} users (Found ${playerIds.length} Player IDs in DB)`);

        // IMPORTANT: Map to `user_${id}` to match client registration
        const formattedExternalIds = userIds.map(id => `user_${id}`);

        // Send using both for maximum reliability
        return await sendPushNotification({
            externalUserIds: formattedExternalIds,
            userIds: playerIds,
            title,
            message,
            data,
            url,
        });
    } catch (error) {
        console.error('Error sending push notification to multiple users:', error);
        return false;
    }
}
