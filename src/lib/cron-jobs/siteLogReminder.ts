import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function runSiteLogReminder() {
    console.log('📝 Starting Site Log Reminder Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Fetch all active projects
    const { data: projects, error: projectsError } = await supabaseAdmin
        .from('projects')
        .select('id, title, assigned_employee_id, created_by, status')
        .in('status', ['active', 'in_progress']);

    if (projectsError) throw projectsError;
    if (!projects || projects.length === 0) {
        return { success: true, message: 'No active projects found' };
    }

    // 3. Fetch all site logs for today
    const { data: todayLogs, error: logsError } = await supabaseAdmin
        .from('site_logs')
        .select('project_id')
        .eq('log_date', todayStr);

    if (logsError) throw logsError;

    const projectsWithLogs = new Set(todayLogs?.map((log: any) => log.project_id) || []);

    // 4. Identify projects missing logs and notify
    const updates = [];
    for (const project of projects) {
        if (projectsWithLogs.has(project.id)) continue;

        // Notify Assigned Employee (PM/Designer) or Project Creator
        const notifyUserId = project.assigned_employee_id || project.created_by;
        if (!notifyUserId) continue;

        console.log(`Reminding User ${notifyUserId} about missing log for project "${project.title}"`);

        updates.push(
            NotificationService.createNotification({
                userId: notifyUserId,
                title: 'Missing Site Log',
                message: `Reminder: No site log has been submitted for project "${project.title}" today. Please update the work status.`,
                type: 'site_log_submitted',
                relatedId: project.id,
                relatedType: 'project',
                skipInApp: true // Periodic reminders bypass in-app bell
            })
        );
    }

    const results = await Promise.allSettled(updates);
    const successCount = results.filter(r => r.status === 'fulfilled').length;

    return {
        success: true,
        message: `Processed ${projects.length} projects. Sent ${successCount} reminders.`,
        stats: {
            totalActive: projects.length,
            missingLogs: updates.length,
            notified: successCount
        }
    };
}
