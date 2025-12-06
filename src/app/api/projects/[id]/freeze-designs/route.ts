import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/freeze-designs
 * Freeze all designs in a project (prevents uploads/modifications)
 * RBAC: admin or project_manager only
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const userId = user.id;

        // Get user role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // RBAC: Only admin or project_manager can freeze
        if (!['admin', 'project_manager'].includes(userData.role)) {
            return NextResponse.json(
                { error: 'Forbidden: Only admins and project managers can freeze designs' },
                { status: 403 }
            );
        }

        // Check project exists
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('id, title')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Freeze all designs in the project
        const { data: frozenDesigns, error: freezeError } = await supabaseAdmin
            .from('design_files')
            .update({
                is_frozen: true,
                frozen_at: new Date().toISOString(),
                frozen_by: userId,
            })
            .eq('project_id', projectId)
            .select('id');

        if (freezeError) {
            console.error('Error freezing designs:', freezeError);
            return NextResponse.json(
                { error: 'Failed to freeze designs' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Designs frozen successfully',
            frozen_count: frozenDesigns?.length || 0,
            project_id: projectId,
        });
    } catch (error) {
        console.error('Unexpected error freezing designs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[id]/freeze-designs
 * Unfreeze all designs in a project (allow uploads/modifications again)
 * RBAC: admin or project_manager only
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const userId = user.id;

        // Get user role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // RBAC: Only admin or project_manager can unfreeze
        if (!['admin', 'project_manager'].includes(userData.role)) {
            return NextResponse.json(
                { error: 'Forbidden: Only admins and project managers can unfreeze designs' },
                { status: 403 }
            );
        }

        // Unfreeze all designs in the project
        const { data: unfrozenDesigns, error: unfreezeError } = await supabaseAdmin
            .from('design_files')
            .update({
                is_frozen: false,
                frozen_at: null,
                frozen_by: null,
            })
            .eq('project_id', projectId)
            .select('id');

        if (unfreezeError) {
            console.error('Error unfreezing designs:', unfreezeError);
            return NextResponse.json(
                { error: 'Failed to unfreeze designs' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Designs unfrozen successfully',
            unfrozen_count: unfrozenDesigns?.length || 0,
            project_id: projectId,
        });
    } catch (error) {
        console.error('Unexpected error unfreezing designs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/projects/[id]/freeze-designs
 * Get freeze status for project designs
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

        const projectId = params.id;

        // Get freeze status
        const { data: designs, error } = await supabaseAdmin
            .from('design_files')
            .select('is_frozen, frozen_at, frozen_by')
            .eq('project_id', projectId)
            .limit(1);

        if (error) {
            console.error('Error getting freeze status:', error);
            return NextResponse.json(
                { error: 'Failed to get freeze status' },
                { status: 500 }
            );
        }

        const isFrozen = designs?.[0]?.is_frozen || false;

        return NextResponse.json({
            is_frozen: isFrozen,
            frozen_at: designs?.[0]?.frozen_at || null,
            frozen_by: designs?.[0]?.frozen_by || null,
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
