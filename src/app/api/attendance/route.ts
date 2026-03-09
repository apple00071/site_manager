import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission, PERMISSION_NODES } from '@/lib/rbac';

/**
 * GET: Fetch attendance logs
 * Employees: Only own logs
 * Admins: All logs
 */
export async function GET(request: NextRequest) {
    try {
        const userResult = await getAuthUser();
        if (!userResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const userId = searchParams.get('user_id');
        const latestOnly = searchParams.get('latest') === 'true';

        const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', userResult.user.id).single();
        const isAdmin = userData?.role === 'admin';

        // Check permission: Admins can view anything, employees can view THEIR OWN logs
        if (!isAdmin && userId && userId !== userResult.user.id) {
            const check = await verifyPermission(userResult.user.id, PERMISSION_NODES.ATTENDANCE_VIEW);
            if (!check.allowed) {
                return NextResponse.json({ error: check.message }, { status: 403 });
            }
        }

        let query = supabaseAdmin.from('attendance').select(`
            *,
            users (full_name, email)
        `);

        // Filter by user_id if employee (or if specifically requested by admin)
        if (!isAdmin) {
            query = query.eq('user_id', userResult.user.id);
        } else if (userId) {
            query = query.eq('user_id', userId);
        }

        if (date) {
            query = query.eq('date', date);
        }

        if (latestOnly) {
            query = query.order('date', { ascending: false }).order('check_in', { ascending: false }).limit(1);
        } else {
            query = query.order('date', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching attendance logs:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Unexpected error in GET /api/attendance:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST: Punch In / Punch Out / Quick Close
 */
export async function POST(request: NextRequest) {
    try {
        const userResult = await getAuthUser();
        if (!userResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const action = body.action; // 'punch_in', 'punch_out', or 'quick_close'
        const { latitude, longitude, date, check_out_time } = body;
        const today = new Date().toISOString().split('T')[0];

        // Permission check
        const check = await verifyPermission(userResult.user.id, PERMISSION_NODES.ATTENDANCE_LOG);
        if (!check.allowed) {
            return NextResponse.json({ error: check.message }, { status: 403 });
        }

        if (action === 'punch_in') {
            const { data, error } = await supabaseAdmin
                .from('attendance')
                .upsert({
                    user_id: userResult.user.id,
                    date: today,
                    check_in: new Date().toISOString(),
                    check_in_latitude: latitude,
                    check_in_longitude: longitude,
                    status: 'approved' // Normal punches are approved by default
                }, { onConflict: 'user_id,date' })
                .select()
                .single();

            if (error) {
                console.error('Punch in error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json(data);
        }

        if (action === 'punch_out') {
            const { data, error } = await supabaseAdmin
                .from('attendance')
                .update({
                    check_out: new Date().toISOString(),
                    check_out_latitude: latitude,
                    check_out_longitude: longitude,
                })
                .eq('user_id', userResult.user.id)
                .eq('date', today)
                .select()
                .maybeSingle();

            if (error) {
                console.error('Punch out error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data) {
                return NextResponse.json({ error: 'No punch-in record found for today. Please punch in first.' }, { status: 400 });
            }

            return NextResponse.json(data);
        }

        if (action === 'quick_close') {
            if (!date || !check_out_time) {
                return NextResponse.json({ error: 'Missing date or check-out time' }, { status: 400 });
            }

            // Create a ISO string for the check_out based on the record's date and the provided time
            const checkOutDate = new Date(`${date}T${check_out_time}`);

            const { data, error } = await supabaseAdmin
                .from('attendance')
                .update({
                    check_out: checkOutDate.toISOString(),
                    status: 'pending', // Requires admin approval
                    admin_comments: 'Submitted via Quick Close (Forgotten Punch Out)'
                })
                .eq('user_id', userResult.user.id)
                .eq('date', date)
                .select()
                .maybeSingle();

            if (error) {
                console.error('Quick close error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Unexpected error in POST /api/attendance:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH: Admin approval of attendance
 */
export async function PATCH(request: NextRequest) {
    try {
        const userResult = await getAuthUser();
        if (!userResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify Admin/Approve permission
        const check = await verifyPermission(userResult.user.id, PERMISSION_NODES.ATTENDANCE_APPROVE);
        if (!check.allowed) {
            return NextResponse.json({ error: check.message }, { status: 403 });
        }

        const body = await request.json();
        const { id, status, admin_comments } = body;

        if (!['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .update({
                status,
                admin_comments,
                resolved_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Attendance approval error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Unexpected error in PATCH /api/attendance:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
