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
        assigned_employee:assigned_employee_id(
          id,
          email,
          name:username,
          full_name,
          designation
        )
      `)
      .order('created_at', { ascending: false });

    // Exclude completed projects by default so old finished projects don't clutter the daily tracker
    if (searchParams.get('include_completed') !== 'true') {
      query = query.neq('status', 'completed');
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

    return NextResponse.json({ projects });
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
      if (stageLower === 'execution' || stageLower.includes('execution')) {
        payload.workflow_stage = 'execution_in_progress';
      } else if (stageLower === 'handover' || stageLower.includes('handover') || stageLower === 'completed') {
        payload.workflow_stage = 'completed';
      } else {
        payload.workflow_stage = 'requirements_upload';
      }
    }
    if (updateFields.status_color !== undefined) payload.special_requirements = updateFields.status_color;
    if (updateFields.project_notes !== undefined) payload.project_notes = updateFields.project_notes;
    if (updateFields.deadline !== undefined) payload.deadline = updateFields.deadline;
    if (updateFields.estimated_completion_date !== undefined) payload.estimated_completion_date = updateFields.estimated_completion_date;

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

    // Asynchronously dispatch two-way push notifications (non-blocking)
    (async () => {
      try {
        const changes: string[] = [];
        if (updateFields.unified_status !== undefined) {
          changes.push(`Status: ${updateFields.unified_status || 'Cleared'}`);
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

        if (changes.length === 0) return;

        // Fetch updater's display name and verified role
        const { data: updaterProfile } = await supabaseAdmin
          .from('users')
          .select('full_name, username, email, role')
          .eq('id', user.id)
          .single();

        const updaterName = updaterProfile?.full_name || updaterProfile?.username || user.email?.split('@')[0] || 'Team member';
        const userRole = (role || updaterProfile?.role || '').toLowerCase();
        const isAdminOrManager = userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager';

        // Project code formatting (e.g. AI/26/51)
        const withCode = await attachProjectCodes(data);
        const rawCode = withCode?.project_code || withCode?.ref_no || `AI-${data.id.slice(0, 4)}`;
        const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
        const projectTitle = data.title || 'Project';

        const recipientIds = new Set<string>();

        if (isAdminOrManager) {
          // Admin/Manager updated -> Notify assigned designer ONLY (design-focused tracker)
          if (data.assigned_employee_id) recipientIds.add(data.assigned_employee_id);
          if (data.designer_id) recipientIds.add(data.designer_id);
        } else {
          // Designer/Employee updated -> Notify all Admins
          const { data: admins } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('role', 'admin');

          if (admins) {
            admins.forEach((a: any) => recipientIds.add(a.id));
          }
          if (data.created_by) recipientIds.add(data.created_by);
        }

        // Never notify the user who made the edit
        recipientIds.delete(user.id);

        if (recipientIds.size === 0) return;

        const isTaskCompleted = 
          (updateFields.unified_status || '').toLowerCase().trim() === 'done' ||
          (updateFields.unified_status || '').toLowerCase().includes('complete') ||
          (updateFields.workflow_stage || '').toLowerCase() === 'completed';

        let notifTitle = '';
        let notifMessage = '';

        if (isAdminOrManager) {
          notifTitle = isTaskCompleted 
            ? `Task Marked Complete: ${projectCode}`
            : `Daily Status: ${projectCode}`;
          notifMessage = `${updaterName} updated "${projectTitle}":\n${changes.join(' • ')}`;
        } else {
          // Designer updated -> Alert Admins
          notifTitle = isTaskCompleted
            ? `Task Done: ${updaterName} (${projectCode})`
            : `Daily Status Update: ${projectCode}`;
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
              relatedType: 'project',
              metadata: {
                route: '/dashboard/daily-status',
                projectId,
                projectCode,
                isCompleted: isTaskCompleted,
              },
            })
          )
        );
        console.log(`[DailyStatus] Dispatched push notifications to ${recipientIds.size} recipient(s) for ${projectCode}`);
      } catch (err) {
        console.error('[DailyStatus] Error sending notifications:', err);
      }
    })();

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    console.error('Unexpected error in PATCH /api/daily-status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
