import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, supabaseAdmin } from '@/lib/supabase-server';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';
import { NotificationService } from '@/lib/notificationService';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schema for standalone task creation
const createStandaloneTaskSchema = z.object({
  project_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
  step_title: z.string().min(1, 'Step title is required').max(255, 'Step title too long').optional(),
  task_title: z.string().min(1, 'Task title is required').max(255, 'Task title too long'),
  task_description: z.string().optional(),
  start_date: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
  assigned_to: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

/**
 * POST /api/tasks/create
 * Create a new task with automatic step creation if needed
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/tasks/create called ===');

    const body = await request.json();
    console.log('Request body:', body);

    // Validate input
    const parsed = createStandaloneTaskSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Validation failed:', parsed.error);
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Get current user using secure authentication
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Simplified access check - allow all authenticated users to create tasks
    console.log('User creating task:', user.email, 'Role:', user.role);

    // Convert empty strings to null for proper handling
    const projectId = parsed.data.project_id === '' ? null : parsed.data.project_id;
    const assignedTo = parsed.data.assigned_to === '' ? null : parsed.data.assigned_to;

    // Handle step creation only if project_id is provided
    let stepId: string | null = null;
    
    if (projectId && parsed.data.step_title) {
      const { data: existingStep } = await supabaseAdmin
        .from('project_steps')
        .select('id')
        .eq('project_id', projectId)
        .eq('title', parsed.data.step_title)
        .single();

      if (existingStep) {
        stepId = existingStep.id;
        console.log('Using existing step:', stepId);
      } else {
        // Create new step
        const { data: newStep, error: stepError } = await supabaseAdmin
          .from('project_steps')
          .insert({
            project_id: projectId,
            title: parsed.data.step_title,
            description: `Step created for task: ${parsed.data.task_title}`,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (stepError) {
          console.error('Error creating step:', stepError);
          return NextResponse.json(
            { error: 'Failed to create project step' },
            { status: 500 }
          );
        }

        stepId = newStep.id;
        console.log('Created new step:', stepId);
      }
    }

    // Create the task
    const { data: task, error: taskError } = await supabaseAdmin
      .from('project_step_tasks')
      .insert({
        step_id: stepId,
        title: parsed.data.task_title,
        description: parsed.data.task_description || null,
        start_date: parsed.data.start_date || null,
        estimated_completion_date: parsed.data.estimated_completion_date || null,
        priority: parsed.data.priority,
        assigned_to: assignedTo,
        created_by: user.id,
        status: 'todo',
      })
      .select(`
        *,
        step:project_steps(
          id,
          title,
          project:projects(
            id,
            title,
            customer_name,
            phone_number
          )
        )
      `)
      .single();

    if (taskError) {
      console.error('Error creating task:', taskError);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Send notifications
    try {
      // Get project details for notifications (only if project_id exists)
      let projectData = null;
      if (projectId) {
        const { data } = await supabaseAdmin
          .from('projects')
          .select('title, customer_name, created_by')
          .eq('id', projectId)
          .single();
        projectData = data;
      }

      // Notify assigned user if different from creator
      if (assignedTo && typeof assignedTo === 'string' && assignedTo !== user.id) {
        await NotificationService.createNotification({
          userId: assignedTo,
          title: 'Task Assigned',
          message: `You have been assigned task "${parsed.data.task_title}"${projectData ? ` in project "${projectData.title}"` : ''}`,
          type: 'task_assigned',
          relatedId: task.id,
          relatedType: 'task'
        });
      }

      // Notify project admin if user is not admin
      if (user.role !== 'admin' && projectData && projectData.created_by !== user.id) {
        await NotificationService.createNotification({
          userId: projectData.created_by,
          title: 'New Task Created',
          message: `${user.full_name} created task "${parsed.data.task_title}" in project "${projectData.title}"`,
          type: 'project_update',
          relatedId: task.id,
          relatedType: 'task'
        });
      }
      
      // WhatsApp: notify assigned employee (if phone available)
      if (assignedTo) {
        try {
          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('phone_number, full_name')
            .eq('id', assignedTo)
            .single();

          if (assignedUser?.phone_number) {
            await sendTaskWhatsAppNotification(
              assignedUser.phone_number,
              parsed.data.task_title,
              projectData?.title,
              'todo'
            );
          }
        } catch (waError) {
          console.error('Failed to send WhatsApp to assigned employee:', waError);
        }
      }
    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError);
      // Don't fail the main operation
    }

    console.log('✅ Task created successfully:', task.id);
    return NextResponse.json({ 
      success: true, 
      task,
      project_phone: task?.step?.project?.phone_number || null,
      message: 'Task created successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/tasks/create:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
