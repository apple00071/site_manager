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
}
