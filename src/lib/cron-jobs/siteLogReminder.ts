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

    // 4. Identify projects missing logs and notify relevant members
    const updates = [];
    for (const project of projects) {
        if (projectsWithLogs.has(project.id)) continue;

        // Fetch all members of this project to find Site Engineers, Designers, and HR
        const { data: members } = await supabaseAdmin
            .from('project_members')
            .select(`
                user_id,
                users:user_id (
                    id,
                    full_name,
                    designation,
                    role
                )
            `)
            .eq('project_id', project.id);

        const projectUsers = (members || []).map((m: any) => m.users).filter(Boolean);

        // Always include the project creator/assigned lead
        const primaryUserId = project.assigned_employee_id || project.created_by;
        const targetUserIds = new Set<string>();
        if (primaryUserId) targetUserIds.add(primaryUserId);

        // Add anyone with relevant roles/designations
        projectUsers.forEach((user: any) => {
            const role = (user.role || '').toLowerCase();
            const designation = (user.designation || '').toLowerCase();

            if (
                role === 'hr' ||
                designation.includes('site engineer') ||
                designation.includes('designer') ||
                designation.includes('hr')
            ) {
                targetUserIds.add(user.id);
            }
        });

        console.log(`[Missing Site Log] Project: "${project.title}". Notifying ${targetUserIds.size} members.`);

        for (const userId of targetUserIds) {
            updates.push(
                NotificationService.createNotification({
                    userId,
                    title: 'Missing Site Log & DPR',
                    message: `Reminder: No site log has been submitted for project "${project.title}" today. Please submit your Site Log and DPR (Daily Progress Report) to Admin.`,
                    type: 'site_log_submitted',
                    relatedId: project.id,
                    relatedType: 'project',
                    skipInApp: true
                })
            );
        }
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
