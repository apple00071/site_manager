import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache task data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/tasks/all
 * Fetch all tasks accessible to the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user using secure authentication
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let tasksQuery;

    if (user.role === 'admin') {
      // Admin can see all tasks
      tasksQuery = supabaseAdmin
        .from('project_step_tasks')
        .select(`
          *,
          step:project_steps(
            id,
            title,
            project:projects(
              id,
              title,
              customer_name,
              status
            )
          )
        `)
        .order('created_at', { ascending: false });
    } else {
      // Regular users can only see tasks from projects they're assigned to
      
      // First get all project IDs the user has access to
      const { data: memberProjects, error: memberError } = await supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error fetching member projects:', memberError);
        return NextResponse.json(
          { error: 'Error fetching accessible projects' },
          { status: 500 }
        );
      }

      // Get projects directly assigned via assigned_employee_id
      const { data: assignedProjects, error: assignedError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('assigned_employee_id', user.id);

      if (assignedError) {
        console.error('Error fetching assigned projects:', assignedError);
        return NextResponse.json(
          { error: 'Error fetching assigned projects' },
          { status: 500 }
        );
      }

      // Combine project IDs
      const memberProjectIds = memberProjects?.map(p => p.project_id) || [];
      const assignedProjectIds = assignedProjects?.map(p => p.id) || [];
      const allProjectIds = [...new Set([...memberProjectIds, ...assignedProjectIds])];

      if (allProjectIds.length === 0) {
        // User has no accessible projects
        return NextResponse.json({ tasks: [] }, { status: 200 });
      }

      // Get all project steps for accessible projects
      const { data: accessibleSteps, error: stepsError } = await supabaseAdmin
        .from('project_steps')
        .select('id')
        .in('project_id', allProjectIds);

      if (stepsError) {
        console.error('Error fetching accessible steps:', stepsError);
        return NextResponse.json(
          { error: 'Error fetching project steps' },
          { status: 500 }
        );
      }

      const stepIds = accessibleSteps?.map(s => s.id) || [];

      if (stepIds.length === 0) {
        return NextResponse.json({ tasks: [] }, { status: 200 });
      }

      // Fetch tasks for accessible steps
      tasksQuery = supabaseAdmin
        .from('project_step_tasks')
        .select(`
          *,
          step:project_steps(
            id,
            title,
            project:projects(
              id,
              title,
              customer_name,
              status
            )
          )
        `)
        .in('step_id', stepIds)
        .order('created_at', { ascending: false });
    }

    const { data: tasks, error: fetchError } = await tasksQuery;

    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: tasks || [] }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/tasks/all:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
