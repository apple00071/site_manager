import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Validate Cron Secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('🌅 Starting Daily Briefing Cron Job');

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

        // Snags
        const { data: assignedSnags, error: snagsError } = await supabaseAdmin
            .from('snags')
            .select('id, assigned_to_user_id')
            .eq('status', 'assigned');

        if (snagsError) throw snagsError;

        // 3. Group by User
        const userStats: Record<string, { today: number; overdue: number; snags: number }> = {};

        const processTask = (userId: string, dueDate: string | Date) => {
            if (!userStats[userId]) userStats[userId] = { today: 0, overdue: 0, snags: 0 };

            const taskDate = new Date(dueDate).toISOString().split('T')[0];
            if (taskDate === todayStr) {
                userStats[userId].today++;
            } else if (taskDate < todayStr) {
                userStats[userId].overdue++;
            }
        };

        calendarTasks?.forEach((t: any) => t.assigned_to && processTask(t.assigned_to, t.end_at));
        projectTasks?.forEach((t: any) => t.assigned_to && processTask(t.assigned_to, t.estimated_completion_date));
        assignedSnags?.forEach((s: any) => {
            if (s.assigned_to_user_id) {
                if (!userStats[s.assigned_to_user_id]) userStats[s.assigned_to_user_id] = { today: 0, overdue: 0, snags: 0 };
                userStats[s.assigned_to_user_id].snags++;
            }
        });

        // 4. Send Briefings
        const updates = [];
        for (const [userId, stats] of Object.entries(userStats)) {
            if (stats.today === 0 && stats.overdue === 0 && stats.snags === 0) continue;

            let message = '';
            const taskParts = [];
            if (stats.today > 0) taskParts.push(`${stats.today} tasks due today`);
            if (stats.overdue > 0) taskParts.push(`${stats.overdue} overdue tasks`);

            if (taskParts.length > 0) {
                message = `Good Morning! You have ${taskParts.join(' and ')}.`;
            } else if (stats.snags > 0) {
                message = `Good Morning! You have some work pending.`;
            }

            if (stats.snags > 0) {
                message += ` Also, you have ${stats.snags} pending snags assigned to you.`;
            }

            console.log(`Sending briefing to User ${userId}: ${message}`);
            updates.push(
                NotificationService.createNotification({
                    userId,
                    title: 'Daily Briefing',
                    message,
                    type: 'general',
                    relatedId: userId, // Direct to their dashboard/tasks
                    relatedType: 'daily_briefing',
                    skipInApp: true
                })
            );
        }

        await Promise.allSettled(updates);

        return NextResponse.json({
            success: true,
            message: `Sent ${updates.length} daily briefings`,
            stats: userStats
        });

    } catch (error: any) {
        console.error('Daily Briefing Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
