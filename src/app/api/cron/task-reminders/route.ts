import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Validate Cron Secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Return 401 but generic message to avoid leaking existence
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('⏰ Starting Task Reminder Cron Job');

        const now = new Date();
        const nowIso = now.toISOString();

        // --- 1. PROACTIVE REMINDERS (1 HOUR BEFORE START) ---
        // Fetch Calendar Tasks starting in approximately 1 hour (45 to 105 mins from now)
        // that haven't been notified yet.
        const oneHourStart = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
        const oneHourEnd = new Date(now.getTime() + 105 * 60 * 1000).toISOString();

        console.log(`Checking for tasks starting between ${oneHourStart} and ${oneHourEnd}`);

        const { data: upcomingTasks, error: upcomingError } = await supabaseAdmin
            .from('tasks')
            .select('id, title, assigned_to, start_at, project_id, projects(title)')
            .neq('status', 'done')
            .is('reminder_sent_at', null)
            .gte('start_at', oneHourStart)
            .lte('start_at', oneHourEnd);

        if (upcomingError) {
            console.error('Error fetching upcoming tasks:', upcomingError);
        }

        const proactiveUpdates = [];
        if (upcomingTasks && upcomingTasks.length > 0) {
            console.log(`Found ${upcomingTasks.length} tasks for 1-hour reminder`);
            for (const task of upcomingTasks) {
                if (task.assigned_to) {
                    const projectName = (task.projects as any)?.title || 'Task';
                    proactiveUpdates.push(
                        NotificationService.createNotification({
                            userId: task.assigned_to,
                            title: 'Task Starting Soon',
                            message: `Reminder: "${task.title}" in ${projectName} starts in 1 hour.`,
                            type: 'task_assigned',
                            relatedId: task.id,
                            relatedType: 'task',
                            skipInApp: false // Show in-app for immediate awareness
                        }).then(async () => {
                            // Mark as sent
                            await supabaseAdmin
                                .from('tasks')
                                .update({ reminder_sent_at: nowIso })
                                .eq('id', task.id);
                        })
                    );
                }
            }
        }

        // --- 2. SUMMARY REMINDERS (DUE TOMORROW) ---
        // Calculate "tomorrow" date string (YYYY-MM-DD)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // Fetch tasks due tomorrow
        const { data: calendarTasks, error: tasksError } = await supabaseAdmin
            .from('tasks')
            .select('id, title, assigned_to, end_at, project_id, projects(title)')
            .eq('status', 'todo')
            .filter('end_at', 'gte', `${tomorrowStr}T00:00:00`)
            .filter('end_at', 'lt', `${tomorrowStr}T23:59:59`);

        if (tasksError) throw tasksError;

        const { data: projectTasks, error: stepTasksError } = await supabaseAdmin
            .from('project_step_tasks')
            .select('id, title, assigned_to, estimated_completion_date, step_id, project_steps(project_id, projects(title))')
            .eq('status', 'todo')
            .eq('estimated_completion_date', tomorrowStr);

        if (stepTasksError) throw stepTasksError;

        const summaryUpdates = [];
        // Process Calendar Tasks
        if (calendarTasks) {
            for (const task of calendarTasks) {
                if (task.assigned_to) {
                    summaryUpdates.push(
                        NotificationService.createNotification({
                            userId: task.assigned_to,
                            title: 'Task Due Tomorrow',
                            message: `Reminder: "${task.title}" is due tomorrow.`,
                            type: 'task_assigned',
                            relatedId: task.id,
                            relatedType: 'task',
                            skipInApp: true
                        })
                    );
                }
            }
        }

        // Process Project Tasks
        if (projectTasks) {
            for (const task of projectTasks) {
                if (task.assigned_to) {
                    const projectName = (task.project_steps as any)?.projects?.title || 'Project';
                    summaryUpdates.push(
                        NotificationService.createNotification({
                            userId: task.assigned_to,
                            title: 'Project Task Due Tomorrow',
                            message: `Reminder: "${task.title}" in ${projectName} is due tomorrow.`,
                            type: 'task_assigned',
                            relatedId: task.id,
                            relatedType: 'project_task',
                            skipInApp: true
                        })
                    );
                }
            }
        }

        // Wait for all notifications to be sent
        await Promise.allSettled([...proactiveUpdates, ...summaryUpdates]);

        return NextResponse.json({
            success: true,
            total_sent: proactiveUpdates.length + summaryUpdates.length,
            proactive_sent: proactiveUpdates.length,
            summary_sent: summaryUpdates.length,
            processed: {
                upcomingTasks: upcomingTasks?.length || 0,
                calendarTasks: calendarTasks?.length || 0,
                projectTasks: projectTasks?.length || 0
            }
        });

    } catch (error: any) {
        console.error('Task Reminder Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
