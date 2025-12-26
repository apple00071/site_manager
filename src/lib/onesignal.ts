// OneSignal Push Notification Service
// Handles sending push notifications via OneSignal REST API

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

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
        };

        // Prefer External User IDs (better for Median apps)
        if (params.externalUserIds && params.externalUserIds.length > 0) {
            payload.include_external_user_ids = params.externalUserIds;
            console.log('📲 Sending OneSignal push notification to external user IDs:', params.externalUserIds);
        } else if (params.userIds && params.userIds.length > 0) {
            payload.include_player_ids = params.userIds;
            console.log('📲 Sending OneSignal push notification to player IDs:', params.userIds);
        }

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
 * Uses OneSignal External User ID for reliable delivery in Median apps
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

        // Send directly using External User ID (database user ID)
        // This works better with Median's native OneSignal integration
        return await sendPushNotification({
            externalUserIds: [userId],
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
 * Uses OneSignal External User IDs for reliable delivery in Median apps
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

        // Send directly using External User IDs (database user IDs)
        return await sendPushNotification({
            externalUserIds: userIds,
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
