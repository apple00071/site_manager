import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; designId: string }> }
) {
    try {
        const { token, designId } = await params;
        const body = await request.json();
        const { comment, x_percent, y_percent, page_number } = body;

        if (!comment) {
            return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
        }

        // 1. Validate Access Token or Session
        let projectId = '';
        let userId = '00000000-0000-0000-0000-000000000000'; // Default fallback

        if (token === 'secure') {
            // Authenticated Portal Mode
            const { getAuthUser } = await import('@/lib/supabase-server');
            const { user, error: authError } = await getAuthUser();

            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
            }

            userId = user.id;

            // Verify project access for authenticated user (portal_user_id link)
            const { data: project, error: pError } = await supabaseAdmin
                .from('projects')
                .select('id')
                .eq('portal_user_id', user.id)
                .maybeSingle();

            if (pError || !project) {
                return NextResponse.json({ error: 'Project access denied' }, { status: 403 });
            }
            
            projectId = project.id;
        } else {
            // Public Link Mode
            const { data: access, error: accessError } = await supabaseAdmin
                .from('project_client_access')
                .select('project_id, is_active')
                .eq('token', token)
                .maybeSingle();

            if (accessError || !access || !access.is_active) {
                return NextResponse.json({ error: 'Access denied' }, { status: 401 });
            }
            
            projectId = access.project_id;
            
            // Fetch Project Owner as Fallback User ID
            const { data: pro, error: proError } = await supabaseAdmin
                .from('projects')
                .select('assigned_employee_id')
                .eq('id', projectId)
                .single();
            
            userId = pro?.assigned_employee_id || userId;
        }

        // 2. Fetch Project Owner as Fallback User ID (only if userId is still default)
        if (userId === '00000000-0000-0000-0000-000000000000') {
            const { data: fallbackProj, error: fallbackError } = await supabaseAdmin
                .from('projects')
                .select('assigned_employee_id')
                .eq('id', projectId)
                .single();

            if (!fallbackError && fallbackProj?.assigned_employee_id) {
                userId = fallbackProj.assigned_employee_id;
            }
        }

        // 3. Insert Comment
        const { error: commentError } = await supabaseAdmin
            .from('design_comments')
            .insert({
                design_file_id: designId,
                user_id: userId, // Use the authenticated user ID or fallback
                comment: comment, // Remove the suffix for a cleaner look
                x_percent: x_percent || null,
                y_percent: y_percent || null,
                page_number: page_number || 1
            });

        if (commentError) return NextResponse.json({ error: commentError.message }, { status: 500 });

        // 4. Update Design Status to Needs Changes
        await supabaseAdmin
            .from('design_files')
            .update({ approval_status: 'needs_changes' })
            .eq('id', designId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Portal Design Comment Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
