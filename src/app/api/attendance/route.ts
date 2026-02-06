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

        const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', userResult.user.id).single();
        const isAdmin = userData?.role === 'admin';

        // Check permission: Admins can view anything, employees can view THEIR OWN logs
        // If an employee is trying to view someone else's log (userId provided), they need ATTENDANCE_VIEW
        if (!isAdmin && userId && userId !== userResult.user.id) {
            const check = await verifyPermission(userResult.user.id, PERMISSION_NODES.ATTENDANCE_VIEW);
            if (!check.allowed) {
                return NextResponse.json({ error: check.message }, { status: 403 });
            }
        }

        // If it's a general list request (no date/userId) or filtering by date only, 
        // employees still need ATTENDANCE_VIEW if they want to see "Team" logs.
        // But for today's status (used by widget), we should allow it.
        // Let's just allow own logs bypass.

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

        const { data, error } = await query.order('date', { ascending: false });

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
 * POST: Punch In / Punch Out
 */
export async function POST(request: NextRequest) {
    try {
        const userResult = await getAuthUser();
        if (!userResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check permission
        const check = await verifyPermission(userResult.user.id, PERMISSION_NODES.ATTENDANCE_LOG);
        if (!check.allowed) {
            return NextResponse.json({ error: check.message }, { status: 403 });
        }

        const body = await request.json();
        const action = body.action; // 'punch_in' or 'punch_out'
        const { latitude, longitude } = body;
        const today = new Date().toISOString().split('T')[0];

        if (action === 'punch_in') {
            const { data, error } = await supabaseAdmin
                .from('attendance')
                .upsert({
                    user_id: userResult.user.id,
                    date: today,
                    check_in: new Date().toISOString(),
                    check_in_latitude: latitude,
                    check_in_longitude: longitude,
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

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Unexpected error in POST /api/attendance:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
