import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache inventory data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas - quantity, supplier_name, date_purchased and total_cost are now optional
const createInventoryItemSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  item_name: z.string().min(1, 'Item name is required'),
  quantity: z.number().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required').optional(),
  date_purchased: z.string().optional(),
  bill_url: z.string().url('Invalid bill URL').optional(),
  bill_urls: z.array(z.string().url('Invalid bill URL')).optional().default([]),
  total_cost: z.number().min(0, 'Total cost must be positive').optional(),
  po_id: z.string().uuid().optional(), // Added po_id
});

const updateInventoryItemSchema = z.object({
  id: z.string().uuid('Invalid item ID'),
  item_name: z.string().min(1, 'Item name is required').optional(),
  quantity: z.number().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required').optional(),
  date_purchased: z.string().optional(),
  bill_url: z.string().url('Invalid bill URL').optional(),
  bill_urls: z.array(z.string().url('Invalid bill URL')).optional(),
  total_cost: z.number().min(0, 'Total cost must be positive').optional(),
});

// GET - Fetch inventory items
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch inventory items with creator information and bill status
    const { data: items, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        id,
        project_id,
        item_name,
        quantity,
        total_cost,
        supplier_name,
        date_purchased,
        bill_urls,
        created_by,
        created_at,
        bill_approval_status,
        bill_rejection_reason,
        is_bill_resubmission,
        bill_urls,
        created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)
      `)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory items:', error);
      return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new inventory item
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const body = await request.json();
    const parsed = createInventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, item_name, quantity, supplier_name, date_purchased, bill_url, total_cost, po_id } = parsed.data;

    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        project_id,
        item_name,
        quantity,
        supplier_name,
        date_purchased,
        bill_url,
        bill_urls: parsed.data.bill_urls || (bill_url ? [bill_url] : []),
        total_cost,
        created_by: userId,
        bill_approval_status: 'pending', // Default to pending approval
      })
      .select(`
        *,
        created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating inventory item:', error);
      return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 });
    }

    // Update PO status if po_id is provided
    if (po_id) {
      const { error: poError } = await supabaseAdmin
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', po_id);

      if (poError) {
        console.error('Failed to update PO status:', poError);
        // Non-critical, so we don't return error
      }
    }

    // Notify admin of new inventory item
    try {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('created_by, title')
        .eq('id', project_id)
        .single();

      if (projectData && projectData.created_by !== userId) {
        const quantityText = quantity ? ` (${quantity})` : '';
        await NotificationService.createNotification({
          userId: projectData.created_by,
          title: 'New Inventory Item Added',
          message: `${userFullName} added "${item_name}"${quantityText} to project "${projectData.title}"`,
          type: 'inventory_added',
          relatedId: project_id,
          relatedType: 'project'
        });
      }
    } catch (notificationError) {
      console.error('Failed to send inventory notification:', notificationError);
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update existing inventory item
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    const body = await request.json();
    const parsed = updateInventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    // Ensure bill_urls is handled (if provided in updates)
    if ((updates as any).bill_urls && !(updates as any).bill_url && (updates as any).bill_urls.length > 0) {
      (updates as any).bill_url = (updates as any).bill_urls[0];
    }

    // Check if user owns this item or is admin
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from('inventory_items')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Only allow update if user is the creator or is an admin
    if (existingItem.created_by !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own items' }, { status: 403 });
    }

    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating inventory item:', error);
      return NextResponse.json({ error: 'Failed to update inventory item' }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete inventory item
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Check if user owns this item or is admin
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from('inventory_items')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Only allow deletion if user is the creator or is an admin
    if (existingItem.created_by !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own items' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting inventory item:', error);
      return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

