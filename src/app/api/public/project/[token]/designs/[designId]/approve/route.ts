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
        const { action, comments } = body; // action: 'approved' | 'needs_changes' | 'rejected'

        if (!['approved', 'needs_changes', 'rejected'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // 1. Validate Access Token
        const { data: access, error: accessError } = await supabaseAdmin
            .from('project_client_access')
            .select('project_id, is_active')
            .eq('token', token)
            .maybeSingle();

        if (accessError || !access || !access.is_active) {
            return NextResponse.json({ error: 'Access denied' }, { status: 401 });
        }

        // 2. Fetch Design and Project
        const { data: design, error: designError } = await supabaseAdmin
            .from('design_files')
            .select('*, projects!inner(*)')
            .eq('id', designId)
            .eq('project_id', access.project_id)
            .single();

        if (designError || !design) {
            return NextResponse.json({ error: 'Design file not found' }, { status: 404 });
        }

        // 3. Update Design Status
        const statusMap = {
            'approved': 'approved',
            'needs_changes': 'needs_changes',
            'rejected': 'rejected'
        };

        const { error: updateError } = await supabaseAdmin
            .from('design_files')
            .update({ 
                approval_status: statusMap[action as keyof typeof statusMap],
                approved_at: action === 'approved' ? new Date().toISOString() : null,
                admin_comments: comments ? `Client Feedback: ${comments}` : null
            })
            .eq('id', designId);

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

        // 4. Log to Project Timeline
        // We need a fallback user_id for the NOT NULL constraint on project_updates.
        // We'll use the project's assigned employee or an admin.
        const technicalUserId = design.projects.assigned_employee_id || 
                               '00000000-0000-0000-0000-000000000000'; // Default fallback

        await supabaseAdmin.from('project_updates').insert({
            project_id: access.project_id,
            user_id: technicalUserId,
            description: `Client ${action === 'approved' ? 'APPROVED' : action === 'rejected' ? 'REJECTED' : 'REQUESTED CHANGES'} for design: ${design.file_name}${comments ? `\n\nFeedback: ${comments}` : ''}`,
            update_date: new Date().toISOString().split('T')[0],
            sender_name: 'Client (via Portal)'
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Portal Design Action Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
