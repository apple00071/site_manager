import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';

export async function PATCH(request: NextRequest) {
  try {
    const { id, project_id, task_title, task_description, start_date, estimated_completion_date, assigned_to, priority, status, step_title } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    if (!task_title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    // Get the current task to find its step_id and previous assignment/status
    const { data: currentTask, error: fetchError } = await supabaseAdmin
      .from('project_step_tasks')
      .select('step_id, assigned_to, status, title')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching current task:', fetchError);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let stepId = currentTask.step_id;

    // If project_id is provided, we need to handle the step
    if (project_id) {
      if (stepId) {
        // Update existing step
        const { error: stepUpdateError } = await supabaseAdmin
          .from('project_steps')
          .update({
            title: step_title || 'General Tasks',
            project_id: project_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', stepId);

        if (stepUpdateError) {
          console.error('Error updating step:', stepUpdateError);
          return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
        }
      } else {
        // Create new step
        const { data: newStep, error: stepCreateError } = await supabaseAdmin
          .from('project_steps')
          .insert({
            title: step_title || 'General Tasks',
            project_id: project_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (stepCreateError) {
          console.error('Error creating step:', stepCreateError);
          return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
        }

        stepId = newStep.id;
      }
    }

    // Update the task
    const updateData: any = {
      title: task_title,
      start_date: start_date || null,
      estimated_completion_date: estimated_completion_date || null,
      priority: priority || 'medium',
      status: status || 'todo',
      updated_at: new Date().toISOString(),
      step_id: stepId,
      assigned_to: assigned_to || null, // Always include assigned_to, even if empty
    };

    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('project_step_tasks')
      .update(updateData)
      .eq('id', id)
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
      .single();

    if (updateError) {
      console.error('Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    // WhatsApp notifications
    try {
      const prevAssigned = currentTask.assigned_to as string | null;
      const newAssigned = updateData.assigned_to as string | null;
      const statusChanged = (currentTask.status !== updatedTask.status);

      // Notify on assignment change (to a valid user)
      if (newAssigned && newAssigned !== prevAssigned) {
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('phone_number, full_name')
          .eq('id', newAssigned)
          .single();
        if (assignedUser?.phone_number) {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const projectId = updatedTask.step?.project?.id;
          const link = projectId ? `${origin}/dashboard/projects/${projectId}` : `${origin}/dashboard/tasks`;
          await sendTaskWhatsAppNotification(
            assignedUser.phone_number,
            updatedTask.title || currentTask.title,
            updatedTask.step?.project?.title,
            updatedTask.status,
            link
          );
        }
      } else if (statusChanged && (updatedTask.assigned_to || prevAssigned)) {
        // Notify assigned user on status change as well
        const targetUserId = (updatedTask.assigned_to || prevAssigned) as string | null;
        if (targetUserId) {
          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('phone_number, full_name')
            .eq('id', targetUserId)
            .single();
          if (assignedUser?.phone_number) {
            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const projectId = updatedTask.step?.project?.id;
            const link = projectId ? `${origin}/dashboard/projects/${projectId}` : `${origin}/dashboard/tasks`;
            await sendTaskWhatsAppNotification(
              assignedUser.phone_number,
              updatedTask.title || currentTask.title,
              updatedTask.step?.project?.title,
              updatedTask.status,
              link
            );
          }
        }
      }
    } catch (waError) {
      console.error('WhatsApp send failed on task update:', waError);
      // do not fail the response on notification errors
    }

    return NextResponse.json({
      success: true,
      task: updatedTask
    });

  } catch (error) {
    console.error('Error in update task API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
