import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/authHelpers';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Save OneSignal Player ID to user's profile
 * This allows the backend to send push notifications to specific users
 */
export async function POST(request: NextRequest) {
    try {
        // Get current user
        const user = await getCurrentUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { playerId } = await request.json();

        if (!playerId || typeof playerId !== 'string') {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        // Update user's profile with OneSignal Player ID
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ onesignal_player_id: playerId })
            .eq('id', user.id);

        if (error) {
            console.error('Error saving OneSignal Player ID:', error);
            return NextResponse.json(
                { error: 'Failed to save Player ID' },
                { status: 500 }
            );
        }

        console.log(`✅ OneSignal Player ID saved for user ${user.id}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in OneSignal subscribe endpoint:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
