import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationService';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

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

        const isAdmin = userRole === 'admin';
        const permCheck = await verifyPermission(user.id, PERMISSION_NODES.INVENTORY_APPROVE);

        // Only admins or authorized users can approve/reject
        if (!isAdmin && !permCheck.allowed) {
            return NextResponse.json({ error: 'Forbidden: You lack permission to approve/reject items' }, { status: 403 });
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

        // Notify creator of the bill
        try {
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('title')
                .eq('id', (item as any).project_id)
                .single();

            if (action === 'approve') {
                await NotificationService.notifyBillApproved(
                    (item as any).created_by,
                    (item as any).item_name,
                    project?.title || 'Project',
                    (item as any).total_cost || 0,
                    item.id,
                    (item as any).project_id
                );
            } else {
                await NotificationService.notifyBillRejected(
                    (item as any).created_by,
                    (item as any).item_name,
                    project?.title || 'Project',
                    item.id,
                    (item as any).project_id
                );
            }
        } catch (notifErr) {
            console.error('Approval notification failed:', notifErr);
        }

        return NextResponse.json({ item });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
