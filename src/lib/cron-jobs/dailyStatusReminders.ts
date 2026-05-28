import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

/**
 * Admin Assign Reminder (10:30 AM IST)
 * Notifies Admin only to assign tasks to members
 */
export async function runAdminAssignReminder() {
    console.log('👑 Starting Admin Assign Reminder Logic');

    const { data: allUsers, error: recipientsError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role, designation')
        .eq('is_active', true);

    if (recipientsError) throw recipientsError;
    const recipients = allUsers?.filter((u: any) => u.role === 'admin' || u.designation?.toLowerCase() === 'hr') || [];
    if (recipients.length === 0) {
        return { success: true, message: 'No admins or HR users found' };
    }

    const updates = [];
    for (const recipient of recipients) {
        updates.push(
            NotificationService.createNotification({
                userId: recipient.id,
                title: 'Team Task Allocation',
                message: `Hello ${recipient.full_name}, this is a reminder to review and finalize task assignments for the team to ensure everyone is set for the day.`,
                type: 'general',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent reminders to ${recipients.length} admins/HR` };
}

/**
 * Member Checkup Reminder (1:00 PM IST)
 * Notifies members to check on their assigned projects/tasks
 */
export async function runMemberCheckupReminder() {
    console.log('👥 Starting Member Checkup Reminder Logic');

    // Fetch users who have assigned tasks or project steps
    const todayStr = new Date().toISOString().split('T')[0];

    // Get unique user IDs of people assigned to active/todo tasks today
    const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('assigned_to')
        .neq('status', 'done')
        .neq('status', 'cancelled');

    const { data: projectTasks } = await supabaseAdmin
        .from('project_step_tasks')
        .select('assigned_to')
        .neq('status', 'done')
        .neq('status', 'cancelled');

    const userIds = new Set([
        ...(tasks?.map((t: any) => t.assigned_to) || []),
        ...(projectTasks?.map((t: any) => t.assigned_to) || [])
    ].filter(Boolean));

    if (userIds.size === 0) {
        return { success: true, message: 'No members with active tasks found' };
    }

    const updates = [];
    for (const userId of userIds) {
        updates.push(
            NotificationService.createNotification({
                userId: userId as string,
                title: 'How is your day going?',
                message: `Please take a quick moment to update the status of your active projects and tasks if you have any progress to share.`,
                type: 'general',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent check-up reminders to ${userIds.size} members` };
}

/**
 * Admin Task Verification Reminder (5:30 PM IST)
 * Notifies Admin to check the team's progress + snag summary
 */
export async function runAdminTaskCheckReminder() {
    console.log('🏁 Starting Admin Task Check Reminder Logic');

    const { data: allUsers, error: adminsError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role, designation')
        .eq('is_active', true);

    if (adminsError) throw adminsError;
    const admins = allUsers?.filter((u: any) => u.role === 'admin' || u.designation?.toLowerCase() === 'hr') || [];
    const members = allUsers?.filter((u: any) => u.role !== 'admin' && u.designation?.toLowerCase() !== 'hr') || [];
    if (admins.length === 0 && members.length === 0) {
        return { success: true, message: 'No active users found' };
    }

    // Fetch snag summary for end-of-day report
    const { data: openSnags } = await supabaseAdmin
        .from('snags')
        .select('id, status, assigned_to_user_id')
        .in('status', ['open', 'assigned', 'resolved']);

    const totalOpen = (openSnags || []).filter((s: any) => s.status === 'open').length;
    const totalAssigned = (openSnags || []).filter((s: any) => s.status === 'assigned').length;
    const totalResolved = (openSnags || []).filter((s: any) => s.status === 'resolved').length;

    // Build snag summary line for admins
    let snagSummary = '';
    if (totalOpen + totalAssigned + totalResolved > 0) {
        snagSummary = `\n\n📋 Snag Summary:\n- Open (Unassigned): ${totalOpen}\n- Assigned (In Progress): ${totalAssigned}\n- Resolved (Pending Verification): ${totalResolved}`;
    }

    // 2. Fetch Tasks due today or earlier for summaries
    const todayStr = new Date().toISOString().split('T')[0];

    // Calendar Tasks
    const { data: calendarTasks } = await supabaseAdmin
        .from('tasks')
        .select('id, end_at, assigned_to, status')
        .neq('status', 'cancelled')
        .lte('end_at', `${todayStr}T23:59:59`);

    // Project Tasks
    const { data: projectTasks } = await supabaseAdmin
        .from('project_step_tasks')
        .select('id, estimated_completion_date, assigned_to, status')
        .neq('status', 'cancelled')
        .lte('estimated_completion_date', todayStr);

    const allDueTasks = [...(calendarTasks || []), ...(projectTasks || [])];
    const totalTasksCompleted = allDueTasks.filter((t: any) => t.status === 'done').length;
    const totalTasksInProgress = allDueTasks.filter((t: any) => t.status === 'in_progress').length;
    const totalTasksTodo = allDueTasks.filter((t: any) => t.status === 'todo').length;

    let taskSummary = '';
    if (allDueTasks.length > 0) {
        taskSummary = `\n\n📋 Task Summary:\n- Completed: ${totalTasksCompleted}\n- In Progress: ${totalTasksInProgress}\n- Overdue / Remaining: ${totalTasksTodo}`;
    }

    const updates = [];

    // 1. Send EOD Reviews to Admins
    for (const admin of admins) {
        updates.push(
            NotificationService.createNotification({
                userId: admin.id,
                title: 'End of Day Review',
                message: `Hi ${admin.full_name}, please take a moment to review the team's task updates and completions as we wrap up today's work.${taskSummary}${snagSummary}`,
                type: 'general',
                skipInApp: true
            })
        );
    }

    // 3. Map Pending Tasks for Members
    const pendingTasksMap: Record<string, number> = {};
    const addPending = (userId: string) => {
        pendingTasksMap[userId] = (pendingTasksMap[userId] || 0) + 1;
    };

    calendarTasks?.forEach((t: any) => {
        if (t.status !== 'done' && t.assigned_to) {
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach((uid: any) => addPending(uid));
            } else {
                addPending(t.assigned_to);
            }
        }
    });

    projectTasks?.forEach((t: any) => {
        if (t.status !== 'done' && t.assigned_to) {
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach((uid: any) => addPending(uid));
            } else {
                addPending(t.assigned_to);
            }
        }
    });

    // Group snags by member
    const userSnagStats: Record<string, { assigned: number; resolved: number }> = {};
    (openSnags || []).forEach((snag: any) => {
        if (snag.assigned_to_user_id) {
            if (!userSnagStats[snag.assigned_to_user_id]) {
                userSnagStats[snag.assigned_to_user_id] = { assigned: 0, resolved: 0 };
            }
            if (snag.status === 'assigned') {
                userSnagStats[snag.assigned_to_user_id].assigned++;
            } else if (snag.status === 'resolved') {
                userSnagStats[snag.assigned_to_user_id].resolved++;
            }
        }
    });

    // Send EOD Reviews to Members who have pending tasks/snags
    for (const member of members) {
        const pendingTasks = pendingTasksMap[member.id] || 0;
        const assignedSnags = userSnagStats[member.id]?.assigned || 0;
        const resolvedSnags = userSnagStats[member.id]?.resolved || 0;

        if (pendingTasks > 0 || assignedSnags > 0 || resolvedSnags > 0) {
            const parts = [];
            if (pendingTasks > 0) parts.push(`Pending Tasks: ${pendingTasks}`);
            if (assignedSnags > 0) parts.push(`Pending Snags: ${assignedSnags} Assigned to You`);
            if (resolvedSnags > 0) parts.push(`Resolved Snags: ${resolvedSnags} (Pending Verification)`);

            const message = `Hi ${member.full_name}, as we wrap up today's work, here is a quick review of your items:\n- ${parts.join('\n- ')}\n\nPlease ensure your progress is fully updated in the app. Thank you!`;

            updates.push(
                NotificationService.createNotification({
                    userId: member.id,
                    title: 'End of Day Review',
                    message,
                    type: 'general',
                    skipInApp: true
                })
            );
        }
    }

    await Promise.allSettled(updates);
    return {
        success: true,
        message: `Sent review reminders to ${admins.length} admins and ${updates.length - admins.length} members`,
        snagSummary: { totalOpen, totalAssigned, totalResolved }
    };

}
