import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/design-files/[id]/freeze
 * Freeze a single design (prevents modifications)
 * RBAC: admin or project_manager only
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

        const { id: designId } = await params;
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

        // Freeze the design
        const { data: frozenDesign, error: freezeError } = await supabaseAdmin
            .from('design_files')
            .update({
                is_frozen: true,
                frozen_at: new Date().toISOString(),
                frozen_by: userId,
            })
            .eq('id', designId)
            .select('id, file_name')
            .single();

        if (freezeError) {
            console.error('Error freezing design:', freezeError);
            return NextResponse.json(
                { error: 'Failed to freeze design' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Design frozen successfully',
            design: frozenDesign,
        });
    } catch (error) {
        console.error('Unexpected error freezing design:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/design-files/[id]/freeze
 * Unfreeze a single design
 * RBAC: admin or project_manager only
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

        const { id: designId } = await params;
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

        // Unfreeze the design
        const { data: unfrozenDesign, error: unfreezeError } = await supabaseAdmin
            .from('design_files')
            .update({
                is_frozen: false,
                frozen_at: null,
                frozen_by: null,
            })
            .eq('id', designId)
            .select('id, file_name')
            .single();

        if (unfreezeError) {
            console.error('Error unfreezing design:', unfreezeError);
            return NextResponse.json(
                { error: 'Failed to unfreeze design' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Design unfrozen successfully',
            design: unfrozenDesign,
        });
    } catch (error) {
        console.error('Unexpected error unfreezing design:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
