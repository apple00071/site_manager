import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError, role } = await getAuthUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!authUser.isAdmin && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') || 'all'; // 'all' | 'site_engineer' | 'designer'
    const targetUserId = searchParams.get('userId') || 'all';
    
    // Default to last 7 days if not provided
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultEnd = now.toISOString().split('T')[0];

    const startDate = searchParams.get('startDate') || defaultStart;
    const endDate = searchParams.get('endDate') || defaultEnd;

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    // 1. Fetch Users
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, designation, phone_number, is_active')
      .order('full_name', { ascending: true });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const isSiteEngineer = (u: any) => {
      const desig = (u.designation || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return desig.includes('site') || desig.includes('supervisor') || desig.includes('engineer') || role.includes('engineer');
    };

    const isDesigner = (u: any) => {
      const desig = (u.designation || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return desig.includes('designer') || role === 'designer';
    };

    // Filter users based on query
    let targetUsers = (allUsers || []).filter((u: any) => {
      if (!u.is_active && u.is_active !== null) return false;
      const engineer = isSiteEngineer(u);
      const designer = isDesigner(u);
      
      if (roleFilter === 'site_engineer') return engineer;
      if (roleFilter === 'designer') return designer;
      return engineer || designer;
    });

    if (targetUserId && targetUserId !== 'all') {
      targetUsers = targetUsers.filter((u: any) => u.id === targetUserId);
    }

    const userIds = targetUsers.map((u: any) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({
        period: { startDate, endDate },
        summary: {
          totalUpdates: 0,
          totalPhotos: 0,
          activeProjectsCount: 0,
          totalSnagsResolved: 0,
          totalAttendanceDays: 0,
        },
        users: [],
        availableUsers: allUsers?.filter((u: any) => isSiteEngineer(u) || isDesigner(u)) || []
      });
    }

    // 2. Fetch parallel telemetry in date range
    const [
      updatesRes,
      attendanceRes,
      projectsRes,
      projectMembersRes,
      snagsRes,
      designFilesRes
    ] = await Promise.all([
      // Project updates
      supabaseAdmin
        .from('project_updates')
        .select(`
          id,
          project_id,
          user_id,
          update_date,
          description,
          photos,
          created_at,
          project:projects(id, title, customer_name, status, workflow_stage)
        `)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .in('user_id', userIds)
        .order('created_at', { ascending: false }),

      // Attendance
      supabaseAdmin
        .from('attendance')
        .select('id, user_id, date, status, punch_in_time, punch_out_time, working_hours')
        .gte('date', startDate)
        .lte('date', endDate)
        .in('user_id', userIds)
        .order('date', { ascending: false }),

      // All projects (for assigning active projects)
      supabaseAdmin
        .from('projects')
        .select('id, title, customer_name, status, workflow_stage, unified_status, project_notes, designer_id, assigned_employee_id, site_supervisor_id, deadline, estimated_completion_date'),

      // Project members junction
      supabaseAdmin
        .from('project_members')
        .select('project_id, user_id')
        .in('user_id', userIds),

      // Snags
      supabaseAdmin
        .from('snags')
        .select('id, project_id, title, status, created_at, resolved_at, assigned_to_user_id, created_by, project:projects(id, title)')
        .gte('created_at', startIso)
        .lte('created_at', endIso),

      // Design files
      supabaseAdmin
        .from('design_files')
        .select('id, project_id, file_name, file_url, file_type, version_number, approval_status, is_frozen, created_at, uploaded_by, project:projects(id, title)')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
    ]);

    const updates = updatesRes.data || [];
    const attendance = attendanceRes.data || [];
    const allProjects = projectsRes.data || [];
    const projectMembers = projectMembersRes.data || [];
    const snags = snagsRes.data || [];
    const designFiles = designFilesRes.data || [];

    // Helper map of project members
    const userProjectIdsMap: Record<string, Set<string>> = {};
    projectMembers.forEach((pm: any) => {
      if (!userProjectIdsMap[pm.user_id]) userProjectIdsMap[pm.user_id] = new Set();
      userProjectIdsMap[pm.user_id].add(pm.project_id);
    });

    // 3. Aggregate per user
    const userReports = targetUsers.map((user: any) => {
      const engineer = isSiteEngineer(user);
      const designer = isDesigner(user);
      const memberRoleType = engineer ? 'site_engineer' : designer ? 'designer' : 'other';

      // Updates logged by this user
      const userUpdates = updates.filter((u: any) => u.user_id === user.id);
      const totalPhotos = userUpdates.reduce((sum: number, u: any) => sum + (Array.isArray(u.photos) ? u.photos.length : 0), 0);

      // Attendance records for this user
      const userAttendance = attendance.filter((a: any) => a.user_id === user.id);
      const presentDays = userAttendance.filter((a: any) => a.status === 'present' || a.punch_in_time).length;

      // Active projects assigned to this user
      const userAssignedProjects = allProjects.filter((p: any) => {
        const isAssigned = p.designer_id === user.id ||
          p.assigned_employee_id === user.id ||
          p.site_supervisor_id === user.id ||
          userProjectIdsMap[user.id]?.has(p.id);
        return isAssigned && p.status !== 'completed' && p.status !== 'cancelled';
      });

      // Snags handled or created
      const userSnags = snags.filter((s: any) => s.assigned_to_user_id === user.id || s.created_by === user.id);
      const snagsResolved = userSnags.filter((s: any) => s.status === 'resolved' || s.status === 'verified').length;

      // Design files (for designers)
      const userDesigns = designFiles.filter((d: any) => d.uploaded_by === user.id);
      const designsFrozen = userDesigns.filter((d: any) => d.is_frozen).length;

      return {
        user: {
          id: user.id,
          name: user.full_name || 'Unnamed Staff',
          email: user.email,
          designation: user.designation || (engineer ? 'Site Engineer' : designer ? 'Interior Designer' : 'Staff'),
          role: user.role,
          phone: user.phone_number,
          type: memberRoleType
        },
        metrics: {
          totalUpdates: userUpdates.length,
          totalPhotos,
          activeProjectsCount: userAssignedProjects.length,
          attendanceDays: presentDays,
          snagsTotal: userSnags.length,
          snagsResolved,
          designsUploaded: userDesigns.length,
          designsFrozen
        },
        activeProjects: userAssignedProjects.map((p: any) => ({
          id: p.id,
          title: p.title,
          customer_name: p.customer_name,
          status: p.status,
          workflow_stage: p.workflow_stage,
          unified_status: p.unified_status,
          project_notes: p.project_notes,
          deadline: p.deadline,
          estimated_completion_date: p.estimated_completion_date
        })),
        updates: userUpdates.map((u: any) => ({
          id: u.id,
          project_id: u.project_id,
          project_title: (u.project as any)?.title || 'Unnamed Project',
          customer_name: (u.project as any)?.customer_name || '',
          update_date: u.update_date || u.created_at,
          created_at: u.created_at,
          description: u.description,
          photosCount: Array.isArray(u.photos) ? u.photos.length : 0,
          photos: Array.isArray(u.photos) ? u.photos.slice(0, 4) : []
        })),
        attendance: userAttendance,
        designs: userDesigns.map((d: any) => ({
          id: d.id,
          project_title: (d.project as any)?.title || 'Project',
          file_name: d.file_name,
          file_type: d.file_type,
          version: d.version_number,
          approval_status: d.approval_status,
          is_frozen: d.is_frozen,
          created_at: d.created_at
        }))
      };
    });

    // 4. Executive Summary Totals
    const summary = {
      totalUpdates: userReports.reduce((s: number, u: any) => s + u.metrics.totalUpdates, 0),
      totalPhotos: userReports.reduce((s: number, u: any) => s + u.metrics.totalPhotos, 0),
      activeProjectsCount: new Set(userReports.flatMap((u: any) => u.activeProjects.map((p: any) => p.id))).size,
      totalSnagsResolved: userReports.reduce((s: number, u: any) => s + u.metrics.snagsResolved, 0),
      totalAttendanceDays: userReports.reduce((s: number, u: any) => s + u.metrics.attendanceDays, 0),
      totalDesignsUploaded: userReports.reduce((s: number, u: any) => s + u.metrics.designsUploaded, 0),
      totalDesignsFrozen: userReports.reduce((s: number, u: any) => s + u.metrics.designsFrozen, 0)
    };

    return NextResponse.json({
      period: { startDate, endDate },
      summary,
      users: userReports,
      availableUsers: allUsers?.filter((u: any) => isSiteEngineer(u) || isDesigner(u)).map((u: any) => ({
        id: u.id,
        name: u.full_name || u.email,
        designation: u.designation,
        type: isSiteEngineer(u) ? 'site_engineer' : 'designer'
      })) || []
    });

  } catch (error: any) {
    console.error('Error generating reports:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
