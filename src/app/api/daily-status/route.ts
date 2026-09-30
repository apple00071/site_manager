import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { attachProjectCodes } from '@/lib/projectUtils';
import { NotificationService } from '@/lib/notificationService';
import { parseProjectTasks } from '@/lib/designTaskUtils';

export const dynamic = 'force-dynamic';

const updateStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.string().nullable().optional(),
  unified_status: z.string().nullable().optional(),
  status_color: z.string().nullable().optional(),
  workflow_stage: z.string().nullable().optional(),
  project_notes: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  estimated_completion_date: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // All permission data is already in user.permissionCodes — zero extra DB hits
    const { checkPermission } = await import('@/lib/rbac');
    const [viewAllPerm, pagePerm] = [checkPermission(user, 'designs.view_all'), checkPermission(user, 'designs.daily_status')];
    // These are sync when user is AuthUser, but the fn is async so await both
    const [viewAll, page] = await Promise.all([viewAllPerm, pagePerm]);

    const isLead = Boolean(user.designation?.toLowerCase().includes('lead'));
    const isManagement = Boolean(user.isAdmin || isLead || viewAll.allowed);

    if (!user.isAdmin && !page.allowed && !viewAll.allowed && !isLead && user.role !== 'employee') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from('projects')
      .select(`
        id,
        title,
        customer_name,
        phone_number,
        start_date,
        deadline,
        estimated_completion_date,
        status,
        workflow_stage,
        unified_status,
        special_requirements,
        project_notes,
        created_at,
        assigned_employee_id,
        designer_id,
        assigned_employee:assigned_employee_id(
          id,
          email,
          name:username,
          full_name,
          designation
        ),
        designer:designer_id(
          id,
          email,
          username,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (searchParams.get('include_completed') !== 'true') {
      query = query.neq('status', 'completed');
    }

    if (!isManagement) {
      // Fetch member projects in parallel with (or before) the main query
      const { data: memberProjects } = await supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      const memberIds = (memberProjects || []).map((m: any) => m.project_id).filter(Boolean);
      if (memberIds.length > 0) {
        query = query.or(`assigned_employee_id.eq.${user.id},designer_id.eq.${user.id},id.in.(${memberIds.join(',')})`);
      } else {
        query = query.or(`assigned_employee_id.eq.${user.id},designer_id.eq.${user.id}`);
      }
    }

    const { data: rawProjects, error } = await query;

    if (error) {
      console.error('Error fetching daily status projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    const rawWithColor = (rawProjects || []).map((p: any) => ({
      ...p,
      status_color: p.special_requirements || null,
    }));
    const projects = await attachProjectCodes(rawWithColor);

    return NextResponse.json({ projects, isManagement });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/daily-status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { projectId, ...updateFields } = validation.data;

    // Filter out undefined fields
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    if (updateFields.status !== undefined) {
      payload.status = updateFields.status;
      if (updateFields.status === 'completed') {
        payload.actual_completion_date = new Date().toISOString();
      }
    }

    // Daily design task status (e.g. 'Done', 'Drawings in progress')
    // NOTE: Updating a daily design task does NOT complete the whole interior project!
    if (updateFields.unified_status !== undefined) {
      payload.unified_status = updateFields.unified_status;
    }

    if (updateFields.workflow_stage !== undefined) {
      const stageLower = (updateFields.workflow_stage || '').toLowerCase().trim();
      if (stageLower === 'execution' || stageLower.includes('execution') || stageLower === 'in_progress') {
        payload.workflow_stage = 'in_progress';
        payload.status = 'in_progress';
      } else if (stageLower === 'handover' || stageLower.includes('handover')) {
        payload.workflow_stage = 'completed';
        payload.status = 'handover';
      } else if (stageLower === 'completed' || stageLower.includes('complet')) {
        payload.workflow_stage = 'completed';
        payload.status = 'completed';
        payload.actual_completion_date = new Date().toISOString();
      } else {
        payload.workflow_stage = 'requirements_upload';
        payload.status = 'pending';
      }
    }
    if (updateFields.status_color !== undefined) payload.special_requirements = updateFields.status_color;
    if (updateFields.project_notes !== undefined) payload.project_notes = updateFields.project_notes;
    if (updateFields.deadline !== undefined) payload.deadline = updateFields.deadline;
    if (updateFields.estimated_completion_date !== undefined) payload.estimated_completion_date = updateFields.estimated_completion_date;

    // All permission data already in user.permissionCodes — no extra DB hit
    const isLead = Boolean(user.designation?.toLowerCase().includes('lead'));
    const isManagement = Boolean(user.isAdmin || isLead ||
      (await (await import('@/lib/rbac')).checkPermission(user, 'designs.view_all')).allowed);

    if (!isManagement) {
      const { data: targetProj } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, designer_id')
        .eq('id', projectId)
        .single();

      let isAssigned = targetProj && (targetProj.assigned_employee_id === user.id || targetProj.designer_id === user.id);
      if (!isAssigned) {
        const { data: member } = await supabaseAdmin
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (member) isAssigned = true;
      }

      if (!isAssigned) {
        return NextResponse.json({ error: 'Forbidden: You can only update your own assigned projects' }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select(`
        id,
        title,
        customer_name,
        start_date,
        deadline,
        estimated_completion_date,
        status,
        workflow_stage,
        unified_status,
        special_requirements,
        project_notes,
        created_at,
        created_by,
        designer_id,
        site_supervisor_id,
        assigned_employee_id,
        assigned_employee:assigned_employee_id(
          id,
          email,
          name:username,
          full_name,
          designation
        )
      `)
      .single();

    if (error) {
      console.error('Error updating project status:', error);
      return NextResponse.json({ error: 'Failed to update project status' }, { status: 500 });
    }

    const project = {
      ...data,
      status_color: data?.special_requirements || null,
    };

    // Dispatch two-way push & in-app notifications
    try {
      const isTaskCompleted = 
        (updateFields.unified_status || '').toLowerCase().trim() === 'done' ||
        (updateFields.unified_status || '').toLowerCase().includes('complete') ||
        (updateFields.workflow_stage || '').toLowerCase() === 'completed';

      let taskTitle: string | null = null;
      let humanNotes: string | null = null;

      if (updateFields.project_notes !== undefined) {
        const rawNotes = (updateFields.project_notes || '').trim();
        if (rawNotes.startsWith('{') && (rawNotes.includes('"tasks"') || rawNotes.includes('"history"'))) {
          try {
            const tasksData = parseProjectTasks(rawNotes, data);
            if (isTaskCompleted && tasksData.history.length > 0) {
              taskTitle = tasksData.history[0]?.title || null;
            } else if (tasksData.tasks.length > 0) {
              taskTitle = tasksData.tasks[0]?.title || null;
            }
          } catch (_) {}
        } else if (rawNotes && !rawNotes.startsWith('{')) {
          humanNotes = rawNotes;
        }
      }

      const changes: string[] = [];

      // Only show status change if not already expressed by "Task Marked Done"
      if (updateFields.unified_status !== undefined && !isTaskCompleted) {
        changes.push(`Status: ${updateFields.unified_status || 'In Progress'}`);
      }

      // Priority: NEVER show raw hex codes (#10B981, #FF3366, etc.)
      if (updateFields.status_color !== undefined) {
        const col = (updateFields.status_color || '').toUpperCase();
        if (col === '#EF4444' || col === '#DC2626' || col === '#FF3366') {
          changes.push('Priority: High');
        } else if (col === '#F59E0B' || col === '#D97706') {
          changes.push('Priority: Medium');
        }
      }

      // Deadline: Only show if an actual date is set and task is not completed
      if (updateFields.deadline !== undefined && !isTaskCompleted && updateFields.deadline) {
        const dStr = new Date(updateFields.deadline).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        changes.push(`Target: ${dStr}`);
      }

      // Human notes (NEVER raw JSON)
      if (humanNotes) {
        const snippet = humanNotes.slice(0, 60);
        changes.push(`Note: "${snippet}${humanNotes.length > 60 ? '...' : ''}"`);
      }

      if (updateFields.workflow_stage !== undefined) {
        changes.push(`Phase: ${updateFields.workflow_stage}`);
      }
      if (updateFields.status !== undefined && updateFields.status !== updateFields.unified_status) {
        changes.push(`Project Status: ${updateFields.status}`);
      }

      const hasMeaningfulChange =
        updateFields.unified_status !== undefined ||
        updateFields.workflow_stage !== undefined ||
        updateFields.status !== undefined ||
        Boolean(updateFields.deadline && !isTaskCompleted) ||
        Boolean(humanNotes) ||
        Boolean(taskTitle && isTaskCompleted);

      if (hasMeaningfulChange) {
        // Use AuthUser fields directly — no extra DB hit needed
        const updaterName = user.full_name || user.username || user.email?.split('@')[0] || 'Team member';
        const isLeadOrAdmin = user.isAdmin || Boolean(user.designation?.toLowerCase().includes('lead'));

        // Project code formatting (e.g. AI/26/51)
        const withCode = await attachProjectCodes(data);
        const rawCode = withCode?.project_code || withCode?.ref_no || `AI-${data.id.slice(0, 4)}`;
        const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
        const cleanProjectTitle = (data.title || 'Project')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Fetch all Admins and Lead Designers
        const { data: managementUsers } = await supabaseAdmin
          .from('users')
          .select('id, role, designation, roles:role_id(name)');

        const adminIds: string[] = [];
        const leadDesignerIds: string[] = [];

        (managementUsers || []).forEach((u: any) => {
          const sysRole = (u.role || '').toLowerCase();
          const cRole = ((u.roles as any)?.name || '').toLowerCase();
          const desig = (u.designation || '').toLowerCase();

          if (sysRole === 'admin' || cRole === 'admin' || cRole === 'admin hr' || desig.includes('admin')) {
            adminIds.push(u.id);
          }
          if (cRole.includes('lead') || desig.includes('lead')) {
            leadDesignerIds.push(u.id);
          }
        });

        const recipientIds = new Set<string>();

        if (isLeadOrAdmin) {
          // Lead Designer or Admin updated -> Notify assigned designer(s)
          if (data.assigned_employee_id) recipientIds.add(data.assigned_employee_id);
          if (data.designer_id) recipientIds.add(data.designer_id);

          // If an Admin updated, also inform the Lead Designer(s)
          if (user.isAdmin) {
            leadDesignerIds.forEach(id => recipientIds.add(id));
          }
        } else {
          // Regular Designer updated -> Notify Lead Designer(s) and Admins
          leadDesignerIds.forEach(id => recipientIds.add(id));
          adminIds.forEach(id => recipientIds.add(id));
          if (data.created_by) recipientIds.add(data.created_by);
        }

        // Never notify the user who made the edit
        recipientIds.delete(user.id);

        // Failsafe: if recipientIds is empty (e.g. self-assigned during testing),
        // fallback to alerting Admins/Leads so notifications always fire
        if (recipientIds.size === 0) {
          leadDesignerIds.forEach(id => {
            if (id !== user.id) recipientIds.add(id);
          });
          adminIds.forEach(id => {
            if (id !== user.id) recipientIds.add(id);
          });
        }

        if (recipientIds.size > 0) {
          let notifTitle = '';
          let notifMessage = '';

          const isRealTaskName = Boolean(
            taskTitle &&
            taskTitle !== 'Design Task' &&
            taskTitle.toLowerCase() !== 'done' &&
            taskTitle.toLowerCase() !== 'in progress'
          );

          if (isTaskCompleted) {
            notifTitle = isLeadOrAdmin
              ? `Task Marked Done: ${projectCode}`
              : `Task Done: ${updaterName} (${projectCode})`;
            const donePhrase = isRealTaskName ? `marked "${taskTitle}" as DONE` : 'marked task as DONE';
            notifMessage = `${updaterName} ${donePhrase} for "${cleanProjectTitle}"`;
            if (changes.length > 0) {
              notifMessage += `\n${changes.join(' • ')}`;
            }
          } else {
            notifTitle = `Design Update: ${projectCode}`;
            const prefix = isRealTaskName ? `Task: "${taskTitle}"` : '';
            const detailParts = [prefix, ...changes].filter(Boolean);
            notifMessage = detailParts.length > 0
              ? `${updaterName} updated "${cleanProjectTitle}":\n${detailParts.join(' • ')}`
              : `${updaterName} updated "${cleanProjectTitle}"`;
          }

          await Promise.allSettled(
            Array.from(recipientIds).map((recipientId) =>
              NotificationService.createNotification({
                userId: recipientId,
                title: notifTitle,
                message: notifMessage,
                type: 'project_update',
                relatedId: projectId,
                relatedType: 'daily_status',
                metadata: {
                  route: '/dashboard/daily-status',
                  projectId,
                  projectCode,
                  isCompleted: isTaskCompleted,
                },
              })
            )
          );
          console.log(`[DailyStatus] Dispatched notifications to ${recipientIds.size} recipient(s) for ${projectCode}`);
        }
      }
    } catch (notifErr) {
      console.error('[DailyStatus] Error sending notifications:', notifErr);
    }

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    console.error('Unexpected error in PATCH /api/daily-status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
