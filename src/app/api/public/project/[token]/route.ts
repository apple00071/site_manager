import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // 1. Validate Token
        const { data: access, error: aError } = await supabaseAdmin
            .from('project_client_access')
            .select('project_id, is_active, expires_at')
            .eq('token', token)
            .single();

        if (aError || !access) {
            return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
        }

        if (!access.is_active || (access.expires_at && new Date(access.expires_at) < new Date())) {
            return NextResponse.json({ error: 'Link is no longer active' }, { status: 403 });
        }

        // 2. Fetch Project Data (Limited for public view)
        const { data: project, error: pError } = await supabaseAdmin
            .from('projects')
            .select(`
                id,
                title,
                description,
                status,
                start_date,
                estimated_completion_date,
                property_type,
                apartment_name,
                address,
                assigned_employee:users!projects_assigned_employee_id_fkey(id, full_name, phone_number, designation)
            `)
            .eq('id', access.project_id)
            .single();

        if (pError || !project) {
            return NextResponse.json({ error: 'Project data not found' }, { status: 404 });
        }

        // 3. Fetch Site Photos (from Project Updates)
        const { data: updates, error: updatesError } = await supabaseAdmin
            .from('project_updates')
            .select('photos, created_at, description')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false });


        // 4. Fetch Project Team Members (Site Engineer, etc.)
        const { data: members } = await supabaseAdmin
            .from('project_members')
            .select(`
                user_id,
                users:user_id(id, full_name, phone_number, designation)
            `)
            .eq('project_id', project.id);

        // 5. Fetch DPRs (Progress Reports)
        const { data: reports } = await supabaseAdmin
            .from('progress_reports')
            .select('id, report_date, summary, pdf_url')
            .eq('project_id', project.id)
            .eq('status', 'submitted')
            .order('report_date', { ascending: false });

        // Extract team info - find site engineer by designation
        const siteEngineer = members?.find((m: any) =>
            m.users?.designation?.toLowerCase().includes('site engineer') ||
            m.users?.designation?.toLowerCase().includes('engineer')
        )?.users;

        return NextResponse.json({
            project,
            photos: updates?.flatMap((u: { photos: string[] | null }) => u.photos || []) || [],
            reports: reports || [],
            siteEngineer
        });

    } catch (err) {
        console.error('Public Project API Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
