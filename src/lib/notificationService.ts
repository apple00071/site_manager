// Notification Service for creating and managing notifications
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

export type NotificationType =
  | 'task_assigned'
  | 'design_approved'
  | 'design_rejected'
  | 'design_uploaded'
  | 'project_update'
  | 'inventory_added'
  | 'comment_added'
  | 'bill_approved'
  | 'bill_rejected'
  | 'bill_resubmitted'
  | 'snag_created'
  | 'snag_assigned'
  | 'snag_resolved'
  | 'snag_verified'
  | 'snag_comment'
  | 'proposal_sent'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'invoice_created'
  | 'invoice_approved'
  | 'invoice_rejected'
  | 'mention'
  | 'general'
  | 'expense_created'
  | 'expense_approved'
  | 'site_log_submitted'
  | 'report_generated'
  | 'payment_recorded'
  | 'expense_rejected';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  relatedType?: string;
  skipInApp?: boolean;
}

export class NotificationService {
  static getNotificationUrl(type: NotificationType, relatedId?: string, relatedType?: string): string | undefined {
    // Base dashboard URL (Relative paths for Median internal navigation)
    const baseUrl = '/dashboard';

    switch (type) {
      case 'task_assigned':
        return relatedId ? `${baseUrl}/tasks?taskId=${relatedId}` : `${baseUrl}/tasks`;
      case 'snag_created':
      case 'snag_assigned':
      case 'snag_resolved':
      case 'snag_verified':
        if (relatedType === 'project' && relatedId) {
          return `${baseUrl}/projects/${relatedId}?stage=snag`;
        }
        return relatedId ? `${baseUrl}/snags?snagId=${relatedId}` : `${baseUrl}/snags`;
      case 'design_approved':
      case 'design_rejected':
      case 'design_uploaded':
      case 'comment_added':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=design` : undefined;
      case 'project_update':
      case 'mention':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=updates` : undefined;
      case 'inventory_added':
      case 'bill_approved':
      case 'bill_rejected':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=inventory` : undefined;
      case 'invoice_created':
      case 'invoice_approved':
      case 'invoice_rejected':
      case 'proposal_sent':
      case 'proposal_approved':
      case 'proposal_rejected':
      case 'payment_recorded':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=orders` : `${baseUrl}/tasks?category=proposals`;
      case 'expense_created':
      case 'expense_approved':
      case 'expense_rejected':
        return `${baseUrl}/office-expenses`;
      case 'site_log_submitted':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=dlogs` : undefined;
      case 'report_generated':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=reports` : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Primary method to send Push and WhatsApp notifications.
   * Optionally inserts into DB for In-App Bell notifications.
   */
  static async createNotification(params: CreateNotificationParams) {
    console.log('📢 NotificationService called:', JSON.stringify(params, null, 2));

    try {
      // 1. In-App Notification (Database Insertion)
      let savedNotification = null;
      if (!params.skipInApp) {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: params.userId,
            title: params.title,
            message: params.message,
            type: params.type,
            related_id: params.relatedId || null,
            related_type: params.relatedType || null,
            is_read: false,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Supabase insert failed:', error);
        } else {
          savedNotification = data;
          console.log('✅ In-app notification saved:', data.id);
        }
      } else {
        console.log('⏭️ Skipping in-app storage for this notification (reminder).');
      }

      // 2. Fetch User Data (Phone & OneSignal ID)
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('phone_number, onesignal_player_id')
        .eq('id', params.userId)
        .single();

      if (userError) {
        console.error('User lookup error:', userError);
      }

      const deepLinkRoute = this.getNotificationUrl(params.type, params.relatedId, params.relatedType);

      // 3. WhatsApp Notification
      if (user?.phone_number) {
        try {
          const waMessage = `🔔 *${params.title}*\n\n${params.message}${deepLinkRoute ? `\n\nOpen: ${process.env.NEXT_PUBLIC_APP_URL || ''}${deepLinkRoute}` : ''}`;
          await sendCustomWhatsAppNotification(user.phone_number, waMessage);
          console.log('✅ WhatsApp sent to:', user.phone_number);
        } catch (waError) {
          console.error('❌ WhatsApp failed:', waError);
        }
      }

      // 4. OneSignal Push Notification
      try {
        const { sendPushNotificationByUserId } = await import('@/lib/onesignal');
        const pushResult = await sendPushNotificationByUserId(
          params.userId,
          params.title,
          params.message,
          {
            type: params.type,
            relatedId: params.relatedId,
            relatedType: params.relatedType,
            route: deepLinkRoute,
          },
          deepLinkRoute
        );
        console.log('📲 OneSignal push result:', pushResult);
      } catch (pushError) {
        console.error('❌ Push failed:', pushError);
      }

      return { success: true, notification: savedNotification };
    } catch (error) {
      console.error('Error in NotificationService:', error);
      throw error;
    }
  }

  // Helper methods for common notification types
  static async notifyTaskAssigned(userId: string, taskTitle: string, projectName?: string, taskId?: string, priority: string = 'medium') {
    const projectPart = projectName ? `- Project: ${projectName}` : "- Details: General Task";
    return this.createNotification({
      userId,
      title: 'New Task Assignment',
      message: `Hi, you have a new task assigned:\n\n- Title: ${taskTitle}\n${projectPart}\n- Priority: ${priority}\n\nYou can view the full details in your dashboard.`,
      type: 'task_assigned',
      relatedId: taskId,
      relatedType: 'task'
    });
  }

  static async notifyProjectUpdate(userId: string, projectName: string, updateMessage: string, projectId?: string) {
    return this.createNotification({
      userId,
      title: 'Project Progress Update',
      message: `Project: ${projectName}\n\nThere is a new update regarding the progress: ${updateMessage}\n\nThank you for staying updated!`,
      type: 'project_update',
      relatedId: projectId,
      relatedType: 'project'
    });
  }

  static async notifyDesignApproved(userId: string, designName: string, projectName: string, projectId?: string) {
    return this.createNotification({
      userId,
      title: 'Design Approval Update',
      message: `Project: ${projectName}\n\nGood news! Your design "${designName}" has been reviewed and approved. You can move forward with the next steps.`,
      type: 'design_approved',
      relatedId: projectId,
      relatedType: 'project'
    });
  }

  static async notifySnagCreated(userId: string, description: string, contextName: string, snagId?: string, isProject: boolean = true) {
    const contextPrefix = isProject ? "Project" : "Site";
    return this.createNotification({
      userId,
      title: 'New Item for Review',
      message: `${contextPrefix}: ${contextName}\n\nA new snag has been reported and requires your attention:\n\nDescription: ${description}\n\nThank you for your help in resolving this.`,
      type: 'snag_created',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifySnagAssigned(userId: string, description: string, contextName: string, snagId?: string, isProject: boolean = true) {
    const contextPrefix = isProject ? "Project" : "Site";
    return this.createNotification({
      userId,
      title: 'New Item for Review',
      message: `${contextPrefix}: ${contextName}\n\nYou have been assigned to look into a reported issue:\n\nDescription: ${description}\n\nThank you for your help in resolving this.`,
      type: 'snag_assigned',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifySnagResolved(userId: string, description: string, contextName: string, snagId?: string, isProject: boolean = true) {
    const contextPrefix = isProject ? "Project" : "Site";
    return this.createNotification({
      userId,
      title: 'Snag Resolved',
      message: `${contextPrefix}: ${contextName}\nIssue: ${description}\n\nThis item has been marked as resolved and is now ready for verification.`,
      type: 'snag_resolved',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifySnagVerified(userId: string, description: string, contextName: string, snagId?: string, isProject: boolean = true) {
    const contextPrefix = isProject ? "Project" : "Site";
    return this.createNotification({
      userId,
      title: 'Snag Verified & Closed',
      message: `${contextPrefix}: ${contextName}\nIssue: ${description}\n\nThis item has been verified and successfully closed. Great job!`,
      type: 'snag_verified',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifySnagComment(userId: string, comment: string, contextName: string, snagId?: string, authorName: string = 'Someone') {
    return this.createNotification({
      userId,
      title: 'New Progress Update',
      message: `Update on "${contextName}" by ${authorName}:\n\n"${comment}"`,
      type: 'snag_comment',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifyProposalSent(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Sent to Client',
      message: `Project: ${projectName}\nProposal: ${proposalTitle}\n\nThe proposal has been successfully shared with the client for review.`,
      type: 'proposal_sent',
    });
  }

  static async notifyProposalApproved(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Approved',
      message: `Project: ${projectName}\nProposal: ${proposalTitle}\n\nGreat news! The client has approved the proposal.`,
      type: 'proposal_approved',
    });
  }

  static async notifyProposalRejected(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Update',
      message: `Project: ${projectName}\nProposal: ${proposalTitle}\n\nThe client has requested some changes to the proposal. Please review the details.`,
      type: 'proposal_rejected',
    });
  }

  static async notifyInvoiceCreated(userId: string, invoiceNumber: string, projectName: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'New Invoice Generated',
      message: `Project: ${projectName}\nInvoice: ${invoiceNumber}\nAmount: ₹${amount}\n\nThe invoice is now available for your review.`,
      type: 'invoice_created',
    });
  }

  static async notifyInvoiceApproved(userId: string, invoiceNumber: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Invoice Approved',
      message: `Invoice ${invoiceNumber} for project "${projectName}" has been approved. Thank you!`,
      type: 'invoice_approved',
    });
  }

  static async notifyInvoiceRejected(userId: string, invoiceNumber: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Invoice Review Feedback',
      message: `Invoice ${invoiceNumber} for project "${projectName}" requires some corrections. Please review the feedback.`,
      type: 'invoice_rejected',
    });
  }

  static async notifyBillResubmitted(userId: string, itemName: string, projectName: string, authorName: string, itemId: string) {
    return this.createNotification({
      userId,
      title: 'Bill Resubmitted for Review',
      message: `*Bill Resubmitted for Review*\n\nProject: ${projectName}\n${authorName} has resubmitted the bill for "${itemName}". Please review it at your convenience.`,
      type: 'bill_resubmitted',
      relatedId: itemId,
      relatedType: 'inventory_item'
    });
  }

  static async notifyBillApproved(userId: string, itemName: string, projectName: string, amount: number, itemId: string) {
    return this.createNotification({
      userId,
      title: 'Bill Approval Confirmation',
      message: `*Bill Approval Confirmation*\n\nProject: ${projectName}\nAmount: ₹${amount}\n\nThe bill for ${itemName} has been approved and is being processed for payment.`,
      type: 'bill_approved',
      relatedId: itemId,
      relatedType: 'inventory_item'
    });
  }

  static async notifyBillRejected(userId: string, itemName: string, projectName: string, itemId: string) {
    return this.createNotification({
      userId,
      title: 'Bill Review Feedback',
      message: `*Bill Review Feedback*\n\nProject: ${projectName}\nItem: ${itemName}\n\nYour submitted bill requires some corrections. Please check the feedback and resubmit when ready.`,
      type: 'bill_rejected',
      relatedId: itemId,
      relatedType: 'inventory_item'
    });
  }

  static async notifyMention(userId: string, mentionerName: string, contextName: string, message: string, relatedId: string, relatedType: string = 'project') {
    const contextLabel = relatedType === 'design_file' ? "Design File" : "Project";
    return this.createNotification({
      userId,
      title: 'New Mention',
      message: `${mentionerName} mentioned you in a discussion regarding ${contextLabel}: ${contextName}.\n\nContext: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
      type: 'mention',
      relatedId,
      relatedType
    });
  }

  static async notifyExpenseCreated(userId: string, description: string, amount: number, requesterName: string) {
    return this.createNotification({
      userId,
      title: 'New Office Expense Request',
      message: `Requester: ${requesterName}\nAmount: ₹${amount}\nPurpose: ${description}\n\nPlease take a look and approve this request at your convenience.`,
      type: 'expense_created',
    });
  }

  static async notifyExpenseApproved(userId: string, description: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Office Expense Approved',
      message: `Your request for ₹${amount} (${description}) has been approved. Thank you!`,
      type: 'expense_approved',
    });
  }

  static async notifyExpenseRejected(userId: string, description: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Office Expense Review',
      message: `Your request for ₹${amount} (${description}) could not be approved at this time. Please check the feedback.`,
      type: 'expense_rejected',
    });
  }

  static async notifyDesignCommentAdded(userId: string, authorName: string, fileName: string, commentText: string, designFileId: string, projectName?: string) {
    const contextPrefix = projectName ? `Project: ${projectName}` : `Design File: ${fileName}`;
    return this.createNotification({
      userId,
      title: 'New Design Comment',
      message: `${contextPrefix}\n\n${authorName} has shared a comment on "${fileName}":\n\n"${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
      type: 'comment_added',
      relatedId: designFileId,
      relatedType: 'design_file'
    });
  }

  static async notifySiteLogSubmitted(userId: string, projectName: string, creatorName: string) {
    return this.createNotification({
      userId,
      title: 'New Site Log Submitted',
      message: `${creatorName} has just submitted the Daily Site Log / DPR for project "${projectName}". You can review it in the dashboard.`,
      type: 'site_log_submitted',
    });
  }

  static async notifyReportGenerated(userId: string, projectName: string, reportDate: string, pdfUrl?: string) {
    return this.createNotification({
      userId,
      title: 'DPR Report Generated',
      message: `Project: ${projectName}\n\nThe latest progress report for ${reportDate} is now available for review.${pdfUrl ? `\n\nView PDF: ${pdfUrl}` : ''}`,
      type: 'report_generated',
    });
  }

  static async notifyPaymentRecorded(userId: string, projectName: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Payment Confirmation',
      message: `Project: ${projectName}\nAmount: ₹${amount}\n\nA new payment has been successfully recorded for this project.`,
      type: 'payment_recorded',
    });
  }

  /**
   * Fetches all relevant stakeholders for a project:
   * 1. Project Creator (Primary Admin)
   * 2. Global Admins
   * 3. Assigned Designer
   * 4. Project Members with Site Designations (Site Engineers, Supervisors)
   */
  static async getProjectStakeholders(projectId: string) {
    const stakeholders = new Set<string>();

    try {
      // 1. Get Project Basics (Creator and Designer)
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('created_by, designer_id, site_supervisor_id')
        .eq('id', projectId)
        .single();

      if (project) {
        if (project.created_by) stakeholders.add(project.created_by);
        if (project.designer_id) stakeholders.add(project.designer_id);
        if (project.site_supervisor_id) stakeholders.add(project.site_supervisor_id);
      }

      // 2. Get Global Admins
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin');

      admins?.forEach((admin: { id: string }) => stakeholders.add(admin.id));

      // 3. Get Project Members (specifically site supervisors/engineers)
      const { data: members } = await supabaseAdmin
        .from('project_members')
        .select(`
          user_id,
          users:users!project_members_user_id_fkey(id, designation)
        `)
        .eq('project_id', projectId);

      members?.forEach((member: any) => {
        if (member.user_id) {
          const designation = member.users?.designation?.toLowerCase() || '';
          // If they are a site supervisor or engineer, they are a stakeholder
          if (designation.includes('site') || designation.includes('supervisor') || designation.includes('engineer')) {
            stakeholders.add(member.user_id);
          }
        }
      });
    } catch (error) {
      console.error('Error fetching project stakeholders:', error);
    }

    return Array.from(stakeholders);
  }

  /**
   * Utility to notify all stakeholders of a project action
   */
  static async notifyStakeholders(projectId: string, excludeUserId: string | null, params: Omit<CreateNotificationParams, 'userId'>) {
    const stakeholderIds = await this.getProjectStakeholders(projectId);

    const notifications = stakeholderIds
      .filter(id => id !== excludeUserId)
      .map(userId => this.createNotification({ ...params, userId }));

    return Promise.allSettled(notifications);
  }
}
