import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/projects/[id]/approve-design
 * Approve design and move to next workflow stage
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

    // Only admins can approve designs
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can approve designs' }, { status: 403 });
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { design_file_id, site_supervisor_id, admin_comments } = body;

    if (!design_file_id) {
      return NextResponse.json({ error: 'design_file_id is required' }, { status: 400 });
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

    // Update design file to approved
    const { error: designError } = await supabaseAdmin
      .from('design_files')
      .update({
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_comments,
        is_current_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', design_file_id);

    if (designError) {
      console.error('Error approving design file:', designError);
      return NextResponse.json({ error: 'Failed to approve design' }, { status: 500 });
    }

    // Mark all other designs for this project as not current
    await supabaseAdmin
      .from('design_files')
      .update({ is_current_approved: false })
      .eq('project_id', projectId)
      .neq('id', design_file_id);

    // Update project workflow stage
    const updateData: any = {
      workflow_stage: 'design_approved',
      design_approved_at: new Date().toISOString(),
      design_approved_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // If site supervisor is assigned, move to in_progress
    if (site_supervisor_id) {
      // Verify site supervisor exists
      const { data: supervisor, error: supervisorError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .eq('id', site_supervisor_id)
        .single();

      if (supervisorError || !supervisor) {
        return NextResponse.json({ error: 'Site supervisor not found' }, { status: 404 });
      }

      updateData.site_supervisor_id = site_supervisor_id;
      updateData.site_supervisor_assigned_at = new Date().toISOString();
      updateData.workflow_stage = 'in_progress';
      updateData.status = 'in_progress';

      // Create notification for site supervisor
      await NotificationService.createNotification({
        userId: site_supervisor_id,
        type: 'project_update',
        title: 'Project Assigned',
        message: `You have been assigned as site supervisor for project: ${project.title}`,
        relatedId: projectId,
        relatedType: 'project',
      });

      try {
        const { data: sup } = await supabaseAdmin
          .from('users')
          .select('phone_number')
          .eq('id', site_supervisor_id)
          .single();
        if (sup?.phone_number) {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${projectId}`;
          await sendCustomWhatsAppNotification(
            sup.phone_number,
            `🏢 Project Assigned\n\nYou have been assigned as site supervisor for project "${project.title}"\n\nOpen: ${link}`
          );
        }
      } catch (waErr) {
      }
    }

    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(updateData)
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
      p_new_stage: updateData.workflow_stage,
      p_reason: `Design approved${site_supervisor_id ? ' and site supervisor assigned' : ''}`,
    });

    // Create notification for designer
    if (project.designer) {
      await NotificationService.createNotification({
        userId: project.designer.id,
        type: 'design_approved',
        title: 'Design Approved',
        message: `Your design for project "${project.title}" has been approved!`,
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
            `✅ Design Approved\n\nYour design for project "${project.title}" has been approved.\n\nOpen: ${link}`
          );
        }
      } catch (waErr) {
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Design approved successfully',
      project: updatedProject,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/projects/[id]/approve-design:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

