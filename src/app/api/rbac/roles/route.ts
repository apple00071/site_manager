import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/rbac/roles - List all roles for the organization
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgSlug = 'apple-interior';
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const { data: roles, error } = await supabaseAdmin
            .from('roles')
            .select(`
                *,
                role_permissions (
                    permission_id,
                    permissions (*)
                )
            `)
            .eq('org_id', org.id)
            .order('name');

        if (error) throw error;

        // Count users per role
        const { data: userCounts } = await supabaseAdmin
            .from('users')
            .select('role_id')
            .not('role_id', 'is', null);

        const countMap: Record<string, number> = {};
        userCounts?.forEach((u: any) => {
            countMap[u.role_id] = (countMap[u.role_id] || 0) + 1;
        });

        const rolesWithCounts = roles?.map((r: any) => ({
            ...r,
            user_count: countMap[r.id] || 0,
            permissions: r.role_permissions?.map((rp: any) => rp.permissions) || []
        }));

        return NextResponse.json({ roles: rolesWithCounts });
    } catch (error: any) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/rbac/roles - Create a new role
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { name, description, permission_ids } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
        }

        const orgSlug = 'apple-interior';
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Create role
        const { data: newRole, error: roleError } = await supabaseAdmin
            .from('roles')
            .insert({
                org_id: org.id,
                name,
                description,
                is_system: false
            })
            .select()
            .single();

        if (roleError) {
            if (roleError.code === '23505') { // Unique constraint violation
                return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
            }
            throw roleError;
        }

        // Assign permissions
        if (permission_ids && permission_ids.length > 0) {
            const rolePermissions = permission_ids.map((permission_id: string) => ({
                role_id: newRole.id,
                permission_id
            }));

            const { error: permError } = await supabaseAdmin
                .from('role_permissions')
                .insert(rolePermissions);

            if (permError) throw permError;
        }

        return NextResponse.json({ role: newRole }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/rbac/roles/:id - Update a role
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const url = new URL(request.url);
        const roleId = url.searchParams.get('id');
        const { name, description } = await request.json();

        if (!roleId) {
            return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
        }

        // Check if role is system role
        const { data: existingRole } = await supabaseAdmin
            .from('roles')
            .select('is_system')
            .eq('id', roleId)
            .single();

        // Allow editing system roles, but maybe restrict Name changes in frontend if needed.
        // For backend, we trust the Admin to know what they are doing.
        // if (existingRole?.is_system) {
        //     return NextResponse.json({ error: 'Cannot edit system roles' }, { status: 403 });
        // }

        const { data: updatedRole, error } = await supabaseAdmin
            .from('roles')
            .update({ name, description, updated_at: new Date().toISOString() })
            .eq('id', roleId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ role: updatedRole });
    } catch (error: any) {
        console.error('Error updating role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/rbac/roles/:id - Delete a role
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const url = new URL(request.url);
        const roleId = url.searchParams.get('id');

        if (!roleId) {
            return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
        }

        // Check if role is system role
        const { data: existingRole } = await supabaseAdmin
            .from('roles')
            .select('is_system')
            .eq('id', roleId)
            .single();

        if (existingRole?.is_system) {
            return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 403 });
        }

        // Check if role is assigned to any users
        const { data: assignedUsers } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('role_id', roleId)
            .limit(1);

        if (assignedUsers && assignedUsers.length > 0) {
            return NextResponse.json({ error: 'Cannot delete role assigned to users' }, { status: 409 });
        }

        const { error } = await supabaseAdmin
            .from('roles')
            .delete()
            .eq('id', roleId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
