import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/rbac/permissions - List all available permissions
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: permissions, error } = await supabaseAdmin
            .from('permissions')
            .select('*')
            .order('module')
            .order('action');

        if (error) throw error;

        // Auto-seed missing permissions if not yet present in database
        const hasPopupsView = permissions?.some((p: any) => p.code === 'popups.view');
        const hasPopupsManage = permissions?.some((p: any) => p.code === 'popups.manage');
        const hasDailyStatus = permissions?.some((p: any) => p.code === 'designs.daily_status' || p.code === 'daily_status.view');

        const snagPermDefs = [
            { code: 'snags.view', module: 'snags', action: 'view', description: 'View assigned snags' },
            { code: 'snags.view_all', module: 'snags', action: 'view_all', description: 'View all snags across sites (not just assigned)' },
            { code: 'snags.create', module: 'snags', action: 'create', description: 'Create snags' },
            { code: 'snags.update', module: 'snags', action: 'update', description: 'Update snag details' },
            { code: 'snags.edit', module: 'snags', action: 'edit', description: 'Edit snags' },
            { code: 'snags.resolve', module: 'snags', action: 'resolve', description: 'Resolve snags' },
            { code: 'snags.verify', module: 'snags', action: 'verify', description: 'Verify resolved snags' },
        ];
        const missingSnags = snagPermDefs.filter(sp => !permissions?.some((p: any) => p.code === sp.code));

        if ((!hasPopupsView || !hasPopupsManage || !hasDailyStatus || missingSnags.length > 0) && permissions) {
            try {
                const toInsert: Array<{ code: string; module: string; action: string; description: string }> = [];
                if (!hasPopupsView) {
                    toInsert.push({ code: 'popups.view', module: 'popups', action: 'view', description: 'View popups and recipient history' });
                }
                if (!hasPopupsManage) {
                    toInsert.push({ code: 'popups.manage', module: 'popups', action: 'manage', description: 'Create, toggle, and delete in-app popups' });
                }
                if (!hasDailyStatus) {
                    toInsert.push({ code: 'designs.daily_status', module: 'designs', action: 'daily_status', description: 'View & update daily design status tracker' });
                }
                for (const sp of missingSnags) {
                    toInsert.push(sp);
                }

                if (toInsert.length > 0) {
                    const { data: inserted } = await supabaseAdmin
                        .from('permissions')
                        .upsert(toInsert, { onConflict: 'code' })
                        .select();
                    if (inserted) {
                        permissions.push(...inserted);
                    }
                }
            } catch (seedErr) {
                console.warn('Could not auto-seed missing permissions:', seedErr);
            }
        }

        // Group permissions by module
        const groupedPermissions = permissions?.reduce((acc: any, perm: any) => {
            if (!acc[perm.module]) {
                acc[perm.module] = [];
            }
            acc[perm.module].push(perm);
            return acc;
        }, {});

        return NextResponse.json({
            permissions,
            grouped: groupedPermissions
        });
    } catch (error: any) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/rbac/permissions - Insert a new permission (admin only)
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can insert permissions (check user_metadata same as other routes)
        const userRole = user.user_metadata?.role || user.app_metadata?.role || 'employee';
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { code, name, description, module, action } = body;
        if (!code || !name) {
            return NextResponse.json({ error: 'Missing required fields: code, name' }, { status: 400 });
        }

        // First check if already exists
        const { data: existing } = await supabaseAdmin
            .from('permissions')
            .select('*')
            .eq('code', code)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ permission: existing, already_exists: true });
        }

        // Build the insert object only with known columns
        const insertObj: any = { code };
        if (description) insertObj.description = description;
        if (module) insertObj.module = module;
        if (action) insertObj.action = action;

        const { data, error } = await supabaseAdmin
            .from('permissions')
            .insert(insertObj)
            .select()
            .single();

        if (error) {
            console.error('Permission insert error:', error);
            // Fallback: try with only code and description
            const { data: data2, error: error2 } = await supabaseAdmin
                .from('permissions')
                .insert({ code, description })
                .select()
                .single();
            if (error2) throw error2;
            return NextResponse.json({ permission: data2 });
        }

        return NextResponse.json({ permission: data });
    } catch (error: any) {
        console.error('Error inserting permission:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
