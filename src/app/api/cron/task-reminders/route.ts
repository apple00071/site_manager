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
                const assignedIds = Array.isArray(task.assigned_to) 
                    ? task.assigned_to 
                    : (task.assigned_to ? [task.assigned_to] : []);
                
                if (assignedIds.length > 0) {
                    const projectName = (task.projects as any)?.title || 'Task';
                    for (const assigneeId of assignedIds) {
                        proactiveUpdates.push(
                            NotificationService.createNotification({
                                userId: assigneeId,
                                title: 'Task Starting Soon',
                                message: `Reminder: "${task.title}" in ${projectName} starts in 1 hour.`,
                                type: 'task_assigned',
                                relatedId: task.id,
                                relatedType: 'task',
                                skipInApp: false
                            })
                        );
                    }
                    
                    // Mark as sent after queuing all notifications for this task
                    proactiveUpdates.push(
                        supabaseAdmin
                            .from('tasks')
                            .update({ reminder_sent_at: nowIso })
                            .eq('id', task.id)
                    );
                }
            }
        }

        // --- 2. SUMMARY REMINDERS (DUE TOMORROW) ---
        // Calculate "tomorrow" date string (YYYY-MM-DD)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // Fetch tasks due tomorrow (both calendar and project step tasks)
        const { data: dueTomorrowTasks, error: tasksError } = await supabaseAdmin
            .from('tasks')
            .select(`
                id, 
                title, 
                assigned_to, 
                end_at, 
                estimated_completion_date, 
                project_id, 
                step_id, 
                projects(title),
                project_steps(project_id, projects(title))
            `)
            .eq('status', 'todo')
            .or(`and(end_at.gte.${tomorrowStr}T00:00:00,end_at.lt.${tomorrowStr}T23:59:59),estimated_completion_date.eq.${tomorrowStr}`);

        if (tasksError) throw tasksError;

        const summaryUpdates = [];
        if (dueTomorrowTasks) {
            for (const task of dueTomorrowTasks) {
                const assignedIds = Array.isArray(task.assigned_to) 
                    ? task.assigned_to 
                    : (task.assigned_to ? [task.assigned_to] : []);
                
                const projectName = (task.projects as any)?.title || (task.project_steps as any)?.projects?.title || 'Project';
                const taskType = task.step_id ? 'project_task' : 'task';
                const titleText = task.step_id ? 'Project Task Due Tomorrow' : 'Task Due Tomorrow';
                const messageText = task.step_id 
                    ? `Reminder: "${task.title}" in ${projectName} is due tomorrow.`
                    : `Reminder: "${task.title}" is due tomorrow.`;

                for (const assigneeId of assignedIds) {
                    summaryUpdates.push(
                        NotificationService.createNotification({
                            userId: assigneeId,
                            title: titleText,
                            message: messageText,
                            type: 'task_assigned',
                            relatedId: task.id,
                            relatedType: taskType,
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
                dueTomorrowTasks: dueTomorrowTasks?.length || 0
            }
        });

    } catch (error: any) {
        console.error('Task Reminder Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
