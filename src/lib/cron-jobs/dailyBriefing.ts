import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function runDailyBriefing() {
    console.log('🌅 Starting Daily Briefing Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch tasks due TODAY or OVERDUE (status=todo/in_progress)

    // Calendar Tasks
    const { data: calendarTasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, end_at, status')
        .neq('status', 'done')
        .neq('status', 'cancelled')
        .lte('end_at', `${todayStr}T23:59:59`); // Due today or earlier

    if (tasksError) throw tasksError;

    // Project Tasks
    const { data: projectTasks, error: stepTasksError } = await supabaseAdmin
        .from('project_step_tasks')
        .select('id, title, assigned_to, estimated_completion_date, status')
        .neq('status', 'done')
        .neq('status', 'cancelled')
        .lte('estimated_completion_date', todayStr); // Due today or earlier

    if (stepTasksError) throw stepTasksError;

    // 2. Fetch open/assigned/resolved snags for briefing
    const { data: openSnags } = await supabaseAdmin
        .from('snags')
        .select('id, assigned_to_user_id, created_by, status')
        .in('status', ['open', 'assigned', 'resolved']);

    const totalOpen = (openSnags || []).filter((s: any) => s.status === 'open').length;
    const totalAssigned = (openSnags || []).filter((s: any) => s.status === 'assigned').length;
    const totalResolved = (openSnags || []).filter((s: any) => s.status === 'resolved').length;

    // Build a map: userId -> { assignedSnags, openSnags }
    const snagStats: Record<string, { assigned: number; open: number }> = {};

    (openSnags || []).forEach((snag: any) => {
        if (snag.status === 'open' || snag.status === 'assigned') {
            // Count snags assigned to this user
            if (snag.assigned_to_user_id) {
                if (!snagStats[snag.assigned_to_user_id]) snagStats[snag.assigned_to_user_id] = { assigned: 0, open: 0 };
                snagStats[snag.assigned_to_user_id].assigned++;
            }
            // Count open (unassigned) snags for the creator
            if (!snag.assigned_to_user_id && snag.created_by) {
                if (!snagStats[snag.created_by]) snagStats[snag.created_by] = { assigned: 0, open: 0 };
                snagStats[snag.created_by].open++;
            }
        }
    });

    // 3. Group tasks by User
    const userStats: Record<string, { today: number; overdue: number }> = {};

    const processTask = (userId: string, dueDate: string | Date) => {
        if (!userStats[userId]) userStats[userId] = { today: 0, overdue: 0 };

        const taskDate = new Date(dueDate).toISOString().split('T')[0];
        if (taskDate === todayStr) {
            userStats[userId].today++;
        } else if (taskDate < todayStr) {
            userStats[userId].overdue++;
        }
    };

    calendarTasks?.forEach((t: any) => {
        if (t.assigned_to) {
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach((uid: string) => processTask(uid, t.end_at));
            } else {
                processTask(t.assigned_to, t.end_at);
            }
        }
    });

    projectTasks?.forEach((t: any) => {
        if (t.assigned_to) {
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach((uid: string) => processTask(uid, t.estimated_completion_date));
            } else {
                processTask(t.assigned_to, t.estimated_completion_date);
            }
        }
    });

    // 4. Send Briefings to ALL active users
    const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role, designation')
        .eq('is_active', true);

    const updates = [];
    for (const user of (allUsers || [])) {
        const stats = userStats[user.id] || { today: 0, overdue: 0 };
        const snags = snagStats[user.id] || { assigned: 0, open: 0 };
        const isAdmin = user.role === 'admin' || user.designation?.toLowerCase().includes('hr');

        // Build snag line only if there's something to report
        let snagLine = '';
        if (isAdmin) {
            if (totalOpen + totalAssigned + totalResolved > 0) {
                snagLine = `\n- Pending Snags: ${totalOpen} Open, ${totalAssigned} Assigned, ${totalResolved} Resolved`;
            }
        } else {
            if (snags.assigned > 0 || snags.open > 0) {
                const parts = [];
                if (snags.assigned > 0) parts.push(`${snags.assigned} Assigned to You`);
                if (snags.open > 0) parts.push(`${snags.open} Open (Unassigned)`);
                snagLine = `\n- Pending Snags: ${parts.join(', ')}`;
            }
        }

        const message = `Hello ${user.full_name},\n\nHere is a look at your day:\n- Tasks Due Today: ${stats.today}\n- Overdue Tasks: ${stats.overdue}${snagLine}\n\nWishing you a productive and successful day ahead.`;

        console.log(`Sending briefing to ${user.full_name}`);
        updates.push(
            NotificationService.createNotification({
                userId: user.id,
                title: 'Daily Briefing',
                message,
                type: 'general',
                relatedId: user.id,
                relatedType: 'daily_briefing',
                skipInApp: true
            })
        );
    }


    await Promise.allSettled(updates);

    return {
        success: true,
        message: `Sent ${updates.length} daily briefings`,
        stats: userStats,
        snagStats
    };
}
