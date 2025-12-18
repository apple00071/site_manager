import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { PERMISSION_NODES } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync-permissions
 * Syncs the permission nodes defined in code to the database.
 * Also ensures the Admin role has all permissions.
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get the organization
        const orgSlug = 'apple-interior';
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Get all current permissions
        const { data: existingPermissions } = await supabaseAdmin
            .from('permissions')
            .select('id, code');

        const existingCodes = new Set(existingPermissions?.map((p: { id: string; code: string }) => p.code) || []);

        // Insert missing permissions
        const permissionValues = Object.values(PERMISSION_NODES);
        const newPermissions = permissionValues.filter(code => !existingCodes.has(code));

        let insertedCount = 0;
        if (newPermissions.length > 0) {
            const toInsert = newPermissions.map(code => ({
                code,
                module: code.split('.')[0],
                action: code.split('.')[1] || code, // Extract action from code (e.g., 'view_budget' from 'projects.view_budget')
                description: `Permission: ${code}`
            }));

            const { data: inserted, error: insertError } = await supabaseAdmin
                .from('permissions')
                .insert(toInsert)
                .select();

            if (insertError) {
                console.error('Error inserting permissions:', insertError);
                return NextResponse.json({ error: 'Failed to insert permissions' }, { status: 500 });
            }

            insertedCount = inserted?.length || 0;
        }

        // Get Admin role
        const { data: adminRole } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'Admin')
            .single();

        let adminUpdated = false;
        if (adminRole) {
            // Get all permissions
            const { data: allPermissions } = await supabaseAdmin
                .from('permissions')
                .select('id');

            if (allPermissions && allPermissions.length > 0) {
                // Clear existing role_permissions for admin
                await supabaseAdmin
                    .from('role_permissions')
                    .delete()
                    .eq('role_id', adminRole.id);

                // Insert all permissions for admin
                const adminPerms = allPermissions.map((p: { id: string }) => ({
                    role_id: adminRole.id,
                    permission_id: p.id
                }));

                const { error: adminPermError } = await supabaseAdmin
                    .from('role_permissions')
                    .insert(adminPerms);

                if (!adminPermError) {
                    adminUpdated = true;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced permissions. Added ${insertedCount} new permissions.`,
            total_permissions: permissionValues.length,
            new_permissions: newPermissions,
            admin_role_updated: adminUpdated
        });

    } catch (error: any) {
        console.error('Sync permissions error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/admin/sync-permissions
 * Returns current sync status.
 */
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

        const { data: permissions } = await supabaseAdmin
            .from('permissions')
            .select('code');

        const dbCodes = new Set(permissions?.map((p: { code: string }) => p.code) || []);
        const codeCodes = Object.values(PERMISSION_NODES);

        const missing = codeCodes.filter(c => !dbCodes.has(c));
        const extra = Array.from(dbCodes).filter(c => !codeCodes.includes(c as any));

        return NextResponse.json({
            total_in_code: codeCodes.length,
            total_in_db: dbCodes.size,
            missing_in_db: missing,
            extra_in_db: extra,
            in_sync: missing.length === 0
        });

    } catch (error: any) {
        console.error('Check permissions error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
