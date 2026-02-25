import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache task data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schema for task creation
const createTaskSchema = z.object({
  step_id: z.string().uuid('Invalid step ID'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  start_date: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).default('todo'),
  completion_description: z.string().nullable().optional(),
  completion_photos: z.array(z.string()).nullable().optional(),
});

// Validation schema for task update
const updateTaskSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  start_date: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  completion_description: z.string().nullable().optional(),
  completion_photos: z.array(z.string()).nullable().optional(),
});

/**
 * Helper function to check if user has access to a project
 */
async function checkProjectAccess(userId: string, stepId: string, userRole: string) {
  // Get the project_id from the step
  const { data: step, error: stepError } = await supabaseAdmin
    .from('project_steps')
    .select('project_id')
    .eq('id', stepId)
    .single();

  if (stepError || !step) {
    return { hasAccess: false, error: 'Step not found' };
  }

  // Admins have access to all projects
  if (userRole === 'admin') {
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
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(userId, stepId, userRole);
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
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'No user found' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    console.log('Creating task for user:', user.email, 'step_id:', parsed.data.step_id);

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(userId, parsed.data.step_id, userRole);
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
        completion_description: parsed.data.completion_description || null,
        completion_photos: parsed.data.completion_photos || [],
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
      if (stepData && project && project.created_by !== userId) {
        await NotificationService.createNotification({
          userId: project.created_by,
          title: 'New Task Created',
          message: `${userFullName} created task "${parsed.data.title}" in step "${stepData.title}" for project "${project.title}"`,
          type: 'task_assigned',
          relatedId: task.step_id,
          relatedType: 'project_step'
        });
        console.log('Task creation notification sent to admin:', project.created_by);

        // WhatsApp to project admin
        try {
          const { data: adminUser } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', project.created_by)
            .single();

          if (adminUser?.phone_number) {
            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const link = `${origin}/dashboard/projects/${project.id || stepData.project_id}`;
            await sendTaskWhatsAppNotification(
              adminUser.phone_number,
              parsed.data.title,
              project.title,
              'todo',
              link
            );
          }
        } catch (waError) {
          console.error('Failed to send WhatsApp to project admin on task creation:', waError);
        }
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
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    // Get the task to find its step_id
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('project_step_tasks')
      .select('step_id, assigned_to, title, status')
      .eq('id', parsed.data.id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check access
    const { hasAccess, error: accessError } = await checkProjectAccess(userId, existingTask.step_id, userRole);
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
    if (parsed.data.completion_description !== undefined) updateData.completion_description = parsed.data.completion_description;
    if (parsed.data.completion_photos !== undefined) updateData.completion_photos = parsed.data.completion_photos;
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
        if (project && project.created_by !== userId) {
          const statusText = parsed.data.status === 'done' ? 'completed' :
            parsed.data.status === 'in_progress' ? 'started working on' :
              parsed.data.status === 'blocked' ? 'marked as blocked' :
                'updated';

          await NotificationService.createNotification({
            userId: project.created_by,
            title: 'Task Status Updated',
            message: `${userFullName} ${statusText} task "${task.title}" in project "${project.title}"`,
            type: 'project_update',
            relatedId: task.step_id,
            relatedType: 'project_step'
          });
          console.log('Task update notification sent to admin:', project.created_by);

          // WhatsApp to project admin
          try {
            const { data: adminUser } = await supabaseAdmin
              .from('users')
              .select('phone_number')
              .eq('id', project.created_by)
              .single();

            if (adminUser?.phone_number) {
              const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              const link = project.id ? `${origin}/dashboard/projects/${project.id}` : `${origin}/dashboard/my-tasks`;
              await sendTaskWhatsAppNotification(
                adminUser.phone_number,
                task.title,
                project.title,
                task.status,
                link
              );
            }
          } catch (waError) {
            console.error('Failed to send WhatsApp to project admin on task update:', waError);
          }
        }
      } catch (notificationError) {
        console.error('Failed to send task update notification:', notificationError);
        // Don't fail the main operation if notification fails
      }
    }

    // WhatsApp to assigned user on status change
    try {
      if (parsed.data.status && existingTask.assigned_to) {
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('phone_number')
          .eq('id', existingTask.assigned_to)
          .single();
        if (assignedUser?.phone_number) {
          const { data: stepData } = await supabaseAdmin
            .from('project_steps')
            .select('project_id, project:projects(id, title)')
            .eq('id', existingTask.step_id)
            .single();
          const stepDataAny: any = stepData;
          const projectObj = Array.isArray(stepDataAny?.project)
            ? stepDataAny?.project?.[0]
            : stepDataAny?.project;
          const projectName = projectObj?.title;
          const projectId = projectObj?.id || stepDataAny?.project_id;
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = projectId ? `${origin}/dashboard/projects/${projectId}` : `${origin}/dashboard/my-tasks`;
          await sendTaskWhatsAppNotification(
            assignedUser.phone_number,
            task.title || existingTask.title,
            projectName,
            task.status,
            link
          );
        }

        // Trigger in-app/push notification for assigned user
        await NotificationService.createNotification({
          userId: existingTask.assigned_to,
          title: 'Task Status Updated',
          message: `Task "${task.title || existingTask.title}" status changed to ${task.status}`,
          type: 'project_update',
          relatedId: task.id,
          relatedType: 'task'
        });
      }
    } catch (waError) {
      console.error('Failed to send WhatsApp on task status change:', waError);
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
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

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
    const { hasAccess, error: accessError } = await checkProjectAccess(userId, existingTask.step_id, userRole);
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

