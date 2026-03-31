import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET: Find the project assigned to the currently logged in client.
 */
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'client' && role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch the project where this user is the portal_user_id
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, title')
            .eq('portal_user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Portal Project Search Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (project) {
            // Check if portal access is active
            const { data: access } = await supabaseAdmin
                .from('project_client_access')
                .select('is_active')
                .eq('project_id', project.id)
                .maybeSingle();
            
            if (!access || !access.is_active) {
                return NextResponse.json({ error: 'Portal access disabled for this project' }, { status: 403 });
            }
        }

        return NextResponse.json({ project });
    } catch (err) {
        console.error('Unexpected Portal Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
