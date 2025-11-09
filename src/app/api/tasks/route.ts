import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { createNoCacheResponse } from '@/lib/apiHelpers';

// Force dynamic rendering - never cache task data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Validation schema for task creation
const createTaskSchema = z.object({
  step_id: z.string().uuid('Invalid step ID'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  start_date: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).default('todo'),
});

// Validation schema for task update
const updateTaskSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  start_date: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
});

/**
 * Helper function to get the current authenticated user from cookies
 */
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

    // Get user details from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return { user: null, error: userError?.message || 'User not found' };
    }

    console.log('User authenticated:', user.email);
    return { user, error: null };
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return { user: null, error: error.message };
  }
}

/**
 * Helper function to check if user has access to a project
 */
async function checkProjectAccess(userId: string, stepId: string) {
  // Get the project_id from the step
  const { data: step, error: stepError } = await supabaseAdmin
    .from('project_steps')
    .select('project_id')
    .eq('id', stepId)
    .single();

  if (stepError || !step) {
    return { hasAccess: false, error: 'Step not found' };
  }

  // Check if user is admin
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (userError) {
    return { hasAccess: false, error: 'User not found' };
  }

  // Admins have access to all projects
  if (userData.role === 'admin') {
    return { hasAccess: true, projectId: step.project_id };
  }

  // Check if user is a project member
  const { data: memberData, error: memberError } = await supabaseAdmin
    .from('project_members')
    .select('id')
    .eq('project_id', step.project_id)
    .eq('user_id', userId)
    .single();

  if (memberError && memberError.code !== 'PGRST116') {
    return { hasAccess: false, error: 'Error checking project membership' };
  }

  // Check if user is assigned to the project
  const { data: projectData } = await supabaseAdmin
    .from('projects')
    .select('assigned_employee_id')
    .eq('id', step.project_id)
    .single();

  const hasAccess = !!memberData || projectData?.assigned_employee_id === userId;
  
  return { hasAccess, projectId: step.project_id };
}

/**
 * GET /api/tasks?step_id=xxx
 * Fetch all tasks for a specific step
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('step_id');

    if (!stepId) {
      return NextResponse.json(
        { error: 'step_id is required' },
        { status: 400 }
      );
    }

    // Get current user
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(user.id, stepId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch tasks
    const { data: tasks, error: fetchError } = await supabaseAdmin
      .from('project_step_tasks')
      .select('*')
      .eq('step_id', stepId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/tasks called ===');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const body = await request.json();
    console.log('Request body:', body);

    // Validate input
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Validation failed:', parsed.error);
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Get current user
    console.log('Getting current user...');
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'No user found' },
        { status: 401 }
      );
    }

    console.log('Creating task for user:', user.email, 'step_id:', parsed.data.step_id);

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(user.id, parsed.data.step_id);
    if (!hasAccess) {
      console.error('Access denied:', accessError);
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Create task using admin client (bypasses RLS)
    const { data: task, error: insertError } = await supabaseAdmin
      .from('project_step_tasks')
      .insert({
        step_id: parsed.data.step_id,
        title: parsed.data.title,
        start_date: parsed.data.start_date || null,
        estimated_completion_date: parsed.data.estimated_completion_date || null,
        status: parsed.data.status,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating task:', insertError);
      return NextResponse.json(
        { error: 'Failed to create task', details: insertError.message },
        { status: 500 }
      );
    }

    // Notify admin of new task
    try {
      const { data: stepData } = await supabaseAdmin
        .from('project_steps')
        .select(`
          title,
          project:projects(created_by, title)
        `)
        .eq('id', parsed.data.step_id)
        .single();

      const project = Array.isArray(stepData?.project) ? stepData.project[0] : stepData?.project;
      if (stepData && project && project.created_by !== user.id) {
        await NotificationService.createNotification({
          userId: project.created_by,
          title: 'New Task Created',
          message: `${user.full_name} created task "${parsed.data.title}" in step "${stepData.title}" for project "${project.title}"`,
          type: 'task_assigned',
          relatedId: task.step_id,
          relatedType: 'project_step'
        });
        console.log('Task creation notification sent to admin:', project.created_by);
      }
    } catch (notificationError) {
      console.error('Failed to send task creation notification:', notificationError);
      // Don't fail the main operation if notification fails
    }

    console.log('✅ Task created successfully:', task.id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    console.error('Unexpected error in POST /api/tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks
 * Update an existing task
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Get current user
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the task to find its step_id
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('project_step_tasks')
      .select('step_id')
      .eq('id', parsed.data.id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(user.id, existingTask.step_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Update task
    const updateData: any = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.start_date !== undefined) updateData.start_date = parsed.data.start_date;
    if (parsed.data.estimated_completion_date !== undefined) {
      updateData.estimated_completion_date = parsed.data.estimated_completion_date;
    }
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    updateData.updated_at = new Date().toISOString();

    const { data: task, error: updateError } = await supabaseAdmin
      .from('project_step_tasks')
      .update(updateData)
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating task:', updateError);
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    // Notify admin of task status change if status was updated
    if (parsed.data.status && parsed.data.status !== 'todo') {
      try {
        const { data: stepData } = await supabaseAdmin
          .from('project_steps')
          .select(`
            title,
            project:projects(created_by, title)
          `)
          .eq('id', existingTask.step_id)
          .single();

        const project = Array.isArray(stepData?.project) ? stepData.project[0] : stepData?.project;
        if (project && project.created_by !== user.id) {
          const statusText = parsed.data.status === 'done' ? 'completed' : 
                           parsed.data.status === 'in_progress' ? 'started working on' : 
                           parsed.data.status === 'blocked' ? 'marked as blocked' : 
                           'updated';
          
          await NotificationService.createNotification({
            userId: project.created_by,
            title: 'Task Status Updated',
            message: `${user.full_name} ${statusText} task "${task.title}" in project "${project.title}"`,
            type: 'project_update',
            relatedId: task.step_id,
            relatedType: 'project_step'
          });
          console.log('Task update notification sent to admin:', project.created_by);
        }
      } catch (notificationError) {
        console.error('Failed to send task update notification:', notificationError);
        // Don't fail the main operation if notification fails
      }
    }

    return NextResponse.json({ task }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in PATCH /api/tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks?id=xxx
 * Delete a task
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Get current user
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the task to find its step_id
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('project_step_tasks')
      .select('step_id')
      .eq('id', taskId)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(user.id, existingTask.step_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Delete task
    const { error: deleteError } = await supabaseAdmin
      .from('project_step_tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in DELETE /api/tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

