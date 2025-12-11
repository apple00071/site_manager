import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/[id]/activity
 * Fetch activity timeline for a task
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error } = await getAuthUser();
        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Fetch activities with user information
        const { data: activities, error: fetchError } = await supabaseAdmin
            .from('task_activity')
            .select(`
        *,
        user:users!task_activity_user_id_fkey(id, full_name, email)
      `)
            .eq('task_id', id)
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching task activity:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch activity' },
                { status: 500 }
            );
        }

        return NextResponse.json({ activities: activities || [] });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/tasks/[id]/activity
 * Log a new activity for a task
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error } = await getAuthUser();
        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { activity_type, old_value, new_value, comment } = body;

        // Validate activity_type
        const validTypes = [
            'created',
            'status_changed',
            'assigned',
            'priority_changed',
            'commented',
            'updated',
            'due_date_changed',
        ];

        if (!activity_type || !validTypes.includes(activity_type)) {
            return NextResponse.json(
                { error: 'Invalid activity_type' },
                { status: 400 }
            );
        }

        // Insert activity
        const { data: activity, error: insertError } = await supabaseAdmin
            .from('task_activity')
            .insert({
                task_id: id,
                user_id: user.id,
                activity_type,
                old_value: old_value || null,
                new_value: new_value || null,
                comment: comment || null,
            })
            .select(`
        *,
        user:users!task_activity_user_id_fkey(id, full_name, email)
      `)
            .single();

        if (insertError) {
            console.error('Error logging activity:', insertError);
            return NextResponse.json(
                { error: 'Failed to log activity' },
                { status: 500 }
            );
        }

        return NextResponse.json({ activity }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
