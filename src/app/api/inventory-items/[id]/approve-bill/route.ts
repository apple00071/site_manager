import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/inventory-items/[id]/approve-bill
 * Approve inventory bill
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    const isAdmin = userRole === 'admin';
    const permCheck = await verifyPermission(user.id, PERMISSION_NODES.INVENTORY_APPROVE);

    // Only admins or authorized users can approve bills
    if (!isAdmin && !permCheck.allowed) {
      return NextResponse.json({ error: 'Only admins or authorized users can approve bills' }, { status: 403 });
    }

    const { id: itemId } = await params;

    // Get inventory item details
    const { data: item, error: itemError } = await supabaseAdmin
      .from('inventory_items')
      .select('*, project:projects(id, title), created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Update bill approval status
    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('inventory_items')
      .update({
        bill_approval_status: 'approved',
        bill_approved_by: user.id,
        bill_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving bill:', updateError);
      return NextResponse.json({ error: 'Failed to approve bill' }, { status: 500 });
    }

    // Create notification for the person who uploaded the bill
    if (item.created_by_user) {
      try {
        await NotificationService.notifyBillApproved(
          item.created_by_user.id,
          item.item_name,
          item.project.title,
          item.total_cost || 0,
          itemId,
          item.project.id
        );
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bill approved successfully',
      item: updatedItem,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/inventory-items/[id]/approve-bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

