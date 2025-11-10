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
 * POST /api/inventory-items/[id]/reject-bill
 * Reject inventory bill and request resubmission
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

    // Only admins can reject bills
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can reject bills' }, { status: 403 });
    }

    const { id: itemId } = await params;
    const body = await request.json();
    const { rejection_reason } = body;

    if (!rejection_reason) {
      return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });
    }

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
        bill_approval_status: 'rejected',
        bill_rejection_reason: rejection_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting bill:', updateError);
      return NextResponse.json({ error: 'Failed to reject bill' }, { status: 500 });
    }

    // Create notification for the person who uploaded the bill
    if (item.created_by_user) {
      await NotificationService.createNotification({
        user_id: item.created_by_user.id,
        type: 'bill_rejected',
        title: 'Bill Rejected',
        message: `Your bill for "${item.item_name}" in project "${item.project.title}" was rejected. Reason: ${rejection_reason}`,
        link: `/dashboard/projects/${item.project_id}`,
        metadata: {
          project_id: item.project_id,
          project_title: item.project.title,
          item_id: itemId,
          item_name: item.item_name,
          rejected_by: user.full_name,
          rejection_reason,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Bill rejected successfully',
      item: updatedItem,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/inventory-items/[id]/reject-bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

