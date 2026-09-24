import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rbac/user-permissions
 * Returns the current user's permissions based on their role.
 * Response format: { permissions: { "projects.view": true, "projects.edit": true, ... } }
 */
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role, role_id, and designation from the users table
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, role_id, designation, roles(name)')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const roleName = (userData.roles as any)?.name || userData.role || '';
        const designation = userData.designation || '';

        // Admin users have all permissions (check role string or roles table name)
        const isAdmin = 
            userData.role?.toLowerCase() === 'admin' || 
            (userData.roles as any)?.name?.toLowerCase() === 'admin';

        if (isAdmin) {
            return NextResponse.json({
                permissions: { '*': true },
                isAdmin: true,
                roleName,
                designation,
            });
        }

        // If user has no role_id, they have no granular permissions
        if (!userData.role_id) {
            return NextResponse.json({
                permissions: {},
                isAdmin: false,
                roleName,
                designation,
            });
        }

        // Fetch permissions for the user's role
        const { data: rolePermissions, error: permError } = await supabaseAdmin
            .from('role_permissions')
            .select(`
                permissions (
                    id,
                    code,
                    module
                )
            `)
            .eq('role_id', userData.role_id);

        if (permError) {
            console.error('Error fetching role permissions:', permError);
            return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
        }

        // Convert to a map for easy client-side checking
        const permissionsMap: Record<string, boolean> = {};
        rolePermissions?.forEach((rp: any) => {
            if (rp.permissions?.code) {
                permissionsMap[rp.permissions.code] = true;
            }
        });

        return NextResponse.json({
            permissions: permissionsMap,
            isAdmin: false,
            roleName,
            designation,
        });

    } catch (error: any) {
        console.error('Error fetching user permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
