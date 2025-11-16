import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/projects/[id]/requirements
 * Upload requirements PDF and assign designer
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

    // Only admins can upload requirements
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can upload requirements' }, { status: 403 });
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { requirements_pdf_url, designer_id } = body;

    if (!requirements_pdf_url || !designer_id) {
      return NextResponse.json(
        { error: 'requirements_pdf_url and designer_id are required' },
        { status: 400 }
      );
    }

    // Verify designer exists and is an employee
    const { data: designer, error: designerError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email')
      .eq('id', designer_id)
      .single();

    if (designerError || !designer) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    // Update project with requirements and designer assignment
    const { data: project, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        requirements_pdf_url,
        requirements_uploaded_at: new Date().toISOString(),
        designer_id,
        designer_assigned_at: new Date().toISOString(),
        workflow_stage: 'design_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select('*, assigned_employee:users!projects_assigned_employee_id_fkey(id, full_name, email)')
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    // Log workflow change
    await supabaseAdmin.rpc('update_project_workflow_stage', {
      p_project_id: projectId,
      p_new_stage: 'design_pending',
      p_reason: 'Requirements uploaded and designer assigned',
    });

    // Create notification for designer
    await NotificationService.createNotification({
      userId: designer_id,
      type: 'project_update',
      title: 'New Project Assigned',
      message: `You have been assigned to design project: ${project.title}`,
      relatedId: projectId,
      relatedType: 'project',
    });

    try {
      const { data: designerUser } = await supabaseAdmin
        .from('users')
        .select('phone_number')
        .eq('id', designer_id)
        .single();
      if (designerUser?.phone_number) {
        await sendCustomWhatsAppNotification(
          designerUser.phone_number,
          `📝 Project Assigned\n\nYou have been assigned to design project: ${project.title}`
        );
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: 'Requirements uploaded and designer assigned',
      project,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/projects/[id]/requirements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/projects/[id]/requirements
 * Get requirements PDF URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Get project requirements
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('requirements_pdf_url, requirements_uploaded_at, designer_id, designer:users!projects_designer_id_fkey(id, full_name, email)')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error('Error fetching project requirements:', fetchError);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      requirements_pdf_url: project.requirements_pdf_url,
      requirements_uploaded_at: project.requirements_uploaded_at,
      designer: project.designer,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/projects/[id]/requirements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

