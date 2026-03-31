import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createCalendarTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().nullable().optional(),
  completion_description: z.string().nullable().optional(),
  completion_photos: z.array(z.string()).nullable().optional(),
  start_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date format',
  }),
  end_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date format',
  }),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.array(z.string().uuid()).nullable().optional(),
  project_id: z.string().uuid('Invalid project ID').nullable().optional(),
  location: z.string().optional().nullable(),
  meeting_link: z.string().optional().nullable(),
});

const updateTaskSchema = createCalendarTaskSchema.partial().extend({
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
    .contains('assigned_to', [assignedTo])
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
      // Use contains operator for array column
      query = query.contains('assigned_to', [assignedFilter]);
    } else if (userRole !== 'admin') {
      // In Supabase/PostgREST, there isn't a direct 'or' for 'contains' in the same way as EQ. 
      // We might need to use a raw filter or stay with simple OR if we keep a single primary assigned_to_id.
      // However, we've moved to arrays. The best way for 'assigned_to contains user.id OR created_by equals user.id'
      // is to use a filter string.
      query = query.or(`assigned_to.cs.{"${user.id}"},created_by.eq.${user.id}`);
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
    const parsed = createCalendarTaskSchema.safeParse(body);

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

    let assignedTo: string[] = [];
    if (Array.isArray(data.assigned_to)) {
      assignedTo = data.assigned_to;
    }

    if (assignedTo.length > 0) {
      for (const assigneeId of assignedTo) {
        const conflict = await findConflictTask(assigneeId, startIso, endIso);
        if (conflict) {
          const conflictStart = new Date(conflict.start_at as string);
          const conflictEnd = new Date(conflict.end_at as string);
          const conflictWindow = `${conflictStart.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${conflictEnd.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
          
          const { data: userData } = await supabaseAdmin.from('users').select('full_name').eq('id', assigneeId).single();
          const userName = userData?.full_name || 'One of the assignees';

          return NextResponse.json(
            { error: `${userName} already has a task in that time slot (${conflictWindow}).` },
            { status: 409 },
          );
        }
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
      completion_description: data.completion_description || null,
      completion_photos: data.completion_photos || [],
      start_at: startIso,
      end_at: endIso,
      status: data.status || 'todo',
      priority: data.priority, // Use schema default
      assigned_to: assignedTo,
      project_id: projectData?.id ?? null,
      created_by: user.id,
      location: data.location || null,
      meeting_link: data.meeting_link || null,
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

    // WhatsApp notification to ALL assigned users on calendar task creation
    try {
      if (assignedTo.length > 0) {
        const origin =
          request.headers.get('origin') ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          'http://localhost:3000';

        const projectIdForLink = projectData?.id ?? null;
        const link = projectIdForLink
          ? `${origin}/dashboard/projects/${projectIdForLink}`
          : `${origin}/dashboard/tasks`;

        for (const assigneeId of assignedTo) {
          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('phone_number, full_name')
            .eq('id', assigneeId)
            .single();

          if (assignedUser?.phone_number) {
            await sendTaskWhatsAppNotification(
              assignedUser.phone_number,
              (inserted.title as string) || data.title,
              projectData?.title ?? undefined,
              // For new assignments, status is always effectively TODO, so omit it from the message
              undefined,
              link,
            );
          }

          console.log('🔔 DEBUG: About to call NotificationService for user:', assigneeId);
          // Trigger OneSignal push notification via NotificationService
          await NotificationService.notifyTaskAssigned(
            assigneeId,
            (inserted.title as string) || data.title,
            projectData?.title || 'Apple Interior',
            inserted.id
          );
          console.log('✅ DEBUG: NotificationService call completed for user:', assigneeId);
        }
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

    let assignedTo: string[] = Array.isArray(existing.assigned_to) ? existing.assigned_to : (existing.assigned_to ? [existing.assigned_to] : []);
    if (Object.prototype.hasOwnProperty.call(data, 'assigned_to')) {
      assignedTo = Array.isArray(data.assigned_to) ? data.assigned_to : (data.assigned_to ? [data.assigned_to] : []);
    }

    let projectId: string | null = (existing.project_id as string | null) ?? null;
    if (Object.prototype.hasOwnProperty.call(data, 'project_id')) {
      if (typeof data.project_id === 'string' && data.project_id.length > 0) {
        projectId = data.project_id;
      } else {
        projectId = null;
      }
    }

    if (assignedTo.length > 0) {
      for (const assigneeId of assignedTo) {
        const conflict = await findConflictTask(assigneeId, startIso, endIso, data.id);
        if (conflict) {
          const conflictStart = new Date(conflict.start_at as string);
          const conflictEnd = new Date(conflict.end_at as string);
          const conflictWindow = `${conflictStart.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${conflictEnd.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
          
          const { data: userData } = await supabaseAdmin.from('users').select('full_name').eq('id', assigneeId).single();
          const userName = userData?.full_name || 'One of the assignees';

          return NextResponse.json(
            { error: `${userName} already has a task in that time slot (${conflictWindow}).` },
            { status: 409 },
          );
        }
      }
    }

    const updatePayload: Record<string, unknown> = {};

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description || null;
    if (data.completion_description !== undefined) updatePayload.completion_description = data.completion_description || null;
    if (data.completion_photos !== undefined) updatePayload.completion_photos = data.completion_photos || [];
    updatePayload.start_at = startIso;
    updatePayload.end_at = endIso;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.location !== undefined) updatePayload.location = data.location || null;
    if (data.meeting_link !== undefined) updatePayload.meeting_link = data.meeting_link || null;
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
      const prevAssigned = Array.isArray(existing.assigned_to) ? existing.assigned_to : (existing.assigned_to ? [existing.assigned_to] : []);
      const newAssigned = assignedTo;
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

      // Notify newly added assignees
      const newlyAdded = newAssigned.filter(id => !prevAssigned.includes(id));
      for (const assigneeId of newlyAdded) {
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('phone_number, full_name')
          .eq('id', assigneeId)
          .single();

        if (assignedUser?.phone_number) {
          const rawStatus = (updated.status as string) || (existing.status as string);
          const statusForMessage = rawStatus && rawStatus !== 'todo' ? rawStatus : undefined;

          await sendTaskWhatsAppNotification(
            assignedUser.phone_number,
            (updated.title as string) || (existing.title as string),
            projectDataForUpdate?.title ?? undefined,
            statusForMessage,
            link,
          );
        }

        await NotificationService.notifyTaskAssigned(
          assigneeId,
          (updated.title as string) || (existing.title as string),
          projectDataForUpdate?.title || 'Apple Interior',
          updated.id
        );
      }

      // Notify all current assignees if status changed
      if (statusChanged && newAssigned.length > 0) {
        for (const assigneeId of newAssigned) {
          // If we already notified them because they were newly added, skip
          if (newlyAdded.includes(assigneeId)) continue;

          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('phone_number, full_name')
            .eq('id', assigneeId)
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

          await NotificationService.createNotification({
            userId: assigneeId,
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
      const isAssigned = Array.isArray(existing.assigned_to) && existing.assigned_to.includes(user.id);
      if (existing.created_by !== user.id && !isAssigned) {
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
