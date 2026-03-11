import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

/**
 * POST: Employee appeals a rejected attendance record
 */
export async function POST(request: NextRequest) {
    try {
        const userResult = await getAuthUser();
        if (!userResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, user_comments } = body;

        if (!id || !user_comments) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify the record belongs to the user and is currently rejected
        const { data: existingRecord, error: fetchError } = await supabaseAdmin
            .from('attendance')
            .select('user_id, status')
            .eq('id', id)
            .single();

        if (fetchError || !existingRecord) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        if (existingRecord.user_id !== userResult.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Update the record with the appeal
        const { data, error } = await supabaseAdmin
            .from('attendance')
            .update({
                status: 'pending',
                user_comments: user_comments,
                // Optional: clear admin comments on resubmission, or leave them for context
                // admin_comments: null 
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Attendance appeal error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Notify Admins
        try {
            const { data: admins } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin');

            const employeeName = userResult.user.user_metadata?.full_name || 'An employee';
            const date = data.date;

            if (admins) {
                await Promise.all(
                    admins.map((admin: { id: string }) => NotificationService.notifyAttendanceAppealed(admin.id, employeeName, date))
                );
            }
        } catch (notifyError) {
            console.error('Failed to send appeal notification:', notifyError);
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Unexpected error in POST /api/attendance/appeal:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
