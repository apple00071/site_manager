import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

/**
 * Admin Assign Reminder (10:30 AM IST)
 * Notifies Admin only to assign tasks to members
 */
export async function runAdminAssignReminder() {
    console.log('👑 Starting Admin Assign Reminder Logic');

    const { data: admins, error: adminsError } = await supabaseAdmin
        .from('users')
        .select('id, full_name')
        .eq('role', 'admin');

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) {
        return { success: true, message: 'No admins found' };
    }

    const updates = [];
    for (const admin of admins) {
        updates.push(
            NotificationService.createNotification({
                userId: admin.id,
                title: 'Assign Tasks Reminder',
                message: `Good Morning! Please ensure all tasks are assigned to the team members for today.`,
                type: 'general',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent reminders to ${admins.length} admins` };
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
                title: 'Task Check-up',
                message: `Time for a quick check! Please review your assigned projects and tasks for the second half of the day.`,
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
 * Notifies Admin to check the team's progress
 */
export async function runAdminTaskCheckReminder() {
    console.log('🏁 Starting Admin Task Check Reminder Logic');

    const { data: admins, error: adminsError } = await supabaseAdmin
        .from('users')
        .select('id, full_name')
        .eq('role', 'admin');

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) {
        return { success: true, message: 'No admins found' };
    }

    const updates = [];
    for (const admin of admins) {
        updates.push(
            NotificationService.createNotification({
                userId: admin.id,
                title: 'Review Team Progress',
                message: `Good Evening! Please check the status of tasks assigned to team members today.`,
                type: 'general',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent review reminders to ${admins.length} admins` };
}
