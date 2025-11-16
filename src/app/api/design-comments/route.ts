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

const addCommentSchema = z.object({
  design_file_id: z.string().uuid(),
  comment: z.string().min(1),
});

// POST - Add comment to design file
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

    const { design_file_id, comment } = parsed.data;

    const { data: newComment, error } = await supabaseAdmin
      .from('design_comments')
      .insert({
        design_file_id,
        user_id: userId,
        comment,
      })
      .select(`
        *,
        user:users(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
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

