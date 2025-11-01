import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

// Validation schemas
const createInventoryItemSchema = z.object({
  project_id: z.string().uuid(),
  item_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  price_per_unit: z.number().nonnegative(),
  supplier_name: z.string().optional(),
  date_purchased: z.string().optional(), // ISO date string
  bill_url: z.string().optional(),
});

const updateInventoryItemSchema = z.object({
  id: z.string().uuid(),
  item_name: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  price_per_unit: z.number().nonnegative().optional(),
  supplier_name: z.string().optional(),
  date_purchased: z.string().optional(),
  bill_url: z.string().optional(),
});

async function getCurrentUser(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

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

    // Fetch inventory items with creator information
    const { data: items, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        *,
        created_by_user:users!inventory_items_created_by_fkey(id, full_name, email)
      `)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory items:', error);
      return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 });
    }

    // Calculate total cost
    const totalCost = items?.reduce((sum, item) => sum + parseFloat(item.total_cost || '0'), 0) || 0;

    return NextResponse.json({ items, totalCost });
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

    const { project_id, item_name, quantity, unit, price_per_unit, supplier_name, date_purchased, bill_url } = parsed.data;

    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        project_id,
        item_name,
        quantity,
        unit,
        price_per_unit,
        supplier_name,
        date_purchased,
        bill_url,
        created_by: user.id,
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

