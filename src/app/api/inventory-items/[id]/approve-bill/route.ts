import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser } from '@/lib/supabase-server';

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

    // Only admins can approve bills
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can approve bills' }, { status: 403 });
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
        await NotificationService.createNotification({
          userId: item.created_by_user.id,
          type: 'bill_approved',
          title: 'Bill Approved',
          message: `Your bill for "${item.item_name}" in project "${item.project.title}" has been approved.`,
          relatedId: itemId,
          relatedType: 'inventory_item',
        });
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

