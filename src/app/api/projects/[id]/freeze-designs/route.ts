import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission, PERMISSION_NODES } from '@/lib/rbac';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/freeze-designs
 * Freeze all designs in a project (prevents uploads/modifications)
 * RBAC: Requires design.freeze permission
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;
        const userId = user.id;

        // RBAC: Check design.freeze permission
        const permResult = await verifyPermission(userId, PERMISSION_NODES.DESIGN_FREEZE, projectId);
        if (!permResult.allowed) {
            return NextResponse.json({ error: permResult.message }, { status: 403 });
        }

        // Check project exists
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('id, title')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            console.error('Project lookup error:', projectError, 'projectId:', projectId);
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
 * RBAC: Requires design.freeze permission
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;
        const userId = user.id;

        // RBAC: Check design.freeze permission
        const permResult = await verifyPermission(userId, PERMISSION_NODES.DESIGN_FREEZE, projectId);
        if (!permResult.allowed) {
            return NextResponse.json({ error: permResult.message }, { status: 403 });
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;

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
