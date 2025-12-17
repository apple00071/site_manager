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
