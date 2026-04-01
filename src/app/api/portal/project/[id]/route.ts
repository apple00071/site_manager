import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch project details for a logged-in client.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { user, error: authError, role } = await getAuthUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Project Main Data (and check ownership)
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (projectError || !project) {
            console.error('Project fetch error:', projectError);
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Auth check
        if (role !== 'admin' && project.portal_user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden. You do not have access to this project.' }, { status: 403 });
        }

        // 2. Fetch User Details for Designer and Site Engineer (Manual step since FK might be missing)
        const userIds = [project.designer_id, project.site_engineer_id].filter(Boolean);
        let userData: any[] = [];
        if (userIds.length > 0) {
            const { data } = await supabaseAdmin
                .from('users')
                .select('id, full_name, role')
                .in('id', userIds);
            userData = data || [];
        }

        const designer = userData.find(u => u.id === project.designer_id);
        const siteEngineer = userData.find(u => u.id === project.site_engineer_id);

        // 3. Fetch Updates and Designs in Parallel
        const [updatesRes, designsRes] = await Promise.all([
            // Site Updates
            supabaseAdmin
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
            supabaseAdmin
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
                    uploaded_by,
                    comments:design_comments(
                        id,
                        comment,
                        x_percent,
                        y_percent,
                        linked_task_id,
                        is_resolved,
                        page_number,
                        zoom_level,
                        created_at,
                        user:user_id(id, full_name, email)
                    )
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
            const { data } = await supabaseAdmin
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
            project: {
                ...project,
                designer,
                siteEngineer
            },
            photos: updates?.filter((u: any) => u.photos && u.photos.length > 0) || [],
            designs: designsWithUploaders,
            updates: updates || [],
            siteEngineer: siteEngineer, // Compatibility
            designer: designer // Compatibility
        });
    } catch (err: any) {
        console.error('Portal Auth API Error:', err);
        return NextResponse.json({ 
            error: 'Internal server error', 
            details: err.message
        }, { status: 500 });
    }
}
