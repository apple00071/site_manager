import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Validate Access Token
    const { data: access, error: accessError } = await supabaseAdmin
      .from('project_client_access')
      .select('project_id, is_active')
      .eq('token', token)
      .maybeSingle();

    if (accessError || !access) {
      return NextResponse.json({ error: 'Access denied. Link might be invalid or expired.' }, { status: 401 });
    }

    if (!access.is_active) {
      return NextResponse.json({ error: 'This link has been deactivated by the administrator.' }, { status: 403 });
    }

    const projectId = access.project_id;

    // 2. Fetch Project Details with Site Engineer & Designer
    const { data: rawProject, error: projectError } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        designer:designer_id(id, full_name, role),
        assigned_employee:assigned_employee_id(id, full_name, role),
        siteSupervisor:site_supervisor_id(id, full_name, role),
        project_members(
          user_id,
          users:user_id(id, full_name, role, designation)
        )
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !rawProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const supervisorMember = Array.isArray(rawProject.project_members)
      ? rawProject.project_members.find((pm: any) => {
          const desig = (pm.users?.designation || '').toLowerCase();
          return desig.includes('site') || desig.includes('supervisor') || desig.includes('engineer');
        })
      : null;

    const resolvedSiteEngineer = rawProject.siteSupervisor || supervisorMember?.users || null;
    const resolvedDesigner = rawProject.designer || rawProject.assigned_employee || null;

    const project = {
      ...rawProject,
      designer: resolvedDesigner,
      siteEngineer: resolvedSiteEngineer
    };

    // 3. Fetch Site Updates with Employee Names
    const { data: updates, error: updatesError } = await supabaseAdmin
      .from('project_updates')
      .select(`
        *,
        author:user_id(full_name)
      `)
      .eq('project_id', projectId)
      .order('update_date', { ascending: false });

    // 4. Fetch Design Files
    const { data: designs, error: designsError } = await supabaseAdmin
      .from('design_files')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    return NextResponse.json({
      project,
      photos: updates?.filter((u: any) => u.photos && u.photos.length > 0) || [],
      designs: designs || [],
      updates: updates || []
    });
  } catch (err) {
    console.error('Portal API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
