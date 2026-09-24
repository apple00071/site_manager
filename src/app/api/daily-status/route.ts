import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { attachProjectCodes } from '@/lib/projectUtils';
import { NotificationService } from '@/lib/notificationService';

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
    const includeCompleted = searchParams.get('include_completed') === 'true';

    // Check if user has management oversight (admin, lead designer, or designs.view_all permission)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, role, designation, roles:role_id(name)')
      .eq('id', user.id)
      .single();

    const { checkPermission } = await import('@/lib/rbac');
    const viewAllPerm = await checkPermission(user.id, 'designs.view_all');
    const pagePerm = await checkPermission(user.id, 'designs.daily_status');

    const isAdmin = Boolean(
      user.role === 'admin' ||
      userData?.role === 'admin' ||
      (userData?.roles as any)?.name?.toLowerCase() === 'admin'
    );
    const isLead = Boolean(
      userData?.designation?.toLowerCase().includes('lead') ||
      (userData?.roles as any)?.name?.toLowerCase().includes('lead')
    );

    const isManagement = Boolean(
      isAdmin ||
      isLead ||
      viewAllPerm.allowed
    );

    // Permission check to access daily status at all
    if (!isAdmin && !pagePerm.allowed && !viewAllPerm.allowed && !isLead && userData?.role !== 'employee') {
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

    // Exclude completed projects by default so old finished projects don't clutter the daily tracker
    if (searchParams.get('include_completed') !== 'true') {
      query = query.neq('status', 'completed');
    }

    // Non-management designers only see projects assigned to them
    if (!isManagement) {
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

    // Check if user has management oversight (admin, lead designer, or designs.view_all permission)
    const { data: updaterUserData } = await supabaseAdmin
      .from('users')
      .select('id, role, designation, roles:role_id(name)')
      .eq('id', user.id)
      .single();

    const { checkPermission: checkPermPatch } = await import('@/lib/rbac');
    const viewAllPerm = await checkPermPatch(user.id, 'designs.view_all');

    const isAdmin = Boolean(
      user.role === 'admin' ||
      updaterUserData?.role === 'admin' ||
      (updaterUserData?.roles as any)?.name?.toLowerCase() === 'admin'
    );
    const isLead = Boolean(
      updaterUserData?.designation?.toLowerCase().includes('lead') ||
      (updaterUserData?.roles as any)?.name?.toLowerCase().includes('lead')
    );
    const isManagement = Boolean(isAdmin || isLead || viewAllPerm.allowed);

    // Non-management designers can only update projects assigned to them
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
      const changes: string[] = [];
      if (updateFields.unified_status !== undefined) {
        changes.push(`Status: ${updateFields.unified_status || 'Cleared'}`);
      }
      if (updateFields.status_color !== undefined) {
        changes.push(updateFields.status_color ? `Color Tag: ${updateFields.status_color}` : 'Color Tag: Cleared');
      }
      if (updateFields.deadline !== undefined) {
        const dStr = updateFields.deadline
          ? new Date(updateFields.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'None';
        changes.push(`Target Date: ${dStr}`);
      }
      if (updateFields.project_notes !== undefined) {
        const noteText = (updateFields.project_notes || '').trim();
        if (noteText) {
          changes.push(`Notes: "${noteText.slice(0, 50)}${noteText.length > 50 ? '...' : ''}"`);
        }
      }
      if (updateFields.workflow_stage !== undefined) {
        changes.push(`Phase: ${updateFields.workflow_stage}`);
      }
      if (updateFields.status !== undefined) {
        changes.push(`Project Status: ${updateFields.status}`);
      }

      if (changes.length > 0) {
        // Fetch updater's display name and verified role/designation
        const { data: updaterProfile } = await supabaseAdmin
          .from('users')
          .select('full_name, username, email, role, designation, roles:role_id(name)')
          .eq('id', user.id)
          .single();

        const updaterName = updaterProfile?.full_name || updaterProfile?.username || user.email?.split('@')[0] || 'Team member';
        const userSysRole = (role || updaterProfile?.role || '').toLowerCase();
        const customRoleName = ((updaterProfile?.roles as any)?.name || '').toLowerCase();
        const designation = (updaterProfile?.designation || '').toLowerCase();

        // Lead Designers, Admins, and HR are management roles for Daily Status
        const isLeadOrAdmin =
          userSysRole === 'admin' ||
          userSysRole === 'super_admin' ||
          customRoleName === 'admin' ||
          customRoleName === 'admin hr' ||
          customRoleName.includes('lead') ||
          designation.includes('lead') ||
          designation.includes('admin');

        // Project code formatting (e.g. AI/26/51)
        const withCode = await attachProjectCodes(data);
        const rawCode = withCode?.project_code || withCode?.ref_no || `AI-${data.id.slice(0, 4)}`;
        const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
        const projectTitle = data.title || 'Project';

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
          if (userSysRole === 'admin' || customRoleName === 'admin') {
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
          const isTaskCompleted = 
            (updateFields.unified_status || '').toLowerCase().trim() === 'done' ||
            (updateFields.unified_status || '').toLowerCase().includes('complete') ||
            (updateFields.workflow_stage || '').toLowerCase() === 'completed';

          let notifTitle = '';
          let notifMessage = '';

          if (isLeadOrAdmin) {
            notifTitle = isTaskCompleted 
              ? `Task Marked Done: ${projectCode}`
              : `Design Update: ${projectCode}`;
            notifMessage = `${updaterName} updated "${projectTitle}":\n${changes.join(' • ')}`;
          } else {
            notifTitle = isTaskCompleted
              ? `Task Done: ${updaterName} (${projectCode})`
              : `Design Update: ${projectCode}`;
            notifMessage = isTaskCompleted
              ? `${updaterName} marked design task as DONE for "${projectTitle}"\n${changes.join(' • ')}`
              : `${updaterName} updated "${projectTitle}":\n${changes.join(' • ')}`;
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
