import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const { message } = await request.json();

        if (!message || message.trim().length === 0) {
            return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
        }

        // 1. Validate Access Token or Session
        let projectId = '';
        let senderName = 'Client';
        let authUserId: string | null = null;

        if (token === 'secure') {
            // Authenticated Portal Mode
            const { getAuthUser } = await import('@/lib/supabase-server');
            const { user, error: authError } = await getAuthUser();

            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
            }

            authUserId = user.id;

            // Fetch Project linked to this user
            const { data: project, error: pError } = await supabaseAdmin
                .from('projects')
                .select('id, customer_name')
                .eq('portal_user_id', user.id)
                .maybeSingle();

            if (pError || !project) {
                return NextResponse.json({ error: 'Project access denied' }, { status: 403 });
            }
            
            projectId = project.id;
            senderName = project.customer_name || 'Client';
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
            
            // Fetch Project Info for Sender Name
            const { data: project, error: projectError } = await supabaseAdmin
                .from('projects')
                .select('customer_name')
                .eq('id', projectId)
                .single();

            if (!projectError && project) {
                senderName = project.customer_name || 'Client';
            }
        }

        // 3. Insert into project_updates
        const { error: insertError } = await supabaseAdmin
            .from('project_updates')
            .insert({
                project_id: projectId,
                user_id: authUserId, // Set to authenticated user or null
                description: message,
                update_date: new Date().toISOString().split('T')[0],
                sender_name: senderName
            });

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Portal Messaging Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
