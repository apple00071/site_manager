import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { PERMISSION_NODES, verifyPermission } from '@/lib/rbac';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        let query = supabaseAdmin
            .from('leaves')
            .select(`
                *,
                user:users!user_id(full_name, email)
            `)
            .order('created_at', { ascending: false });

        // Check if user is admin
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        }

        const { data: leaves, error } = await query;

        if (error) throw error;

        return NextResponse.json({ leaves: leaves || [] });
    } catch (error: any) {
        console.error('Error fetching leaves:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const check = await verifyPermission(user.id, PERMISSION_NODES.LEAVES_APPLY);
        if (!check.allowed) {
            return NextResponse.json({ error: check.message }, { status: 403 });
        }

        const body = await request.json();
        const { leave_type, start_date, end_date, start_time, end_time, reason } = body;

        if (!leave_type || !start_date || !end_date || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: leave, error } = await supabaseAdmin
            .from('leaves')
            .insert({
                user_id: user.id,
                leave_type,
                start_date,
                end_date,
                start_time,
                end_time,
                reason,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // Notify admins
        try {
            const { data: admins } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin');

            const { data: requester } = await supabaseAdmin
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const requesterName = requester?.full_name || 'Unknown User';

            if (admins) {
                await Promise.all(admins.map((admin: any) =>
                    NotificationService.notifyLeaveCreated(
                        admin.id,
                        leave_type,
                        start_date,
                        end_date,
                        requesterName,
                        start_time,
                        end_time
                    )
                ));
            }
        } catch (notifError) {
            console.error('Error sending leave notification:', notifError);
        }

        return NextResponse.json({ leave }, { status: 201 });
    } catch (error: any) {
        console.error('Error applying for leave:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing leave ID' }, { status: 400 });
        }

        const body = await request.json();
        const { status, admin_comment } = body;

        // Fetch existing leave to check permissions and get data for notification
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('leaves')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updateData: any = {
            status,
            admin_comment,
            approved_by: user.id,
            approved_at: new Date().toISOString()
        };

        const { data: leave, error } = await supabaseAdmin
            .from('leaves')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify user of status change
        try {
            if (status === 'approved') {
                await NotificationService.notifyLeaveApproved(
                    existing.user_id,
                    existing.leave_type,
                    existing.start_date,
                    existing.end_date,
                    existing.start_time,
                    existing.end_time
                );
            } else if (status === 'rejected') {
                await NotificationService.notifyLeaveRejected(
                    existing.user_id,
                    existing.leave_type,
                    existing.start_date,
                    existing.end_date,
                    existing.start_time,
                    existing.end_time
                );
            }
        } catch (notifError) {
            console.error('Error sending leave status update notification:', notifError);
        }

        return NextResponse.json({ leave });
    } catch (error: any) {
        console.error('Error updating leave status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing leave ID' }, { status: 400 });
        }

        // Fetch existing leave to check ownership and status
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('leaves')
            .select('user_id, status')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin';

        // Only owners of pending leaves or admins can delete
        if (!isAdmin && (existing.user_id !== user.id || existing.status !== 'pending')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('leaves')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting leave request:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
