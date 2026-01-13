import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function runTaskReminders() {
    console.log('⏰ Starting Task Reminder Logic (Next 30 Mins)');

    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    // For DATE columns (Project Tasks), we can only sanity check if it's "Today"
    const todayStr = now.toISOString().split('T')[0];

    // 2. Fetch tasks starting SOON

    // A. Calendar Tasks (Has Time Precision)
    // We want tasks where start_at is between NOW and NOW+30min AND NOT reminded yet
    const { data: calendarTasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, start_at, project_id, projects(title), users:assigned_to(full_name)')
        .eq('status', 'todo')
        .is('reminded_at', null)
        .gt('start_at', now.toISOString())
        .lte('start_at', thirtyMinutesFromNow.toISOString());

    if (tasksError) throw tasksError;

    // 3. Process & Send Notifications
    const updates = [];
    const remindedIds: string[] = [];

    // Process Calendar Tasks
    if (calendarTasks && calendarTasks.length > 0) {
        for (const task of calendarTasks) {
            if (task.assigned_to) {
                console.log(`Sending immediate reminder for Task ${task.id} to User ${task.assigned_to}`);

                // Format time for message (e.g. "10:30 AM")
                const startTime = new Date(task.start_at).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata' // IST
                });

                const projectTitle = Array.isArray(task.projects) ? task.projects[0]?.title : (task.projects as any)?.title;
                const userFullName = (task.users as any)?.full_name || 'there';

                updates.push(
                    NotificationService.createNotification({
                        userId: task.assigned_to,
                        title: 'Task Starting Soon',
                        message: `Just a reminder that the following task is starting at ${startTime}:\n- Title: ${task.title}\n${projectTitle ? `- Project: ${projectTitle}` : "- Details: Standalone Task"}\n\nHope it goes smoothly!`,
                        type: 'task_assigned',
                        relatedId: task.id,
                        relatedType: 'task',
                        skipInApp: false
                    })
                );
                remindedIds.push(task.id);
            }
        }
    }

    // Mark tasks as reminded
    if (remindedIds.length > 0) {
        await supabaseAdmin
            .from('tasks')
            .update({ reminded_at: now.toISOString() })
            .in('id', remindedIds);
    }

    await Promise.allSettled(updates);

    return {
        success: true,
        message: `Sent ${updates.length} immediate reminders`,
        processed: {
            calendarTasks: calendarTasks?.length || 0,
            projectTasks: 0
        }
    };
}
