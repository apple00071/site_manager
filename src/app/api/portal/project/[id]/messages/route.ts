import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST: Create a new message from the client portal.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { user, error: authError, role } = await getAuthUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if the user is authorized for this project
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('portal_user_id, customer_name')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'admin' && project.portal_user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { message, photos, audio_url } = await request.json();

        // 3. Insert into project_updates
        const { data: update, error: insertError } = await supabaseAdmin
            .from('project_updates')
            .insert({
                project_id: projectId,
                user_id: user.id, // Logged in user id
                description: message || (audio_url ? 'Voice note' : 'Photos'),
                update_date: new Date().toISOString().split('T')[0],
                sender_name: project.customer_name || 'Client',
                photos: photos || [],
                audio_url: audio_url || null
            })
            .select()
            .single();

        if (insertError) {
            console.error('Portal Msg Insert Error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, update });
    } catch (err) {
        console.error('Portal Messaging Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
