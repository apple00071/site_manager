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
  | 'snag_created'
  | 'snag_assigned'
  | 'snag_resolved'
  | 'snag_verified'
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
  static async notifyTaskAssigned(userId: string, taskTitle: string, projectName: string, taskId?: string) {
    return this.createNotification({
      userId,
      title: 'New Task Assigned',
      message: `You have been assigned to "${taskTitle}" in project "${projectName}"`,
      type: 'task_assigned',
      relatedId: taskId,
      relatedType: 'task'
    });
  }

  static async notifyProjectUpdate(userId: string, projectName: string, updateMessage: string, projectId?: string) {
    return this.createNotification({
      userId,
      title: `Project Update: ${projectName}`,
      message: updateMessage,
      type: 'project_update',
      relatedId: projectId,
      relatedType: 'project'
    });
  }

  static async notifyDesignApproved(userId: string, designName: string) {
    return this.createNotification({
      userId,
      title: 'Design Approved',
      message: `Your design "${designName}" has been approved`,
      type: 'design_approved',
    });
  }

  static async notifySnagCreated(userId: string, description: string, projectName: string, snagId?: string) {
    return this.createNotification({
      userId,
      title: 'New Snag Created',
      message: `A new snag has been reported in project "${projectName}": ${description}`,
      type: 'snag_created',
      relatedId: snagId,
      relatedType: 'snag'
    });
  }

  static async notifySnagAssigned(userId: string, description: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Snag Assigned',
      message: `You have been assigned a snag in project "${projectName}": ${description}`,
      type: 'snag_assigned',
    });
  }

  static async notifySnagResolved(userId: string, description: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Snag Resolved',
      message: `A snag has been resolved in project "${projectName}": ${description}`,
      type: 'snag_resolved',
    });
  }

  static async notifySnagVerified(userId: string, description: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Snag Verified',
      message: `A snag has been verified and closed in project "${projectName}": ${description}`,
      type: 'snag_verified',
    });
  }

  static async notifyProposalSent(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Sent',
      message: `Proposal "${proposalTitle}" has been sent for project "${projectName}"`,
      type: 'proposal_sent',
    });
  }

  static async notifyProposalApproved(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Approved',
      message: `Proposal "${proposalTitle}" has been approved for project "${projectName}"`,
      type: 'proposal_approved',
    });
  }

  static async notifyProposalRejected(userId: string, proposalTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Proposal Rejected',
      message: `Proposal "${proposalTitle}" was rejected for project "${projectName}"`,
      type: 'proposal_rejected',
    });
  }

  static async notifyInvoiceCreated(userId: string, invoiceNumber: string, projectName: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'New Invoice Created',
      message: `A new invoice (${invoiceNumber}) for ₹${amount} was created for project "${projectName}"`,
      type: 'invoice_created',
    });
  }

  static async notifyInvoiceApproved(userId: string, invoiceNumber: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Invoice Approved',
      message: `Invoice ${invoiceNumber} for project "${projectName}" was approved`,
      type: 'invoice_approved',
    });
  }

  static async notifyInvoiceRejected(userId: string, invoiceNumber: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'Invoice Rejected',
      message: `Invoice ${invoiceNumber} for project "${projectName}" was rejected`,
      type: 'invoice_rejected',
    });
  }

  static async notifyMention(userId: string, mentionerName: string, projectName: string, message: string, relatedId: string) {
    return this.createNotification({
      userId,
      title: 'You were mentioned',
      message: `${mentionerName} mentioned you in project "${projectName}": ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      type: 'mention',
      relatedId,
      relatedType: 'project_update'
    });
  }

  static async notifyExpenseCreated(userId: string, description: string, amount: number, requesterName: string) {
    return this.createNotification({
      userId,
      title: 'New Expense Request',
      message: `${requesterName} requested ₹${amount} for "${description}"`,
      type: 'expense_created',
    });
  }

  static async notifyExpenseApproved(userId: string, description: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Expense Approved',
      message: `Your request for "${description}" (₹${amount}) has been approved`,
      type: 'expense_approved',
    });
  }

  static async notifyExpenseRejected(userId: string, description: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Expense Rejected',
      message: `Your request for "${description}" (₹${amount}) has been rejected`,
      type: 'expense_rejected',
    });
  }

  static async notifySiteLogSubmitted(userId: string, projectName: string, creatorName: string) {
    return this.createNotification({
      userId,
      title: 'Daily Site Log Submitted',
      message: `${creatorName} submitted a new site log for project "${projectName}"`,
      type: 'site_log_submitted',
    });
  }

  static async notifyReportGenerated(userId: string, projectName: string, reportDate: string, pdfUrl?: string) {
    return this.createNotification({
      userId,
      title: 'DPR Generated',
      message: `A new Progress Report (DPR) for "${projectName}" (${reportDate}) has been generated.${pdfUrl ? `\n\nView PDF: ${pdfUrl}` : ''}`,
      type: 'report_generated',
    });
  }

  static async notifyPaymentRecorded(userId: string, projectName: string, amount: number) {
    return this.createNotification({
      userId,
      title: 'Payment Recorded',
      message: `A payment of ₹${amount} has been recorded for project "${projectName}"`,
      type: 'payment_recorded',
    });
  }
}
