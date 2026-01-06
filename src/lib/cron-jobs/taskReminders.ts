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
    // We want tasks where start_at is between NOW and NOW+30min
    const { data: calendarTasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, start_at, project_id, projects(title)')
        .eq('status', 'todo')
        .gt('start_at', now.toISOString())
        .lte('start_at', thirtyMinutesFromNow.toISOString());

    if (tasksError) throw tasksError;

    // B. Project Tasks (Date Only - No Time)
    // We can't do "30 mins" logic here. We can only do "Starts Today".
    // To avoid spamming every 30 mins, we should arguably NOT include these here 
    // OR only include them if we had a way to mark them "reminded".
    // For now, based on user request, we will SKIP project tasks for this high-frequency check
    // unless the user explicitly asks for "Today" spam.
    // However, to be safe, let's just log them or maybe only send them ONCE a day?
    // Let's stick to the Calendar Tasks which support the feature requested ("next 30 mins").

    /* 
       NOTE: Project Step Tasks only have DATE precision. 
       We cannot check "next 30 minutes". 
       So we only return Calendar Tasks for this specific job type.
    */
    const projectTasks: any[] = [];

    // 3. Process & Send Notifications
    const updates = [];

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
                    timeZone: 'Asia/Kolkata' // Assuming IST presence
                });

                updates.push(
                    NotificationService.createNotification({
                        userId: task.assigned_to,
                        title: 'Task Starting Soon',
                        message: `Reminder: "${task.title}" starts at ${startTime}.`,
                        type: 'task_assigned',
                        relatedId: task.id,
                        relatedType: 'task',
                        skipInApp: false // Important! Show this!
                    })
                );
            }
        }
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
