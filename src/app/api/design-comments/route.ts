import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';

const addCommentSchema = z.object({
  design_file_id: z.string().uuid(),
  comment: z.string().min(1),
});

async function getCurrentUser(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('Session error:', error);
      return { user: null, error: error?.message || 'No session found' };
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return { user: null, error: userError?.message || 'User not found' };
    }

    return { user, error: null };
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return { user: null, error: error.message };
  }
}

// POST - Add comment to design file
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        user_id: user.id,
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
        if (designFile.uploaded_by !== user.id) {
          notifications.push(
            NotificationService.createNotification({
              userId: designFile.uploaded_by,
              title: 'New Comment on Your Design',
              message: `${user.full_name} commented on your design "${designFile.file_name}"`,
              type: 'comment_added',
              relatedId: design_file_id,
              relatedType: 'design_file'
            })
          );
        }

        // Notify project admin if commenter is not the admin
        const project = Array.isArray(designFile.project) ? designFile.project[0] : designFile.project;
        if (project?.created_by && project.created_by !== user.id && project.created_by !== designFile.uploaded_by) {
          notifications.push(
            NotificationService.createNotification({
              userId: project.created_by,
              title: 'New Comment on Project Design',
              message: `${user.full_name} commented on design "${designFile.file_name}" in project "${project.title}"`,
              type: 'comment_added',
              relatedId: design_file_id,
              relatedType: 'design_file'
            })
          );
        }

        // Send all notifications
        await Promise.all(notifications);
        console.log('Comment notifications sent for design:', design_file_id);
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

