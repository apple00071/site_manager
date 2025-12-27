import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  start_at: z.string(),
  end_at: z.string(),
  assigned_to: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid(),
});

function parseAndValidateRange(startParam: string | null, endParam: string | null) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 7);
  defaultStart.setHours(0, 0, 0, 0);

  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 30);
  defaultEnd.setHours(23, 59, 59, 999);

  const start = startParam ? new Date(startParam) : defaultStart;
  const end = endParam ? new Date(endParam) : defaultEnd;

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end };
}

async function findConflictTask(assignedTo: string, startIso: string, endIso: string, excludeId?: string) {
  let query = supabaseAdmin
    .from('tasks')
    .select('id,title,start_at,end_at')
    .eq('assigned_to', assignedTo)
    .gt('end_at', startIso)
    .lt('start_at', endIso)
    .limit(1);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');
    const assignedFilter = url.searchParams.get('assigned_to');

    const range = parseAndValidateRange(startParam, endParam);
    if (!range) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    let query = supabaseAdmin
      .from('tasks')
      .select('*')
      .gte('end_at', range.start.toISOString())
      .lte('start_at', range.end.toISOString())
      .order('start_at', { ascending: true });

    if (assignedFilter && assignedFilter !== 'all') {
      query = query.eq('assigned_to', assignedFilter);
    } else if (userRole !== 'admin') {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching calendar tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({ tasks: data || [] }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in GET /api/calendar-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const startDate = new Date(data.start_at);
    const endDate = new Date(data.end_at);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return NextResponse.json({ error: 'Invalid start or end time' }, { status: 400 });
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    let assignedTo: string | null = null;
    if (typeof data.assigned_to === 'string' && data.assigned_to.length > 0) {
      assignedTo = data.assigned_to;
    }

    if (assignedTo) {
      const conflict = await findConflictTask(assignedTo, startIso, endIso);
      if (conflict) {
        const conflictStart = new Date(conflict.start_at as string);
        const conflictEnd = new Date(conflict.end_at as string);
        const conflictWindow = `${conflictStart.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${conflictEnd.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        return NextResponse.json(
          { error: `This user already has a task in that time slot (${conflictWindow}).` },
          { status: 409 },
        );
      }
    }

    let projectData: { id: string; title?: string | null } | null = null;
    if (typeof data.project_id === 'string' && data.project_id.length > 0) {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id,title')
        .eq('id', data.project_id)
        .single();

      if (!projectError && project) {
        projectData = project as { id: string; title?: string | null };
      }
    }

    const insertData = {
      title: data.title,
      description: data.description || null,
      start_at: startIso,
      end_at: endIso,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assigned_to: assignedTo,
      project_id: projectData?.id ?? null,
      created_by: user.id,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from('tasks')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating calendar task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    // WhatsApp notification to assigned user on calendar task creation
    try {
      if (assignedTo) {
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('phone_number, full_name')
          .eq('id', assignedTo)
          .single();

        if (assignedUser?.phone_number) {
          const origin =
            request.headers.get('origin') ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'http://localhost:3000';

          const projectIdForLink = projectData?.id ?? null;
          const link = projectIdForLink
            ? `${origin}/dashboard/projects/${projectIdForLink}`
            : `${origin}/dashboard/tasks`;

          await sendTaskWhatsAppNotification(
            assignedUser.phone_number,
            (inserted.title as string) || data.title,
            projectData?.title ?? undefined,
            // For new assignments, status is always effectively TODO, so omit it from the message
            undefined,
            link,
          );
        }

        console.log('🔔 DEBUG: About to call NotificationService for user:', assignedTo);
        // Trigger OneSignal push notification via NotificationService
        await NotificationService.notifyTaskAssigned(
          assignedTo as string,
          (inserted.title as string) || data.title,
          projectData?.title || 'Apple Interior',
          inserted.id
        );
        console.log('✅ DEBUG: NotificationService call completed');
      }
    } catch (waError) {
      console.error('❌ DEBUG: Notification error in calendar-tasks:', waError);
      // do not fail the main operation on notification errors
    }

    return NextResponse.json({ success: true, task: inserted }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/calendar-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', data.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    if (userRole !== 'admin') {
      if (existing.created_by !== user.id && existing.assigned_to !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const updatedStart = data.start_at ? new Date(data.start_at) : new Date(existing.start_at as string);
    const updatedEnd = data.end_at ? new Date(data.end_at) : new Date(existing.end_at as string);

    if (isNaN(updatedStart.getTime()) || isNaN(updatedEnd.getTime()) || updatedEnd <= updatedStart) {
      return NextResponse.json({ error: 'Invalid start or end time' }, { status: 400 });
    }

    const startIso = updatedStart.toISOString();
    const endIso = updatedEnd.toISOString();

    let assignedTo: string | null = existing.assigned_to as string | null;
    if (Object.prototype.hasOwnProperty.call(data, 'assigned_to')) {
      if (typeof data.assigned_to === 'string' && data.assigned_to.length > 0) {
        assignedTo = data.assigned_to;
      } else {
        assignedTo = null;
      }
    }

    let projectId: string | null = (existing.project_id as string | null) ?? null;
    if (Object.prototype.hasOwnProperty.call(data, 'project_id')) {
      if (typeof data.project_id === 'string' && data.project_id.length > 0) {
        projectId = data.project_id;
      } else {
        projectId = null;
      }
    }

    if (assignedTo) {
      const conflict = await findConflictTask(assignedTo, startIso, endIso, data.id);
      if (conflict) {
        const conflictStart = new Date(conflict.start_at as string);
        const conflictEnd = new Date(conflict.end_at as string);
        const conflictWindow = `${conflictStart.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${conflictEnd.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        return NextResponse.json(
          { error: `This user already has a task in that time slot (${conflictWindow}).` },
          { status: 409 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description || null;
    updatePayload.start_at = startIso;
    updatePayload.end_at = endIso;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    updatePayload.assigned_to = assignedTo;
    updatePayload.project_id = projectId;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(updatePayload)
      .eq('id', data.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating calendar task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    // WhatsApp notifications for calendar task updates
    try {
      const prevAssigned = (existing.assigned_to as string | null) ?? null;
      const newAssigned = (assignedTo as string | null) ?? null;
      const statusChanged = existing.status !== updated.status;

      let projectDataForUpdate: { id: string; title?: string | null } | null = null;
      if (projectId) {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('id,title')
          .eq('id', projectId)
          .single();
        if (project) {
          projectDataForUpdate = project as { id: string; title?: string | null };
        }
      }

      const origin =
        request.headers.get('origin') ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000';

      const projectIdForLink = projectDataForUpdate?.id ?? null;
      const link = projectIdForLink
        ? `${origin}/dashboard/projects/${projectIdForLink}`
        : `${origin}/dashboard/tasks`;

      // Notify on assignment change
      if (newAssigned && newAssigned !== prevAssigned) {
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('phone_number, full_name')
          .eq('id', newAssigned)
          .single();

        if (assignedUser?.phone_number) {
          const rawStatus = (updated.status as string) || (existing.status as string);
          const statusForMessage = rawStatus && rawStatus !== 'todo' ? rawStatus : undefined;

          await sendTaskWhatsAppNotification(
            assignedUser.phone_number,
            (updated.title as string) || (existing.title as string),
            projectDataForUpdate?.title ?? undefined,
            // When simply assigning a task, it's usually TODO; omit status unless it's something else
            statusForMessage,
            link,
          );
        }

        // Trigger OneSignal push notification for assignment change
        await NotificationService.notifyTaskAssigned(
          newAssigned,
          (updated.title as string) || (existing.title as string),
          projectDataForUpdate?.title || 'Apple Interior',
          updated.id
        );
      } else if (statusChanged && (updated.assigned_to || prevAssigned)) {
        // Notify assigned user on status change
        const targetUserId = (updated.assigned_to || prevAssigned) as string | null;
        if (targetUserId) {
          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('phone_number, full_name')
            .eq('id', targetUserId)
            .single();

          if (assignedUser?.phone_number) {
            await sendTaskWhatsAppNotification(
              assignedUser.phone_number,
              (updated.title as string) || (existing.title as string),
              projectDataForUpdate?.title ?? undefined,
              (updated.status as string) || (existing.status as string),
              link,
            );
          }

          // Trigger OneSignal push notification for status change
          await NotificationService.createNotification({
            userId: targetUserId,
            title: 'Task Status Updated',
            message: `Task "${(updated.title as string) || (existing.title as string)}" status changed to ${updated.status}`,
            type: 'project_update',
            relatedId: updated.id,
            relatedType: 'task'
          });
        }
      }
    } catch (waError) {
      console.error('WhatsApp send failed on calendar task update:', waError);
      // do not fail the main operation on notification errors
    }

    return NextResponse.json({ success: true, task: updated }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/calendar-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : null;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    if (userRole !== 'admin') {
      if (existing.created_by !== user.id && existing.assigned_to !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting calendar task:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/calendar-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
