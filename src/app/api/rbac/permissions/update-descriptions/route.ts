import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/rbac/permissions/update-descriptions - Update inventory permission descriptions to expenses
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const userRole = user.user_metadata?.role || user.app_metadata?.role || 'employee';
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Only admins can update permissions' }, { status: 403 });
        }

        // Update inventory permission descriptions to use "expenses" terminology
        const updates = [
            { code: 'inventory.view', newDescription: 'View expenses' },
            { code: 'inventory.add', newDescription: 'Add expense items' },
            { code: 'inventory.approve', newDescription: 'Approve expenses' },
            { code: 'inventory.approve_bill', newDescription: 'Approve expense bills' },
            { code: 'inventory.reject_bill', newDescription: 'Reject expense bills' },
            { code: 'inventory.resubmit_bill', newDescription: 'Resubmit expense bills' },
        ];

        let updated = 0;
        for (const update of updates) {
            const { error } = await supabaseAdmin
                .from('permissions')
                .update({ description: update.newDescription })
                .eq('code', update.code);

            if (!error) updated++;
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updated} permission descriptions to use "expenses" terminology`
        });
    } catch (error: any) {
        console.error('Error updating permission descriptions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
