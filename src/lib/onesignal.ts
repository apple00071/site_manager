// OneSignal Push Notification Service
// Handles sending push notifications via OneSignal REST API

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

// Use new API endpoint per OneSignal migration guide
const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

interface SendNotificationParams {
    userIds?: string[]; // OneSignal Player IDs (optional)
    externalUserIds?: string[]; // Database user IDs (recommended for Median)
    title: string;
    message: string;
    data?: Record<string, unknown>; // Optional custom data
    url?: string; // Optional URL to open when notification is clicked
}

/**
 * Send push notification to specific users via OneSignal
 * Supports both Player IDs and External User IDs (database user IDs)
 */
export async function sendPushNotification(params: SendNotificationParams): Promise<boolean> {
    try {
        // Skip if OneSignal is not configured
        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            console.warn('OneSignal not configured. Skipping push notification.');
            return false;
        }

        // Need either userIds or externalUserIds
        if ((!params.userIds || params.userIds.length === 0) &&
            (!params.externalUserIds || params.externalUserIds.length === 0)) {
            console.warn('No user IDs or external user IDs provided. Skipping push notification.');
            return false;
        }

        const payload: any = {
            app_id: ONESIGNAL_APP_ID,
            headings: { en: params.title },
            contents: { en: params.message },
            data: params.data || {},
            url: params.url,
            target_channel: "push"
        };

        // Modern OneSignal V2 targeting via Aliases
        const aliases: any = {};

        if (params.externalUserIds && params.externalUserIds.length > 0) {
            aliases.external_id = params.externalUserIds;
            console.log('📲 Targeting via external_id:', params.externalUserIds);
        }

        if (params.userIds && params.userIds.length > 0) {
            // onesignal_id is their internal UUID
            aliases.onesignal_id = params.userIds;
            console.log('📲 Targeting via onesignal_id:', params.userIds);
        }

        if (Object.keys(aliases).length > 0) {
            payload.include_aliases = aliases;
        } else {
            console.warn('⚠️ No targeting aliases found');
            return false;
        }

        // Determine auth header format based on key type
        // os_v2_app_* or os_v2_org_* keys use Bearer auth
        // Legacy REST API keys use "Basic" prefix
        let authHeader: string;
        if (ONESIGNAL_REST_API_KEY.startsWith('os_v2_')) {
            authHeader = `Bearer ${ONESIGNAL_REST_API_KEY}`;
            console.log('📲 Using V2 API key authentication (Bearer)');
        } else {
            authHeader = `Basic ${ONESIGNAL_REST_API_KEY}`;
            console.log('📲 Using Legacy API key authentication (Basic)');
        }

        const response = await fetch(ONESIGNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OneSignal API error:', errorData);
            return false;
        }

        const result = await response.json();
        console.log('✅ OneSignal push notification sent:', result);
        return true;
    } catch (error) {
        console.error('Error sending OneSignal push notification:', error);
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
        const externalUserIds = [userId];
        const userIds = user?.onesignal_player_id ? [user.onesignal_player_id] : [];

        if (userIds.length > 0) {
            console.log('✅ Found OneSignal ID in DB:', userIds[0]);
        } else {
            console.log('ℹ️ No OneSignal ID in DB, using External User ID targeting exclusively');
        }

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

        // Send using both for maximum reliability
        return await sendPushNotification({
            externalUserIds: userIds,
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
