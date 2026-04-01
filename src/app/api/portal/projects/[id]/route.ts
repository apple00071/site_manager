import { supabaseAdmin } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseAdmin;
  const { id } = await params;

  try {
    // 1. Fetch Project Main Data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError || !project) {
        console.error('Project fetch error (plural):', projectError);
        return NextResponse.json({ error: projectError?.message || 'Project not found' }, { status: 404 });
    }

    // 2. Fetch User Details for Designer and Site Engineer Manual Fetch
    const userIds = [project.designer_id, project.site_engineer_id].filter(Boolean);
    let userData: any[] = [];
    if (userIds.length > 0) {
        const { data } = await supabase
            .from('users')
            .select('id, full_name, role')
            .in('id', userIds);
        userData = data || [];
    }

    const designer = userData.find((u: any) => u.id === project.designer_id);
    const siteEngineer = userData.find((u: any) => u.id === project.site_engineer_id);

    // 3. Fetch Updates and Designs in Parallel
    const [updatesRes, designsRes] = await Promise.all([
      // Site Updates
      supabase
        .from('project_updates')
        .select(`
            id,
            project_id,
            description,
            update_date,
            photos,
            audio_url,
            author:user_id(full_name)
        `)
        .eq('project_id', id)
        .order('update_date', { ascending: false }),

      // Design Files
      supabase
        .from('design_files')
        .select(`
            id,
            project_id,
            file_name,
            file_url,
            version_number,
            approval_status,
            category,
            created_at,
            uploaded_by
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
    ]);

    const { data: updates, error: updatesError } = updatesRes;
    const { data: designs, error: designsError } = designsRes;

    // Fetch Uploaders for designs manually too
    const uploaderIds = designs?.map((d: any) => d.uploaded_by).filter(Boolean) || [];
    let uploaderData: any[] = [];
    if (uploaderIds.length > 0) {
        const { data } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', uploaderIds);
        uploaderData = data || [];
    }

    const designsWithUploaders = designs?.map((d: any) => ({
        ...d,
        uploaded_by_user: uploaderData.find((u: any) => u.id === d.uploaded_by)
    })) || [];

    return NextResponse.json({
      ...project,
      project: {
        ...project,
        designer,
        siteEngineer
      },
      updates: updates || [],
      designs: designsWithUploaders,
      photos: updates?.filter((u: any) => u.photos && u.photos.length > 0) || [],
      siteEngineer: siteEngineer, // For compatibility
      designer: designer // For compatibility
    });
  } catch (error: any) {
    console.error('Portal project API error (plural):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
