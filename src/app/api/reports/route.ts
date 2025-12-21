import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const projectId = request.nextUrl.searchParams.get('project_id');
        if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

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
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { viewpoints, ...data } = body;

        const { data: report, error } = await supabaseAdmin
            .from('progress_reports')
            .insert({
                ...data,
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
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, viewpoints, ...updates } = body;

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
