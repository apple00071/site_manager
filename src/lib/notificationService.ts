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
  | 'general';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  relatedType?: string;
}

export class NotificationService {
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
          }
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
  static async notifyTaskAssigned(userId: string, taskTitle: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'New Task Assigned',
      message: `You have been assigned to "${taskTitle}" in project "${projectName}"`,
      type: 'task_assigned',
    });
  }

  static async notifyProjectUpdate(userId: string, projectName: string, updateMessage: string) {
    return this.createNotification({
      userId,
      title: `Project Update: ${projectName}`,
      message: updateMessage,
      type: 'project_update',
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

  static async notifySnagCreated(userId: string, description: string, projectName: string) {
    return this.createNotification({
      userId,
      title: 'New Snag Created',
      message: `A new snag has been reported in project "${projectName}": ${description}`,
      type: 'snag_created',
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
}
