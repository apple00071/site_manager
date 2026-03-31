import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string, designId: string }> }
) {
    try {
        const { id: projectId, designId } = await params;
        const { user, error: authError, role } = await getAuthUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check project access
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('portal_user_id')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'admin' && project.portal_user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { action, comments } = await request.json();

        // Update design status
        const { error: updateError } = await supabaseAdmin
            .from('design_files')
            .update({ 
                approval_status: action,
                admin_comments: comments, // Repurposing column or adding client_comments
                approved_at: action === 'approved' ? new Date().toISOString() : null
            })
            .eq('id', designId)
            .eq('project_id', projectId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
