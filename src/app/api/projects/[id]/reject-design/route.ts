import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/projects/[id]/reject-design
 * Reject design and request changes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    // Only admins can reject designs
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can reject designs' }, { status: 403 });
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { design_file_id, rejection_reason, admin_comments } = body;

    if (!design_file_id || !rejection_reason) {
      return NextResponse.json(
        { error: 'design_file_id and rejection_reason are required' },
        { status: 400 }
      );
    }

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, designer:users!projects_designer_id_fkey(id, full_name, email)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update design file to rejected
    const { error: designError } = await supabaseAdmin
      .from('design_files')
      .update({
        approval_status: 'rejected',
        rejection_reason,
        admin_comments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', design_file_id);

    if (designError) {
      console.error('Error rejecting design file:', designError);
      return NextResponse.json({ error: 'Failed to reject design' }, { status: 500 });
    }

    // Update project workflow stage to design_rejected
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        workflow_stage: 'design_rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    // Log workflow change
    await supabaseAdmin.rpc('update_project_workflow_stage', {
      p_project_id: projectId,
      p_new_stage: 'design_rejected',
      p_reason: rejection_reason,
    });

    // Create notification for designer
    if (project.designer) {
      await NotificationService.createNotification({
        userId: project.designer.id,
        type: 'design_rejected',
        title: 'Design Needs Changes',
        message: `Your design for project "${project.title}" needs changes. Reason: ${rejection_reason}`,
        relatedId: projectId,
        relatedType: 'project',
      });

      try {
        const { data: des } = await supabaseAdmin
          .from('users')
          .select('phone_number')
          .eq('id', project.designer.id)
          .single();
        if (des?.phone_number) {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${projectId}`;
          await sendCustomWhatsAppNotification(
            des.phone_number,
            `🚫 Design Rejected\n\nYour design for project "${project.title}" was rejected. Reason: ${rejection_reason}\n\nOpen: ${link}`
          );
        }
      } catch (waErr) {
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Design rejected successfully',
      project: updatedProject,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/projects/[id]/reject-design:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

