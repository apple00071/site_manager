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

        // Check if the user is the assigned client for this project
        const { data: projectCheck, error: checkError } = await supabaseAdmin
            .from('projects')
            .select('portal_user_id')
            .eq('id', id)
            .maybeSingle();

        if (checkError || !projectCheck) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'admin' && projectCheck.portal_user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden. You do not have access to this project.' }, { status: 403 });
        }

        // 2. Fetch Project Details with Site Engineer & Designer
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select(`
                *,
                designer:designer_id(id, full_name, role),
                siteEngineer:assigned_employee_id(id, full_name, role)
            `)
            .eq('id', id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project data issues' }, { status: 500 });
        }

        // 3. Fetch Site Updates with Employee Names
        const { data: updates, error: updatesError } = await supabaseAdmin
            .from('project_updates')
            .select(`
                *,
                author:user_id(full_name)
            `)
            .eq('project_id', id)
            .order('update_date', { ascending: false });

        // 4. Fetch Design Files with comments and authors
        const { data: designs, error: designsError } = await supabaseAdmin
            .from('design_files')
            .select(`
                *,
                uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
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
                    user:users!design_comments_user_id_fkey(id, full_name, email)
                )
            `)
            .eq('project_id', id)
            .order('created_at', { ascending: false });

        return NextResponse.json({
            project,
            photos: updates?.filter((u: any) => u.photos && u.photos.length > 0) || [],
            designs: designs || [],
            updates: updates || []
        });
    } catch (err) {
        console.error('Portal Auth API Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
