import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;

    // Check if user is assigned to the project
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    // Check if user is a project member
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

    return !!data;
}

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const projectId = request.nextUrl.searchParams.get('project_id');
        if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

        // Check project access
        const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('progress_reports')
            .select(`
                *,
                creator:users!progress_reports_created_by_fkey(full_name, email),
                viewpoint_photos:report_viewpoint_photos(*)
            `)
            .eq('project_id', projectId)
            .order('report_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ reports: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { viewpoints, project_id, ...data } = body;

        if (!project_id) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        // Check project access
        const hasAccess = await checkProjectAccess(user.id, project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data: report, error } = await supabaseAdmin
            .from('progress_reports')
            .insert({
                ...data,
                project_id,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // If viewpoints provided, insert them
        if (viewpoints && Array.isArray(viewpoints) && viewpoints.length > 0) {
            const vpPhotos = viewpoints.map(vp => ({
                report_id: report.id,
                viewpoint_id: vp.viewpoint_id,
                photo_url: vp.photo_url
            }));
            await supabaseAdmin.from('report_viewpoint_photos').insert(vpPhotos);
        }

        return NextResponse.json({ report }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, viewpoints, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
        }

        // Get existing report to check access
        const { data: existing } = await supabaseAdmin
            .from('progress_reports')
            .select('project_id, created_by')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        // Check project access
        const hasAccess = await checkProjectAccess(user.id, existing.project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data: report, error } = await supabaseAdmin
            .from('progress_reports')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ report });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
        }

        // Get existing report to check access
        const { data: existing } = await supabaseAdmin
            .from('progress_reports')
            .select('project_id, created_by')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        // Only allow deletion if user is the creator or is an admin
        if (existing.created_by !== user.id && role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: You can only delete your own reports' }, { status: 403 });
        }

        // Delete viewpoint photos first (foreign key constraint)
        await supabaseAdmin
            .from('report_viewpoint_photos')
            .delete()
            .eq('report_id', id);

        // Delete the report
        const { error } = await supabaseAdmin
            .from('progress_reports')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
