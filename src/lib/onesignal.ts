// OneSignal Push Notification Service
// Handles sending push notifications via OneSignal REST API

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

interface SendNotificationParams {
    userIds: string[]; // OneSignal Player IDs
    title: string;
    message: string;
    data?: Record<string, unknown>; // Optional custom data
    url?: string; // Optional URL to open when notification is clicked
}

/**
 * Send push notification to specific users via OneSignal
 */
export async function sendPushNotification(params: SendNotificationParams): Promise<boolean> {
    try {
        // Skip if OneSignal is not configured
        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            console.warn('OneSignal not configured. Skipping push notification.');
            return false;
        }

        // Skip if no user IDs provided
        if (!params.userIds || params.userIds.length === 0) {
            console.warn('No OneSignal player IDs provided. Skipping push notification.');
            return false;
        }

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: params.userIds,
            headings: { en: params.title },
            contents: { en: params.message },
            data: params.data || {},
            url: params.url,
        };

        console.log('📲 Sending OneSignal push notification:', {
            userIds: params.userIds,
            title: params.title,
        });

        const response = await fetch(ONESIGNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
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
 * Fetches the OneSignal Player ID from the database
 */
export async function sendPushNotificationByUserId(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    url?: string
): Promise<boolean> {
    try {
        // Import supabaseAdmin dynamically to avoid circular dependencies
        const { supabaseAdmin } = await import('@/lib/supabase-server');

        // Fetch user's OneSignal Player ID from database
        const { data: profile, error } = await supabaseAdmin
            .from('users')
            .select('onesignal_player_id')
            .eq('id', userId)
            .single();

        if (error || !profile?.onesignal_player_id) {
            console.warn(`No OneSignal Player ID found for user ${userId}`);
            return false;
        }

        return await sendPushNotification({
            userIds: [profile.onesignal_player_id],
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
        // Import supabaseAdmin dynamically to avoid circular dependencies
        const { supabaseAdmin } = await import('@/lib/supabase-server');

        // Fetch OneSignal Player IDs for all users
        const { data: profiles, error } = await supabaseAdmin
            .from('users')
            .select('onesignal_player_id')
            .in('id', userIds);

        if (error || !profiles || profiles.length === 0) {
            console.warn('No OneSignal Player IDs found for provided user IDs');
            return false;
        }

        const playerIds = profiles
            .map((p: { onesignal_player_id: string | null }) => p.onesignal_player_id)
            .filter((id: string | null): id is string => !!id);

        if (playerIds.length === 0) {
            console.warn('No valid OneSignal Player IDs found');
            return false;
        }

        return await sendPushNotification({
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
