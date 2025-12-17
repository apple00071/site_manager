import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/rbac/roles/[id]/permissions - Get permissions for a role
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleId = params.id;

        const { data: rolePermissions, error } = await supabaseAdmin
            .from('role_permissions')
            .select(`
                permission_id,
                permissions (*)
            `)
            .eq('role_id', roleId);

        if (error) throw error;

        const permissions = rolePermissions?.map((rp: any) => rp.permissions) || [];

        return NextResponse.json({ permissions });
    } catch (error: any) {
        console.error('Error fetching role permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/rbac/roles/[id]/permissions - Update permissions for a role
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const roleId = params.id;
        const { permission_ids } = await request.json();

        // Check if role is system role
        const { data: existingRole } = await supabaseAdmin
            .from('roles')
            .select('is_system')
            .eq('id', roleId)
            .single();

        if (existingRole?.is_system) {
            return NextResponse.json({ error: 'Cannot edit permissions for system roles' }, { status: 403 });
        }

        // Delete existing permissions
        await supabaseAdmin
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId);

        // Insert new permissions
        if (permission_ids && permission_ids.length > 0) {
            const rolePermissions = permission_ids.map((permission_id: string) => ({
                role_id: roleId,
                permission_id
            }));

            const { error: insertError } = await supabaseAdmin
                .from('role_permissions')
                .insert(rolePermissions);

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating role permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
