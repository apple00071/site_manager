import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// DELETE - Delete inventory item by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;
        const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

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

// PATCH - Update inventory item by ID
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;
        const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const body = await request.json();

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
            .update(body)
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
