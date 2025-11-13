import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache inventory data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas - quantity is now optional
const createInventoryItemSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  item_name: z.string().min(1, 'Item name is required'),
  quantity: z.number().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  date_purchased: z.string(),
  bill_url: z.string().url('Invalid bill URL').optional(),
  total_cost: z.number().min(0, 'Total cost must be positive'),
});

const updateInventoryItemSchema = z.object({
  id: z.string().uuid('Invalid item ID'),
  item_name: z.string().min(1, 'Item name is required').optional(),
  quantity: z.number().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required').optional(),
  date_purchased: z.string().optional(),
  bill_url: z.string().url('Invalid bill URL').optional(),
  total_cost: z.number().min(0, 'Total cost must be positive').optional(),
});

// Helper function to get current user from session
async function getCurrentUser(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('Session error:', error);
      return { user: null, error: error?.message || 'No session found' };
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return { user: null, error: userError?.message || 'User not found' };
    }

    console.log('User authenticated:', user.email);
    return { user, error: null };
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return { user: null, error: error.message };
  }
}

// GET - Fetch inventory items
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
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
        bill_url,
        created_by,
        created_at,
        bill_approval_status,
        bill_rejection_reason,
        is_bill_resubmission,
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
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createInventoryItemSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, item_name, quantity, supplier_name, date_purchased, bill_url, total_cost } = parsed.data;

    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        project_id,
        item_name,
        quantity,
        supplier_name,
        date_purchased,
        bill_url,
        total_cost,
        created_by: user.id,
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

    // Notify admin of new inventory item
    try {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('created_by, title')
        .eq('id', project_id)
        .single();

      if (projectData && projectData.created_by !== user.id) {
        const quantityText = quantity ? ` (${quantity})` : '';
        await NotificationService.createNotification({
          userId: projectData.created_by,
          title: 'New Inventory Item Added',
          message: `${user.full_name} added "${item_name}"${quantityText} to project "${projectData.title}"`,
          type: 'inventory_added',
          relatedId: project_id,
          relatedType: 'project'
        });
        console.log('Inventory notification sent to admin:', projectData.created_by);
      }
    } catch (notificationError) {
      console.error('Failed to send inventory notification:', notificationError);
      // Don't fail the main operation if notification fails
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
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateInventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

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
    if (existingItem.created_by !== user.id && user.role !== 'admin') {
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
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (existingItem.created_by !== user.id && user.role !== 'admin') {
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

