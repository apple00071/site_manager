import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

        // Only admins can approve/reject
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Only admins can approve/reject items' }, { status: 403 });
        }

        const { id } = params;
        const { action, reason } = await request.json();

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const updateData: any = {
            bill_approval_status: action === 'approve' ? 'approved' : 'rejected'
        };

        if (action === 'reject') {
            updateData.bill_rejection_reason = reason;
            updateData.is_bill_resubmission = false; // Reset this flag on rejection until they resubmit
        }

        const { data: item, error } = await supabaseAdmin
            .from('inventory_items')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating approval status:', error);
            return NextResponse.json({ error: 'Failed to update approval status' }, { status: 500 });
        }

        return NextResponse.json({ item });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
