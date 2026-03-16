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
