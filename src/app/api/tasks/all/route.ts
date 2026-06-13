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

    // Fetch users mapping for resolving assignee names
    const { data: usersData } = await supabaseAdmin.from('users').select('id, full_name');
    const userMap = new Map(usersData?.map((u: any) => [u.id, u.full_name]) || []);

    let tasks: any[] = [];
    let fetchError;

    if (userRole === 'admin') {
      // Admin can see all tasks
      const { data, error } = await supabaseAdmin
        .from('tasks')
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
      tasks = data || [];
      fetchError = error;
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

      if (assignedError) {
        console.error('Error fetching assigned projects:', assignedError);
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

      // Get all project steps for accessible projects
      let stepIds: string[] = [];
      if (allProjectIds.length > 0) {
        const { data: accessibleSteps, error: stepsError } = await supabaseAdmin
          .from('project_steps')
          .select('id')
          .in('project_id', allProjectIds);

        if (stepsError) {
          console.error('Error fetching accessible steps:', stepsError);
        } else {
          interface AccessibleStep { id: string; }
          stepIds = accessibleSteps?.map((s: AccessibleStep) => s.id) || [];
        }
      }

      // Construct a single consolidated query for tasks
      let orFilter = `assigned_to.cs.{"${userId}"},created_by.eq.${userId}`;
      if (allProjectIds.length > 0) {
        orFilter += `,project_id.in.(${allProjectIds.join(',')})`;
      }
      if (stepIds.length > 0) {
        orFilter += `,step_id.in.(${stepIds.join(',')})`;
      }

      const { data, error } = await supabaseAdmin
        .from('tasks')
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
        .or(orFilter)
        .order('created_at', { ascending: false });

      tasks = data || [];
      fetchError = error;
    }

    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    // Normalize and map assignee names in memory
    const combinedTasks = tasks.map((t: any) => {
      const rawAssignees = Array.isArray(t.assigned_to) 
        ? t.assigned_to 
        : (t.assigned_to ? [t.assigned_to] : []);
      
      const assignedUsers = rawAssignees.map((id: string) => ({
        id,
        full_name: userMap.get(id) || 'Unknown User'
      }));

      return {
        ...t,
        assigned_to: rawAssignees,
        // Backward compatibility properties
        assigned_user: assignedUsers[0] || null,
        assigned_users: assignedUsers
      };
    });

    return NextResponse.json({ tasks: combinedTasks }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/tasks/all:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
