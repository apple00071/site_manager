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
        const payload: any = {
            app_id: appId,
            headings: { en: params.title },
            contents: { en: params.message },
            data: {
                ...(params.data || {}),
                route: targetUrl,
                url: targetUrl
            },
            target_channel: "push",
            // Branding Icons
            small_icon: "ic_notification",
            large_icon: "https://appleinteriors.in/wp-content/uploads/2023/06/Logo-1.png",
            android_accent_color: "FFFFFF" // White accent for the small icon
        };

        // TARGETING LOGIC
        // We can include both aliases and specific subscription IDs for maximum reach
        let hasTargeting = false;

        // External User IDs (Mapped via login('user_' + id))
        if (params.externalUserIds && params.externalUserIds.length > 0) {
            payload.include_aliases = {
                external_id: params.externalUserIds
            };
            console.log('🎯 Targeting via external_id:', params.externalUserIds);
            hasTargeting = true;
        } 

        // Subscription IDs (Classic Player IDs / Device Tokens)
        if (params.userIds && params.userIds.length > 0) {
            payload.include_subscription_ids = params.userIds;
            console.log('🎯 Targeting via subscription_ids:', params.userIds);
            hasTargeting = true;
        } 

        if (!hasTargeting) {
            console.warn('⚠️ No targeting provided. Skipping push notification.');
            return false;
        }

        // AUTHENTICATION HEADER
        // os_v2_app_* or os_v2_org_* keys use Bearer auth
        // Legacy REST API keys use Basic auth
        const authHeader = apiKey.startsWith('os_v2_')
            ? `Bearer ${apiKey}`
            : `Basic ${apiKey}`;

        if (DEBUG_ENABLED) {
            console.log('📲 OneSignal Payload:', JSON.stringify(payload, null, 2));
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
            console.error('❌ OneSignal API Error:', {
                status: response.status,
                statusText: response.statusText,
                data: result
            });
            return false;
        }

        console.log('✅ OneSignal Push Sent Successfully:', result);
        return true;
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
