import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NotificationService } from '@/lib/notificationService';

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
 * POST /api/inventory-items/[id]/resubmit-bill
 * Resubmit a rejected bill with a new bill URL
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

    const { id: itemId } = await params;
    const body = await request.json();
    const { bill_url } = body;

    if (!bill_url) {
      return NextResponse.json({ error: 'bill_url is required' }, { status: 400 });
    }

    // Get inventory item details
    const { data: item, error: itemError } = await supabaseAdmin
      .from('inventory_items')
      .select('*, project:projects(id, title, created_by), created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Check if item is rejected
    if (item.bill_approval_status !== 'rejected') {
      return NextResponse.json({ error: 'Only rejected bills can be resubmitted' }, { status: 400 });
    }

    // Check if user owns this item or is admin
    if (item.created_by !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only resubmit your own bills' }, { status: 403 });
    }

    // Update bill with new URL and reset status
    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('inventory_items')
      .update({
        bill_url: bill_url,
        bill_approval_status: 'pending',
        bill_resubmitted_from: itemId, // Track original item
        is_bill_resubmission: true,
        bill_rejection_reason: null, // Clear previous rejection reason
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select(`
        *,
        created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error resubmitting bill:', updateError);
      return NextResponse.json({ error: 'Failed to resubmit bill' }, { status: 500 });
    }

    // Create notification for admin/project creator
    if (item.project && item.project.created_by) {
      try {
        await NotificationService.createNotification({
          userId: item.project.created_by,
          type: 'inventory_added',
          title: 'Bill Resubmitted',
          message: `${user.full_name} resubmitted the bill for "${item.item_name}" in project "${item.project.title}"`,
          relatedId: itemId,
          relatedType: 'inventory_item',
        });
      } catch (notificationError) {
        // Log but don't fail the request if notification fails
        console.error('Failed to create notification:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bill resubmitted successfully',
      item: updatedItem,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/inventory-items/[id]/resubmit-bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
