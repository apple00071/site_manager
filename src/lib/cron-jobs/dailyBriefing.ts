import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function runDailyBriefing() {
    console.log('🌅 Starting Daily Briefing Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Fetch tasks due TODAY or OVERDUE (status=todo/in_progress)

    // Calendar Tasks
    // We get everything with status NOT done/completed
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

    // 3. Group by User
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

    calendarTasks?.forEach((t: any) => t.assigned_to && processTask(t.assigned_to, t.end_at));
    projectTasks?.forEach((t: any) => t.assigned_to && processTask(t.assigned_to, t.estimated_completion_date));

    // 4. Send Briefings to ALL users with a device token
    const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('id, full_name');

    const updates = [];
    for (const user of (allUsers || [])) {
        const stats = userStats[user.id] || { today: 0, overdue: 0 };

        const message = `*Your Daily Overview*\n\nHello ${user.full_name},\n\nHere is a look at your tasks for today:\n- Due Today: ${stats.today}\n- Overdue: ${stats.overdue}\n\nWishing you a productive and successful day ahead.`;

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
        stats: userStats
    };
}
