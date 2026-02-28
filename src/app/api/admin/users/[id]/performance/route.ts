import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: targetUserId } = await params;

        // 1. Authenticate requester
        const { user, role, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = role === 'admin';
        if (!isAdmin && user.id !== targetUserId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Calculate Metrics
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();

        // Metric A: Update Count (Last 30 days)
        const { count: updateCount, error: updateError } = await supabaseAdmin
            .from('project_updates')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetUserId)
            .gte('created_at', thirtyDaysAgo);

        // Metric B: Snag Efficiency (Resolved in last 90 days)
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString();
        const { data: snags, error: snagError } = await supabaseAdmin
            .from('snags')
            .select('created_at, assigned_at, resolved_at')
            .eq('assigned_to_user_id', targetUserId)
            .eq('status', 'resolved')
            .gte('resolved_at', ninetyDaysAgo);

        let avgSnagHours = 0;
        if (snags && snags.length > 0) {
            const totalHours = snags.reduce((acc: number, snag: any) => {
                const start = new Date(snag.assigned_at || snag.created_at).getTime();
                const end = new Date(snag.resolved_at).getTime();
                return acc + (end - start) / (1000 * 60 * 60);
            }, 0);
            avgSnagHours = totalHours / snags.length;
        }

        // Metric C: Task Adherence (Last 90 days)
        const { data: tasks, error: taskError } = await supabaseAdmin
            .from('project_step_tasks')
            .select('status, estimated_completion_date, updated_at')
            .eq('assigned_to', targetUserId)
            .eq('status', 'done')
            .gte('updated_at', ninetyDaysAgo);

        let adherenceRate = 100;
        if (tasks && tasks.length > 0) {
            const onTimeTasks = tasks.filter((task: any) => {
                if (!task.estimated_completion_date) return true;
                const deadline = new Date(task.estimated_completion_date).getTime();
                const completion = new Date(task.updated_at).getTime();
                return completion <= deadline;
            });
            adherenceRate = Math.round((onTimeTasks.length / tasks.length) * 100);
        }

        // Metric D: Attendance Consistency (Last 90 days)
        const { data: attendanceData, error: attendanceError } = await supabaseAdmin
            .from('attendance')
            .select('date')
            .eq('user_id', targetUserId)
            .gte('date', ninetyDaysAgo);

        let attendanceConsistency = 0;
        if (attendanceData) {
            const uniqueDates = new Set(attendanceData.map((d: any) => d.date.split('T')[0])).size;
            // 90 days, roughly 13 weeks. 13 * 6 = 78 working days approx.
            // Let's calculate exactly based on current date window.
            let workingDays = 0;
            const tempDate = new Date(ninetyDaysAgo);
            while (tempDate <= now) {
                if (tempDate.getDay() !== 0) workingDays++; // Exclude Sundays
                tempDate.setDate(tempDate.getDate() + 1);
            }
            attendanceConsistency = Math.min(100, Math.round((uniqueDates / Math.max(1, workingDays)) * 100));
        }

        // Metric E: Site Communication (Updates Frequency)
        // Based on 30 day window of updates activity
        const { data: recentUpdates, error: recentUpdatesError } = await supabaseAdmin
            .from('project_updates')
            .select('created_at')
            .eq('user_id', targetUserId)
            .gte('created_at', thirtyDaysAgo);

        let communicationScore = 0;
        if (recentUpdates) {
            const uniqueUpdateDays = new Set(recentUpdates.map((u: any) => u.created_at.split('T')[0])).size;
            // Target: at least 3 updates per week (12 per month) for 100%
            // Or relative to active projects. Let's stick to update days / 20 (roughly 5 days/week * 4 weeks).
            communicationScore = Math.min(100, Math.round((uniqueUpdateDays / 20) * 100));
        }

        return NextResponse.json({
            metrics: {
                updateCount: updateCount || 0,
                avgSnagResolveHours: Math.round(avgSnagHours * 10) / 10,
                taskAdherenceRate: adherenceRate,
                attendanceConsistency: attendanceConsistency,
                communicationScore: communicationScore
            }
        });

    } catch (error: any) {
        console.error('Performance API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
