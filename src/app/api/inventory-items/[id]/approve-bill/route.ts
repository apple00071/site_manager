import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper to get current authenticated user
 */
async function getCurrentUser(request: NextRequest) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.user) {
    return { user: null, error: 'Unauthorized' };
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (userError || !userData) {
    return { user: null, error: 'User not found' };
  }

  return { user: userData, error: null };
}

/**
 * POST /api/inventory-items/[id]/approve-bill
 * Approve inventory bill
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can approve bills
    if (user.role !== 'admin') {
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

        try {
          const { data: uploader } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', item.created_by_user.id)
            .single();
          if (uploader?.phone_number) {
            await sendCustomWhatsAppNotification(
              uploader.phone_number,
              `✅ Bill Approved\n\nYour bill for "${item.item_name}" in project "${item.project.title}" has been approved.`
            );
          }
        } catch (_) {}
      } catch (notificationError) {
        // Log but don't fail the request if notification fails
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

