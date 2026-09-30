import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { attachProjectCodes } from '@/lib/projectUtils';

export interface ChecklistReminderStats {
  checkedProjects: number;
  eligibleProjects: number;
  remindersSent: number;
  fullyFilled: number;
  alreadyNotifiedToday: number;
  errors: string[];
}

/**
 * Runs the daily checklist reminder for designers.
 * Rules:
 * 1. Checks all active projects (not completed/handover).
 * 2. Designer assigned >= 25 days ago (based on designer_assigned_at, start_date, or created_at).
 * 3. Checklist in `project_requirements` is NOT fully filled:
 *    - Has 0 items (never created/synced), OR
 *    - Has items with missing `designer_specs` (!item.designer_specs || !item.designer_specs.trim()).
 * 4. Dispatches In-App notification, Push notification, and WhatsApp message to the assigned designer.
 * 5. Prevents duplicate notifications within the same calendar day.
 */
export async function runChecklistSpecsReminder(): Promise<{ success: boolean; stats: ChecklistReminderStats }> {
  console.log('📋 Starting Checklist Specs Reminder Logic (25-day overdue check)...');

  const stats: ChecklistReminderStats = {
    checkedProjects: 0,
    eligibleProjects: 0,
    remindersSent: 0,
    fullyFilled: 0,
    alreadyNotifiedToday: 0,
    errors: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // 1. Fetch active projects with an assigned designer
  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select(`
      id,
      title,
      customer_name,
      status,
      workflow_stage,
      assigned_employee_id,
      designer_id,
      designer_assigned_at,
      start_date,
      created_at,
      assigned_employee:assigned_employee_id(id, full_name, username, phone_number, email)
    `)
    .not('status', 'eq', 'completed')
    .not('workflow_stage', 'eq', 'completed');

  if (projectsError) {
    console.error('Error fetching projects for checklist reminder:', projectsError);
    stats.errors.push(projectsError.message);
    return { success: false, stats };
  }

  stats.checkedProjects = (projects || []).length;

  for (const project of (projects || [])) {
    try {
      const designerId = project.assigned_employee_id || project.designer_id;
      if (!designerId) continue;

      // 2. Calculate days since assigned
      const assignedDateRaw = project.designer_assigned_at || project.start_date || project.created_at;
      if (!assignedDateRaw) continue;

      const assignedDate = new Date(assignedDateRaw);
      const diffMs = now.getTime() - assignedDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Must be at least 25 days since assignment
      if (diffDays < 25) {
        continue;
      }

      stats.eligibleProjects++;

      // 3. Check requirements items in project_requirements
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('project_requirements')
        .select('id, designer_specs, status')
        .eq('project_id', project.id);

      if (itemsError) {
        console.error(`Error querying requirements for project ${project.id}:`, itemsError);
        stats.errors.push(`Project ${project.id}: ${itemsError.message}`);
        continue;
      }

      const totalItems = (items || []).length;
      const emptySpecsCount = (items || []).filter(
        (it: any) => !it.designer_specs || !it.designer_specs.trim()
      ).length;

      // If items exist and all items have designer specs filled, it is fully filled!
      if (totalItems > 0 && emptySpecsCount === 0) {
        stats.fullyFilled++;
        continue;
      }

      // 4. Rate-limit: Check if already notified today for this project
      const { data: existingNotif } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', designerId)
        .eq('related_id', project.id)
        .eq('type', 'checklist_pending')
        .gte('created_at', todayStart)
        .maybeSingle();

      if (existingNotif) {
        stats.alreadyNotifiedToday++;
        continue;
      }

      // 5. Build clean project code & title
      const codedProject = await attachProjectCodes(project);
      const rawCode = codedProject?.project_code || `AI-${project.id.slice(0, 4)}`;
      const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
      const cleanTitle = (project.title || 'Project').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

      const missingText = totalItems === 0
        ? 'execution checklist has not been created/synced yet'
        : `${emptySpecsCount} out of ${totalItems} items need execution specs (laminates, finishes)`;

      const notifTitle = `Checklist Specs Pending: ${projectCode}`;
      const notifMessage = `Project "${cleanTitle}" was assigned ${diffDays} days ago, but the requirement checklist is not fully filled (${missingText}). Please complete the execution specifications.`;

      // 6. Send in-app and push notification
      await NotificationService.createNotification({
        userId: designerId,
        title: notifTitle,
        message: notifMessage,
        type: 'checklist_pending',
        relatedId: project.id,
        relatedType: 'project',
        metadata: {
          projectId: project.id,
          projectCode,
          daysAssigned: diffDays,
          emptySpecsCount,
          totalItems,
          route: `/dashboard/projects/${project.id}?stage=requirement&tab=checklist`
        }
      });

      // 7. Send WhatsApp if phone number exists
      const designer = (project.assigned_employee as any) || {};
      const phoneNumber = designer.phone_number;
      if (phoneNumber) {
        const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.decorai.co.in';
        const link = `${origin}/dashboard/projects/${project.id}?stage=requirement&tab=checklist`;
        const designerName = designer.full_name || designer.username || 'Designer';

        const waMessage = `⚠️ *Requirement Checklist Pending*\n\nHello ${designerName},\n\nProject: *${cleanTitle}* (${projectCode})\nAssigned: ${diffDays} days ago\nChecklist Status: ${missingText}\n\nPlease complete the laminate codes and material execution specifications:\n\n🔗 ${link}`;

        await sendCustomWhatsAppNotification(phoneNumber, waMessage);
      }

      stats.remindersSent++;
      console.log(`[ChecklistReminder] Sent reminder to designer ${designerId} for project ${projectCode} (${diffDays} days assigned, ${emptySpecsCount} missing specs)`);
    } catch (err: any) {
      console.error(`Error processing project ${project.id} for checklist reminder:`, err);
      stats.errors.push(`Project ${project.id}: ${err.message}`);
    }
  }

  console.log('📋 Finished Checklist Specs Reminder Logic:', stats);
  return { success: true, stats };
}
