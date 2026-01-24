import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: snagId } = await params;
        const { user, error: authError, role } = await getAuthUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Verify access to the snag
        const { data: snag, error: snagError } = await supabaseAdmin
            .from('snags')
            .select('project_id, created_by, assigned_to_user_id')
            .eq('id', snagId)
            .single();

        if (snagError || !snag) {
            return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
        }

        // RBAC: If not admin, check if member of project or creator/assignee
        if (role !== 'admin') {
            if (snag.created_by !== user.id && snag.assigned_to_user_id !== user.id) {
                if (snag.project_id) {
                    const { data: member } = await supabaseAdmin
                        .from('project_members')
                        .select('id')
                        .eq('project_id', snag.project_id)
                        .eq('user_id', user.id)
                        .single();

                    if (!member) {
                        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
                    }
                } else {
                    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
                }
            }
        }

        // 2. Fetch all notifications related to this snag
        const { data: notifications, error: notifError } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('related_id', snagId)
            .eq('related_type', 'snag')
            .order('created_at', { ascending: false });

        if (notifError) {
            console.error('Error fetching snag history:', notifError);
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
        }

        const history: any[] = [];
        const seenMarkers = new Set();

        notifications?.forEach((n: any) => {
            const timeTrim = new Date(n.created_at).getTime() / 1000;
            const marker = `${n.type}-${Math.floor(timeTrim)}-${n.message.substring(0, 20)}`;

            if (!seenMarkers.has(marker)) {
                history.push({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    created_at: n.created_at
                });
                seenMarkers.add(marker);
            }
        });

        return NextResponse.json({ history });
    } catch (error) {
        console.error('Unexpected error in snag history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
