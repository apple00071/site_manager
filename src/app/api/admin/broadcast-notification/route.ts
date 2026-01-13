import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendPushNotificationToMultipleUsers } from '@/lib/onesignal';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 1. Authorization Check (CRON_SECRET OR Admin Session)
        const authHeader = req.headers.get('authorization');
        const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        const { searchParams } = new URL(req.url);
        const adminUserId = searchParams.get('adminId');

        if (!isCronAuth) {
            if (!adminUserId) {
                return NextResponse.json({ error: 'Unauthorized: Missing credentials' }, { status: 401 });
            }

            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('role')
                .eq('id', adminUserId)
                .single();

            if (userError || user?.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
            }
        }



        // 2. Parse Custom Message, Title & Target Users (Optional)
        let customMessage = '';
        let customTitle = '';
        let targetUserIds: string[] = [];
        try {
            const body = await req.json();
            customMessage = body.message;
            customTitle = body.title;
            targetUserIds = body.userIds || [];
        } catch (e) {
            // No body or invalid JSON, ignore
        }

        // 3. Fetch Users (Specified or All)
        let users = [];
        if (targetUserIds.length > 0) {
            const { data: matchedUsers, error: fetchError } = await supabaseAdmin
                .from('users')
                .select('id, full_name')
                .in('id', targetUserIds);

            if (fetchError) throw fetchError;
            users = matchedUsers || [];
        } else {
            const { data: allUsers, error: fetchError } = await supabaseAdmin
                .from('users')
                .select('id, full_name');

            if (fetchError) throw fetchError;
            users = allUsers || [];
        }

        if (users.length === 0) {
            return NextResponse.json({ error: 'No recipients found' }, { status: 404 });
        }

        const userIds = users.map((u: any) => u.id);
        const title = customTitle || 'Site Update 📢';
        const fallbackMessage = 'Wishing everyone a very Happy Sankranti! Please note that the office will be closed from Jan 14th to Jan 16th. Enjoy the festive holidays!';
        const message = customMessage || fallbackMessage;

        // 4. Send Notifications via NotificationService
        // This handles: In-App Database, WhatsApp (if configured), and OneSignal Push
        const notificationPromises = users.map((user: any) =>
            NotificationService.createNotification({
                userId: user.id,
                title,
                message,
                type: 'general',
                skipInApp: false
            })
        );

        await Promise.allSettled(notificationPromises);

        // 6. Log Broadcast Event for History
        try {
            await supabaseAdmin
                .from('broadcast_logs')
                .insert({
                    admin_id: adminUserId || null,
                    title,
                    message,
                    recipient_count: users.length,
                    target_user_ids: targetUserIds.length > 0 ? targetUserIds : null
                });
        } catch (logError) {
            console.error('Failed to log broadcast to history:', logError);
            // Don't fail the request if logging fails
        }

        return NextResponse.json({
            success: true,
            message: `${users.length} users.`
        });

    } catch (error: any) {
        console.error('Broadcast failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
