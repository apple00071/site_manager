import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/design-files/[id]/versions
 * Returns version history for a design file
 * Traverses parent_design_id chain to find all versions
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const designId = params.id;

        // Get the current design
        const { data: currentDesign, error: currentError } = await supabaseAdmin
            .from('design_files')
            .select('id, project_id, file_name')
            .eq('id', designId)
            .single();

        if (currentError || !currentDesign) {
            return NextResponse.json({ error: 'Design not found' }, { status: 404 });
        }

        // Get all versions with the same file_name in the same project
        const { data: versions, error: versionsError } = await supabaseAdmin
            .from('design_files')
            .select(`
        id,
        file_name,
        file_url,
        file_type,
        version_number,
        approval_status,
        is_current_approved,
        parent_design_id,
        created_at,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email)
      `)
            .eq('project_id', currentDesign.project_id)
            .eq('file_name', currentDesign.file_name)
            .order('version_number', { ascending: false });

        if (versionsError) {
            console.error('Error fetching versions:', versionsError);
            return NextResponse.json(
                { error: 'Failed to fetch version history' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            current_id: designId,
            file_name: currentDesign.file_name,
            versions: versions || [],
            total_versions: versions?.length || 0,
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
