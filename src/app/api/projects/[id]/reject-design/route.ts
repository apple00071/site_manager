import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper to get current authenticated user
 */
async function getCurrentUser(request: NextRequest) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.user) {
    return { user: null, error: 'Unauthorized' };
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (userError || !userData) {
    return { user: null, error: 'User not found' };
  }

  return { user: userData, error: null };
}

/**
 * POST /api/projects/[id]/reject-design
 * Reject design and request changes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can reject designs
    if (user.role !== 'admin') {
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

