import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { isAdminOrHR } from '@/lib/cron-jobs/cronUtils';

/**
 * Afternoon Progress Reminder (3:00 PM IST)
 * Sends personalized mid-day reminders to users who have pending tasks/snags.
 * Encourages them to update their progress before end of day.
 */
export async function runAfternoonProgressReminder() {
    console.log('☀️ Starting Afternoon Progress Reminder Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch pending calendar tasks
    const { data: calendarTasks } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, end_at, status')
        .in('status', ['todo', 'in_progress'])
        .lte('end_at', `${todayStr}T23:59:59`);

    // 2. Fetch pending project tasks
    const { data: projectTasks } = await supabaseAdmin
        .from('project_step_tasks')
        .select('id, title, assigned_to, estimated_completion_date, status')
        .in('status', ['todo', 'in_progress'])
        .lte('estimated_completion_date', todayStr);

    // 3. Fetch pending snags (assigned to users)
    const { data: pendingSnags } = await supabaseAdmin
        .from('snags')
        .select('id, assigned_to_user_id, status')
        .in('status', ['assigned']);

    // 4. Build per-user stats
    const userTaskCount: Record<string, number> = {};
    const userOverdueCount: Record<string, number> = {};
    const userSnagCount: Record<string, number> = {};

    const addTask = (userId: string, dueDate: string, isOverdue: boolean) => {
        if (isOverdue) {
            userOverdueCount[userId] = (userOverdueCount[userId] || 0) + 1;
        } else {
            userTaskCount[userId] = (userTaskCount[userId] || 0) + 1;
        }
    };

    calendarTasks?.forEach((t: any) => {
        const dueDate = new Date(t.end_at).toISOString().split('T')[0];
        const isOverdue = dueDate < todayStr;
        const assignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
        assignees.forEach((uid: string) => addTask(uid, dueDate, isOverdue));
    });

    projectTasks?.forEach((t: any) => {
        const dueDate = t.estimated_completion_date;
        const isOverdue = dueDate < todayStr;
        const assignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
        assignees.forEach((uid: string) => addTask(uid, dueDate, isOverdue));
    });

    pendingSnags?.forEach((s: any) => {
        if (s.assigned_to_user_id) {
            userSnagCount[s.assigned_to_user_id] = (userSnagCount[s.assigned_to_user_id] || 0) + 1;
        }
    });

    // 5. Get all relevant user IDs
    const allUserIds = new Set([
        ...Object.keys(userTaskCount),
        ...Object.keys(userOverdueCount),
        ...Object.keys(userSnagCount),
    ]);

    if (allUserIds.size === 0) {
        return { success: true, message: 'No users with pending items' };
    }

    // 6. Fetch user details
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role, designation, is_active')
        .in('id', Array.from(allUserIds))
        .eq('is_active', true);

    // 7. Send personalized reminders
    const updates = [];
    for (const user of (users || [])) {
        const isAdmin = user.role === 'admin' || user.designation?.toLowerCase().includes('hr');
        const tasks = userTaskCount[user.id] || 0;
        const overdue = userOverdueCount[user.id] || 0;
        const snags = userSnagCount[user.id] || 0;

        // Skip if nothing pending
        if (tasks === 0 && overdue === 0 && snags === 0) continue;

        const parts: string[] = [];
        if (tasks > 0) parts.push(`- ${tasks} task${tasks > 1 ? 's' : ''} due today`);
        if (overdue > 0) parts.push(`- ${overdue} overdue task${overdue > 1 ? 's' : ''} still pending`);
        if (snags > 0) parts.push(`- ${snags} snag${snags > 1 ? 's' : ''} assigned to you`);

        const urgencyNote = overdue > 0 ? ' Please prioritize overdue items.' : '';

        const message = `Hi ${user.full_name}! ☀️\n\nAfternoon check-in: Here's what's still pending:\n\n${parts.join('\n')}\n\nPlease update your progress now so the team stays in sync.${urgencyNote}`;

        updates.push(
            NotificationService.createNotification({
                userId: user.id,
                title: 'Afternoon Progress Check-In',
                message,
                type: 'general',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return {
        success: true,
        message: `Sent ${updates.length} afternoon reminders`,
        totalUsersWithPending: allUserIds.size
    };
}
