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
        const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || 'd800d582-08b8-431c-bb19-59a08f7f5379';
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
            console.warn('⚠️ OneSignal push skipped: ONESIGNAL_REST_API_KEY is not configured in environment.');
            return false;
        }

        const targetUrl = params.targetUrl || params.url;
        // Only set app_url / url top-level if it's a valid absolute URL (starts with http:// or https://)
        // OneSignal API rejects notifications with HTTP 400 if app_url is a relative path.
        const isAbsoluteUrl = targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'));

        const basePayload: any = {
            app_id: appId,
            headings: { en: params.title },
            contents: { en: params.message },
            data: {
                ...(params.data || {}),
                route: targetUrl,
                url: targetUrl,
                targetUrl: targetUrl,
            },
            target_channel: "push",
            android_accent_color: "EAB308",        // Branding color (Yellow)
            // Wake up device and show prominently
            priority: 10,                          // High priority — wakes device
            android_visibility: 1,                 // Show on lock screen (1 = Public)
            android_led_color: "FFEAB308",         // LED color (Yellow)
            android_sound: "default",              // Play default notification sound
            android_vibration: true,               // Enable vibration to help wake device
            android_group_alert_behavior: 1,       // Alert once for group
            ttl: 259200,                           // 3 days TTL
            ...(isAbsoluteUrl ? { app_url: targetUrl, url: targetUrl } : {}),
        };

        // AUTHENTICATION HEADER
        const authHeader = apiKey.startsWith('os_v2_')
            ? `Bearer ${apiKey}`
            : `Basic ${apiKey}`;

        // Helper to fire a single OneSignal request
        const fireRequest = async (payload: any, label: string): Promise<{ success: boolean; id?: string }> => {
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

            if (!response.ok || (Array.isArray(result.errors) && result.errors.length > 0)) {
                console.error(`❌ OneSignal API Error (${label}):`, {
                    status: response.status,
                    statusText: response.statusText,
                    data: result
                });
                return { success: false };
            }

            if (result.errors?.invalid_aliases) {
                console.warn(`⚠️ OneSignal (${label}): some aliases were inactive or invalid:`,
                    JSON.stringify(result.errors.invalid_aliases));
            }

            if (result.id) {
                console.log(`✅ OneSignal Push Accepted (${label}) Notification ID:`, result.id);
                return { success: true, id: result.id };
            }

            return { success: false };
        };

        // STRATEGY: Try external_id first, fallback to subscription_id.
        // OneSignal does NOT support both in the same request.

        const sendRequest = async (targetType: 'external_id' | 'subscription_id', targetIds: string[]) => {
            // Deduplicate and clean IDs
            const cleanIds = Array.from(new Set(targetIds.filter(id => id && typeof id === 'string' && id.trim().length > 0)));
            if (cleanIds.length === 0) return { success: false };

            const payload = {
                ...basePayload,
                ...(targetType === 'external_id' 
                    ? { include_aliases: { external_id: cleanIds } } 
                    : { include_subscription_ids: cleanIds }
                )
            };
            return await fireRequest(payload, targetType);
        };

        // Attempt 1: External User ID (modern V5 alias)
        if (params.externalUserIds && params.externalUserIds.length > 0) {
            console.log('🎯 Attempt 1: Targeting via external_id:', params.externalUserIds);
            const result = await sendRequest('external_id', params.externalUserIds);
            if (result.success) {
                return true; // Delivered successfully
            }
            console.warn('⚠️ external_id delivery failed, trying subscription_id fallback...');
        }

        // Attempt 2: Subscription ID (classic player ID)
        if (params.userIds && params.userIds.length > 0) {
            console.log('🎯 Attempt 2: Targeting via subscription_id:', params.userIds);
            const result = await sendRequest('subscription_id', params.userIds);
            if (result.success) {
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

        // Fetch user's OneSignal Player ID and active status from database
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('onesignal_player_id, is_active')
            .eq('id', userId)
            .single();

        if (user && user.is_active === false) {
            console.log('🚫 User is deactivated, skipping push notification:', userId);
            return false;
        }

        // Match both `user_${id}` and raw `${id}` so all client SDK registrations receive the push
        const externalUserIds = Array.from(new Set([`user_${userId}`, userId]));
        const userIds = user?.onesignal_player_id ? [user.onesignal_player_id] : [];

        if (userIds.length > 0) {
            console.log('✅ Found OneSignal ID in DB:', userIds[0]);
        }
        console.log('🎯 Targeting External IDs:', externalUserIds);

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

        // Fetch OneSignal Player IDs for active users only
        const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, onesignal_player_id, is_active')
            .in('id', userIds);

        const activeUsers = (users || []).filter((u: any) => u.is_active !== false);
        const activeUserIds: string[] = activeUsers.map((u: any) => u.id as string);
        const playerIds: string[] = activeUsers
            .map((u: any) => u.onesignal_player_id as string | null)
            .filter((id: string | null): id is string => !!id);

        if (activeUserIds.length === 0) {
            console.log('🚫 No active users to notify in list, skipping push');
            return true;
        }

        console.log(`✅ Targeted ${activeUserIds.length} active users (Found ${playerIds.length} Player IDs in DB)`);

        // Target both formats for active users only
        const formattedExternalIds: string[] = Array.from(new Set<string>(activeUserIds.flatMap((id: string) => [`user_${id}`, id])));

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
