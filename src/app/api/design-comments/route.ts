import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { getAuthUser } from '@/lib/supabase-server';

// Force dynamic rendering - never cache design comments
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// P0: Enhanced schema with pin-drop coordinates and task creation
const addCommentSchema = z.object({
  design_file_id: z.string().uuid(),
  comment: z.string().min(1),
  // Pin-drop coordinates (optional)
  x_percent: z.number().min(0).max(100).optional(),
  y_percent: z.number().min(0).max(100).optional(),
  zoom_level: z.number().min(0).optional(),
  // Page number for multi-page PDFs (defaults to 1)
  page_number: z.number().int().min(1).optional().default(1),
  // Mentions (optional array of user IDs)
  mentioned_user_ids: z.array(z.string().uuid()).optional(),
  // Task creation (optional)
  create_task: z.boolean().optional().default(false),
  task_assignee_id: z.string().uuid().optional(),
  task_due_date: z.string().optional(), // ISO date string
});

// POST - Add comment to design file (with pin-drop coords and task creation)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const body = await request.json();
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      design_file_id,
      comment,
      x_percent,
      y_percent,
      zoom_level,
      page_number,
      mentioned_user_ids,
      create_task,
      task_assignee_id,
      task_due_date,
    } = parsed.data;

    let linkedTaskId: string | null = null;

    // P0: Create linked task if requested
    if (create_task) {
      // Get design file info for task context
      const { data: designInfo } = await supabaseAdmin
        .from('design_files')
        .select('file_name, project_id')
        .eq('id', design_file_id)
        .single();

      const taskTitle = `Design comment: ${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}`;

      // Create start and end dates (end = start + 1 hour)
      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // +1 hour

      const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: taskTitle,
          description: `Comment from design file: ${designInfo?.file_name || 'Unknown'}\n\n${comment}`,
          project_id: designInfo?.project_id,
          status: 'todo',
          created_by: userId,
          assigned_to: task_assignee_id || null,
          due_date: task_due_date || null,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
        })
        .select('id')
        .single();

      if (taskError) {
        console.error('Error creating linked task:', taskError);
        // Continue without task - don't fail the comment
      } else {
        linkedTaskId = task?.id || null;
      }
    }

    const { data: newComment, error } = await supabaseAdmin
      .from('design_comments')
      .insert({
        design_file_id,
        user_id: userId,
        comment,
        x_percent: x_percent ?? null,
        y_percent: y_percent ?? null,
        zoom_level: zoom_level ?? null,
        page_number: page_number ?? 1,
        mentioned_user_ids: mentioned_user_ids ?? null,
        linked_task_id: linkedTaskId,
      })
      .select(`
        *,
        user:users!design_comments_user_id_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }

    // Auto-update design status to 'needs_changes' when a pinned comment is added
    if (x_percent !== undefined && y_percent !== undefined) {
      const { error: statusError } = await supabaseAdmin
        .from('design_files')
        .update({ approval_status: 'needs_changes' })
        .eq('id', design_file_id);

      if (statusError) {
        console.error('Error updating design status:', statusError);
        // Don't fail the comment creation, just log the error
      }
    }

    // P0: Notify mentioned users
    if (mentioned_user_ids && mentioned_user_ids.length > 0) {
      try {
        await Promise.all(mentioned_user_ids.map(mentionedUserId =>
          NotificationService.createNotification({
            userId: mentionedUserId,
            title: 'You were mentioned in a design comment',
            message: `${userFullName} mentioned you: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`,
            type: 'mention',
            relatedId: design_file_id,
            relatedType: 'design_file'
          })
        ));
      } catch (mentionError) {
        console.error('Failed to send mention notifications:', mentionError);
      }
    }

    // Notify relevant users about the new comment
    try {
      // Get design file info and project details
      const { data: designFile } = await supabaseAdmin
        .from('design_files')
        .select(`
          file_name,
          uploaded_by,
          project_id,
          project:projects(created_by, title)
        `)
        .eq('id', design_file_id)
        .single();

      if (designFile) {
        const notifications = [];

        // Notify the design uploader if commenter is not the uploader
        if (designFile.uploaded_by !== userId) {
          notifications.push(
            NotificationService.createNotification({
              userId: designFile.uploaded_by,
              title: 'New Comment on Your Design',
              message: `${userFullName} commented on your design "${designFile.file_name}"`,
              type: 'comment_added',
              relatedId: design_file_id,
              relatedType: 'design_file'
            })
          );
        }

        // Notify project admin if commenter is not the admin
        const project = Array.isArray(designFile.project) ? designFile.project[0] : designFile.project;
        if (project?.created_by && project.created_by !== userId && project.created_by !== designFile.uploaded_by) {
          notifications.push(
            NotificationService.createNotification({
              userId: project.created_by,
              title: 'New Comment on Project Design',
              message: `${userFullName} commented on design "${designFile.file_name}" in project "${project.title}"`,
              type: 'comment_added',
              relatedId: design_file_id,
              relatedType: 'design_file'
            })
          );
        }

        await Promise.all(notifications);
        console.log('Comment notifications sent for design:', design_file_id);

        try {
          const recipientIds: string[] = [];
          if (designFile.uploaded_by && designFile.uploaded_by !== userId) {
            recipientIds.push(designFile.uploaded_by);
          }
          if (project?.created_by && project.created_by !== userId && project.created_by !== designFile.uploaded_by) {
            recipientIds.push(project.created_by);
          }

          if (recipientIds.length > 0) {
            const { data: recipients } = await supabaseAdmin
              .from('users')
              .select('id, phone_number')
              .in('id', recipientIds);

            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const link = `${origin}/dashboard/projects/${designFile.project_id}`;
            const message = `💬 New comment on design "${designFile.file_name}" in project "${project?.title || ''}" by ${userFullName}\n\nOpen: ${link}`;
            await Promise.all(
              (recipients || [])
                .filter(r => !!r.phone_number)
                .map(r => sendCustomWhatsAppNotification(r.phone_number as unknown as string, message))
            );
          }
        } catch (waError) {
          console.error('Failed to send WhatsApp notifications for comment:', waError);
        }
      }
    } catch (notificationError) {
      console.error('Failed to send comment notifications:', notificationError);
      // Don't fail the main operation if notification fails
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

