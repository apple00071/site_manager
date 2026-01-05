import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Link OneSignal subscription to user by setting External ID via API
 * This is a workaround for when the Median JS bridge login() doesn't work
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { oneSignalId } = await request.json();

        if (!oneSignalId || typeof oneSignalId !== 'string') {
            return NextResponse.json({ error: 'OneSignal ID is required' }, { status: 400 });
        }

        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            return NextResponse.json({ error: 'OneSignal not configured' }, { status: 500 });
        }

        // Use OneSignal API to add external_id alias to this subscription
        // API docs: https://documentation.onesignal.com/reference/create-aliases
        const aliasUrl = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/onesignal_id/${oneSignalId}/identity`;

        // Determine auth header - V2 keys use Bearer, Legacy use "key" prefix
        const authHeader = ONESIGNAL_REST_API_KEY.startsWith('os_v2_')
            ? `Bearer ${ONESIGNAL_REST_API_KEY}`
            : `key ${ONESIGNAL_REST_API_KEY}`;

        const response = await fetch(aliasUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({
                identity: {
                    external_id: user.id
                }
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('OneSignal API error:', result);
            return NextResponse.json({
                error: 'Failed to link External ID',
                details: result
            }, { status: 500 });
        }

        console.log(`✅ Linked External ID ${user.id} to OneSignal ID ${oneSignalId}`);

        // Also save to our database
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update({ onesignal_player_id: oneSignalId })
            .eq('id', user.id);

        if (dbError) {
            console.error('DB error:', dbError);
        }

        return NextResponse.json({
            success: true,
            externalId: user.id,
            oneSignalId: oneSignalId
        });
    } catch (error) {
        console.error('Error in OneSignal link endpoint:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
