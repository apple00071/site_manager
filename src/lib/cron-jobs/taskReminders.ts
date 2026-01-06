import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function runTaskReminders() {
    console.log('⏰ Starting Task Reminder Logic');

    // Calculate "tomorrow" date string (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 2. Fetch tasks due tomorrow
    // We check two tables: `tasks` (Calendar Tasks) and `project_step_tasks` (Project Tasks)

    // standard tasks
    const { data: calendarTasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, end_at, project_id, projects(title)')
        .eq('status', 'todo') // Only pending tasks
        .filter('end_at', 'gte', `${tomorrowStr}T00:00:00`)
        .filter('end_at', 'lt', `${tomorrowStr}T23:59:59`);

    if (tasksError) throw tasksError;

    // project step tasks
    const { data: projectTasks, error: stepTasksError } = await supabaseAdmin
        .from('project_step_tasks')
        .select('id, title, assigned_to, estimated_completion_date, step_id, project_steps(project_id, projects(title))')
        .eq('status', 'todo') // Only pending
        .eq('estimated_completion_date', tomorrowStr);

    if (stepTasksError) throw stepTasksError;

    // 3. Process & Send Notifications
    const updates = [];

    // Process Calendar Tasks
    if (calendarTasks) {
        for (const task of calendarTasks) {
            if (task.assigned_to) {
                console.log(`Sending reminder for Task ${task.id} to User ${task.assigned_to}`);
                updates.push(
                    NotificationService.createNotification({
                        userId: task.assigned_to,
                        title: 'Task Due Tomorrow',
                        message: `Reminder: "${task.title}" is due tomorrow.`,
                        type: 'task_assigned', // Re-using existing type or could add 'reminder'
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
                const projectName = task.project_steps?.projects?.title || 'Project';
                console.log(`Sending reminder for Project Task ${task.id} to User ${task.assigned_to}`);
                updates.push(
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

    await Promise.allSettled(updates);

    return {
        success: true,
        message: `Sent ${updates.length} reminders`,
        processed: {
            calendarTasks: calendarTasks?.length || 0,
            projectTasks: projectTasks?.length || 0
        }
    };
}
