import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache design files
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas
const createDesignFileSchema = z.object({
  project_id: z.string().uuid(),
  file_name: z.string().min(1),
  file_url: z.string().min(1),
  file_type: z.string().min(1),
  version_number: z.number().int().positive().optional().default(1),
});

const updateApprovalSchema = z.object({
  id: z.string().uuid(),
  approval_status: z.enum(['pending', 'approved', 'rejected', 'needs_changes']),
  admin_comments: z.string().optional(),
});

const addCommentSchema = z.object({
  design_file_id: z.string().uuid(),
  comment: z.string().min(1),
});

// GET - Fetch design files
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch design files with user information and comments
    const { data: designs, error } = await supabaseAdmin
      .from('design_files')
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email),
        comments:design_comments(
          id,
          comment,
          created_at,
          user:users(id, full_name, email)
        )
      `)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching design files:', error);
      return NextResponse.json({ error: 'Failed to fetch design files' }, { status: 500 });
    }

    return NextResponse.json({ designs });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new design file
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
    const parsed = createDesignFileSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, file_name, file_url, file_type, version_number } = parsed.data;

    const { data: design, error } = await supabaseAdmin
      .from('design_files')
      .insert({
        project_id,
        file_name,
        file_url,
        file_type,
        version_number,
        uploaded_by: userId,
        approval_status: 'pending',
      })
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating design file:', error);
      return NextResponse.json({ error: 'Failed to create design file' }, { status: 500 });
    }

    // Notify admin of new design upload
    try {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('created_by, title')
        .eq('id', project_id)
        .single();

      if (projectData && projectData.created_by !== userId) {
        await NotificationService.createNotification({
          userId: projectData.created_by,
          title: 'New Design Uploaded',
          message: `${userFullName} uploaded "${file_name}" for project "${projectData.title}"`,
          type: 'design_uploaded',
          relatedId: design.id,
          relatedType: 'design_file'
        });
        console.log('Design upload notification sent to admin:', projectData.created_by);

        try {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${project_id}`;
          const { data: adminUser } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', projectData.created_by)
            .single();
          if (adminUser?.phone_number) {
            await sendCustomWhatsAppNotification(
              adminUser.phone_number,
              `🖼️ New Design Uploaded\n\n${userFullName} uploaded "${file_name}" for project "${projectData.title}"\n\nOpen: ${link}`
            );
          }
        } catch (_) {}
      }
    } catch (notificationError) {
      console.error('Failed to send design upload notification:', notificationError);
      // Don't fail the main operation if notification fails
    }

    return NextResponse.json({ design }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update design approval status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can approve designs' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateApprovalSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, approval_status, admin_comments } = parsed.data;

    // If approving, unset any previously approved design for this project
    if (approval_status === 'approved') {
      // Get the project_id for this design
      const { data: currentDesign } = await supabaseAdmin
        .from('design_files')
        .select('project_id')
        .eq('id', id)
        .single();

      if (currentDesign) {
        // Unset is_current_approved for all other designs in this project
        await supabaseAdmin
          .from('design_files')
          .update({ is_current_approved: false })
          .eq('project_id', currentDesign.project_id);
      }
    }

    const { data: design, error } = await supabaseAdmin
      .from('design_files')
      .update({
        approval_status,
        admin_comments,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        is_current_approved: approval_status === 'approved',
      })
      .eq('id', id)
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating design approval:', error);
      return NextResponse.json({ error: 'Failed to update design approval' }, { status: 500 });
    }

    // Notify employee of approval/rejection
    try {
      if (design.uploaded_by_user && design.uploaded_by_user.id !== user.id) {
        const statusMessage = approval_status === 'approved' ? 'approved' : 
                             approval_status === 'rejected' ? 'rejected' : 
                             approval_status === 'needs_changes' ? 'needs changes' : approval_status;
        
        const message = admin_comments ? 
          `Your design "${design.file_name}" has been ${statusMessage}. Admin comment: ${admin_comments}` :
          `Your design "${design.file_name}" has been ${statusMessage}`;

        await NotificationService.createNotification({
          userId: design.uploaded_by_user.id,
          title: `Design ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`,
          message: message,
          type: approval_status === 'approved' ? 'design_approved' : 'design_rejected',
          relatedId: design.id,
          relatedType: 'design_file'
        });
        console.log('Design approval notification sent to employee:', design.uploaded_by_user.id);

        try {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${design.project_id}`;
          const { data: uploader } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', design.uploaded_by_user.id)
            .single();
          if (uploader?.phone_number) {
            await sendCustomWhatsAppNotification(
              uploader.phone_number,
              `${message}\n\nOpen: ${link}`
            );
          }
        } catch (_) {}
      }
    } catch (notificationError) {
      console.error('Failed to send design approval notification:', notificationError);
      // Don't fail the main operation if notification fails
    }

    return NextResponse.json({ design });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete design file
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Check if user owns this design or is admin
    const { data: existingDesign, error: fetchError } = await supabaseAdmin
      .from('design_files')
      .select('uploaded_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingDesign) {
      return NextResponse.json({ error: 'Design file not found' }, { status: 404 });
    }

    // Only allow deletion if user is the creator or is an admin
    if (existingDesign.uploaded_by !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own designs' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('design_files')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting design file:', error);
      return NextResponse.json({ error: 'Failed to delete design file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

