// Notification Service for creating and managing notifications
import { supabaseAdmin } from '@/lib/supabase-server';

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
  | 'expense_rejected';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  relatedType?: string;
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
        // If we have a project ID (relatedId for snag_created often is snagId, but we need projectId for the sub-tab)
        // For global snags page, we can just use /dashboard/snags
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
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=inventory` : undefined;
      case 'bill_approved':
      case 'bill_rejected':
      case 'invoice_created':
      case 'invoice_approved':
      case 'invoice_rejected':
      case 'proposal_sent':
      case 'proposal_approved':
      case 'proposal_rejected':
        return relatedId ? `${baseUrl}/projects/${relatedId}?stage=orders` : `${baseUrl}/tasks?category=proposals`;
      case 'expense_created':
      case 'expense_approved':
      case 'expense_rejected':
        return `${baseUrl}/office-expenses`;
      default:
        return undefined;
    }
  }

  static async createNotification(params: CreateNotificationParams) {
    console.log('📢 NotificationService.createNotification called with:', JSON.stringify(params, null, 2));
    try {
      // Use shared admin client
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
        console.error('Supabase error creating notification:', error);
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      console.log('✅ Notification created successfully:', data);

      // Generate deep link route (Relative path for Median internal navigation)
      const deepLinkRoute = this.getNotificationUrl(params.type, params.relatedId, params.relatedType);
      console.log('🔗 Generated deep link route:', deepLinkRoute);

      // Send push notification via OneSignal (non-blocking)
      console.log('🔔 Attempting to send OneSignal push notification to user:', params.userId);
      try {
        const { sendPushNotificationByUserId } = await import('@/lib/onesignal');
        console.log('📲 OneSignal module imported successfully');
        const pushResult = await sendPushNotificationByUserId(
          params.userId,
          params.title,
          params.message,
          {
            type: params.type,
            relatedId: params.relatedId,
            relatedType: params.relatedType,
            route: deepLinkRoute, // Use 'route' for Capacitor internal navigation
          },
          deepLinkRoute // Pass as targetUrl parameter (will become data.route)
        );
        console.log('📲 OneSignal push result:', pushResult);
      } catch (pushError) {
        // Don't fail the notification creation if push fails
        console.error('❌ Error sending push notification:', pushError);
      }

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
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
}
