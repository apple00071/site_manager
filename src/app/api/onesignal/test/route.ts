import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase-server';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Test endpoint to debug push notification configuration
 * GET /api/onesignal/test - Returns config status
 * POST /api/onesignal/test - Sends a test notification
 */
export async function GET() {
    try {
        const hasAppId = !!ONESIGNAL_APP_ID;
        const hasApiKey = !!ONESIGNAL_REST_API_KEY;
        const keyType = ONESIGNAL_REST_API_KEY?.startsWith('os_v2_') ? 'V2' : 'Legacy';

        return NextResponse.json({
            configured: hasAppId && hasApiKey,
            app_id: hasAppId ? `${ONESIGNAL_APP_ID?.substring(0, 10)}...` : 'NOT SET',
            api_key_type: hasApiKey ? keyType : 'NOT SET',
            api_key_preview: hasApiKey ? `${ONESIGNAL_REST_API_KEY?.substring(0, 20)}...` : 'NOT SET',
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            return NextResponse.json({
                error: 'OneSignal not configured',
                app_id: !!ONESIGNAL_APP_ID,
                api_key: !!ONESIGNAL_REST_API_KEY
            }, { status: 500 });
        }

        const { targetUserId } = await request.json();
        const userId = targetUserId || user.id;

        // Determine auth header - V2 keys use Bearer, Legacy use "key" prefix
        const authHeader = ONESIGNAL_REST_API_KEY.startsWith('os_v2_')
            ? `Bearer ${ONESIGNAL_REST_API_KEY}`
            : `key ${ONESIGNAL_REST_API_KEY}`;

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            headings: { en: 'Test Notification' },
            contents: { en: `Test from production at ${new Date().toLocaleTimeString()}` },
            include_aliases: {
                external_id: [userId]
            },
            target_channel: "push"
        };

        console.log('🧪 Sending test notification:', {
            userId,
            authType: ONESIGNAL_REST_API_KEY.startsWith('os_v2_') ? 'V2' : 'Legacy',
            payload
        });

        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        return NextResponse.json({
            success: response.ok,
            status: response.status,
            result,
            debug: {
                targetUserId: userId,
                authType: ONESIGNAL_REST_API_KEY.startsWith('os_v2_') ? 'V2' : 'Legacy',
            }
        });
    } catch (error) {
        console.error('Test notification error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
