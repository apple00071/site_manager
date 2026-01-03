'use server';

import crypto from 'crypto';

/**
 * Generates the HMAC-SHA256 hash required for OneSignal Identity Verification.
 * This MUST run on the server to keep the REST API Key secure.
 */
export async function getOneSignalStats(externalId: string) {
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!restApiKey) {
        console.error('❌ ONESIGNAL_REST_API_KEY is missing in environment variables');
        return null;
    }

    try {
        const hmac = crypto.createHmac('sha256', restApiKey);
        hmac.update(externalId);
        return hmac.digest('hex');
    } catch (error) {
        console.error('Error generating OneSignal hash:', error);
        return null;
    }
}
