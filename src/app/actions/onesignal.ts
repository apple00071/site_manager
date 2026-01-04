'use server';

import crypto from 'crypto';

/**
 * Generates the HMAC-SHA256 hash required for OneSignal Identity Verification.
 * This MUST run on the server to keep the REST API Key secure.
 * 
 * @param identifier Task-specific ID (e.g. user.id or emailAddress)
 */
export async function getOneSignalIdentityHash(identifier: string) {
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!restApiKey) {
        console.error('❌ ONESIGNAL_REST_API_KEY is missing in environment variables');
        return null;
    }

    try {
        const hmac = crypto.createHmac('sha256', restApiKey);
        hmac.update(identifier);
        return hmac.digest('hex');
    } catch (error) {
        console.error('Error generating OneSignal identity hash:', error);
        return null;
    }
}
