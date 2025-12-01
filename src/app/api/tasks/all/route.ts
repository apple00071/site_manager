import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache task data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/tasks/all
 * Fetch all tasks accessible to the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user using lightweight authentication
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    let tasksQuery;

    if (userRole === 'admin') {
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
          ),
          assigned_user:users!project_step_tasks_assigned_to_fkey(
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false });
    } else {
      // Regular users can only see tasks from projects they're assigned to
      
      // First get all project IDs the user has access to
      const { data: memberProjects, error: memberError } = await supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

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
        .eq('assigned_employee_id', userId);

      if (memberError) {
        console.error('Error fetching member projects:', memberError);
        return NextResponse.json(
          { error: 'Error fetching accessible projects' },
          { status: 500 }
        );
      }

      // Combine project IDs
      interface ProjectMember { project_id: string; }
      const memberProjectIds = memberProjects?.map((p: ProjectMember) => p.project_id) || [];
      interface AssignedProject { id: string; }
      const assignedProjectIds = assignedProjects?.map((p: AssignedProject) => p.id) || [];
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

      interface AccessibleStep { id: string; }
      const stepIds = accessibleSteps?.map((s: AccessibleStep) => s.id) || [];

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
          ),
          assigned_user:users!project_step_tasks_assigned_to_fkey(
            id,
            full_name
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
