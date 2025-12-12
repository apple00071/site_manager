import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const boqItemSchema = z.object({
    project_id: z.string().uuid(),
    category: z.string().optional().nullable(),
    sub_category: z.string().optional().nullable(),
    item_name: z.string().min(1, 'Item name is required'),
    description: z.string().optional().nullable(),
    unit: z.string().min(1, 'Unit is required'),
    quantity: z.number().min(0).default(0),
    rate: z.number().min(0).default(0),
    status: z.enum(['draft', 'confirmed', 'completed']).optional(),
    sort_order: z.number().optional(),
    remarks: z.string().optional().nullable(),
});

// Helper to get user role from database
async function getUserRole(userId: string): Promise<string> {
    const { data } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
    return data?.role || '';
}

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    // Admin always has access
    if (userRole === 'admin') return true;

    // Check if user is assigned to the project
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    // Check project_members table
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

    return !!data;
}

// GET /api/boq?project_id=xxx - Get BOQ items for a project
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
        }

        // Get user role from database
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const userRole = userData?.role || '';

        // Check access
        const hasAccess = await checkProjectAccess(user.id, projectId, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Parse pagination params
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
        const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
        const section = request.nextUrl.searchParams.get('section');

        let query = supabaseAdmin
            .from('boq_items')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true })
            .order('category', { ascending: true })
            .order('created_at', { ascending: true });

        // Filter by section/category if provided
        if (section && section !== 'all') {
            query = query.eq('category', section);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching BOQ:', error);
            return NextResponse.json({ error: 'Failed to fetch BOQ items' }, { status: 500 });
        }

        // Get linked POs for each item
        const items: any[] = data || [];
        const itemIds = items.map((i: any) => i.id);

        let linkedPosMap: Record<string, { id: string; po_number: string; status: string }[]> = {};
        if (itemIds.length > 0) {
            const { data: lineItems } = await supabaseAdmin
                .from('po_line_items')
                .select(`
                    boq_item_id,
                    po:purchase_orders!po_line_items_po_id_fkey(id, po_number, status)
                `)
                .in('boq_item_id', itemIds);

            // Group by boq_item_id
            (lineItems || []).forEach((li: any) => {
                if (li.boq_item_id && li.po) {
                    if (!linkedPosMap[li.boq_item_id]) {
                        linkedPosMap[li.boq_item_id] = [];
                    }
                    // Avoid duplicates
                    if (!linkedPosMap[li.boq_item_id].find((p: any) => p.id === li.po.id)) {
                        linkedPosMap[li.boq_item_id].push({
                            id: li.po.id,
                            po_number: li.po.po_number,
                            status: li.po.status
                        });
                    }
                }
            });
        }

        // Attach linked_pos to items
        const itemsWithPos = items.map((item: any) => ({
            ...item,
            linked_pos: linkedPosMap[item.id] || []
        }));

        // Calculate totals
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        const statusCounts = {
            draft: items.filter((i: any) => i.status === 'draft').length,
            confirmed: items.filter((i: any) => i.status === 'confirmed').length,
            completed: items.filter((i: any) => i.status === 'completed').length,
        };

        // Calculate section totals
        const sectionTotals: Record<string, { count: number; amount: number }> = {};
        items.forEach((item: any) => {
            const cat = item.category || 'Uncategorized';
            if (!sectionTotals[cat]) {
                sectionTotals[cat] = { count: 0, amount: 0 };
            }
            sectionTotals[cat].count++;
            sectionTotals[cat].amount += item.amount || 0;
        });

        return NextResponse.json({
            items: itemsWithPos,
            totalAmount,
            statusCounts,
            totalItems: items.length,
            sectionTotals,
            pagination: { limit, offset, hasMore: items.length === limit }
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boq - Create BOQ item
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validationResult = boqItemSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { project_id } = validationResult.data;

        // Check access
        const userRole = await getUserRole(user.id);
        const hasAccess = await checkProjectAccess(user.id, project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('boq_items')
            .insert({
                ...validationResult.data,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating BOQ item:', error);
            return NextResponse.json({ error: 'Failed to create BOQ item' }, { status: 500 });
        }

        return NextResponse.json({ item: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/boq - Update BOQ item
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
        }

        // Get existing item to check project access
        const { data: existing } = await supabaseAdmin
            .from('boq_items')
            .select('project_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const userRole = await getUserRole(user.id);
        const hasAccess = await checkProjectAccess(user.id, existing.project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const validationResult = boqItemSchema.partial().safeParse(updates);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('boq_items')
            .update(validationResult.data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating BOQ item:', error);
            return NextResponse.json({ error: 'Failed to update BOQ item' }, { status: 500 });
        }

        return NextResponse.json({ item: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/boq?id=xxx - Delete BOQ item
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
        }

        // Get existing item to check project access
        const { data: existing } = await supabaseAdmin
            .from('boq_items')
            .select('project_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const userRole = await getUserRole(user.id);
        const hasAccess = await checkProjectAccess(user.id, existing.project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('boq_items')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting BOQ item:', error);
            return NextResponse.json({ error: 'Failed to delete BOQ item' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boq/bulk - Bulk operations
export async function PUT(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, project_id, item_ids, status } = body;

        if (!project_id || !item_ids || !Array.isArray(item_ids)) {
            return NextResponse.json({ error: 'project_id and item_ids are required' }, { status: 400 });
        }

        const userRole = await getUserRole(user.id);
        const hasAccess = await checkProjectAccess(user.id, project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        if (action === 'update_status' && status) {
            const { error } = await supabaseAdmin
                .from('boq_items')
                .update({ status })
                .in('id', item_ids);

            if (error) {
                console.error('Error bulk updating BOQ:', error);
                return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
            }

            return NextResponse.json({ success: true, updated: item_ids.length });
        }

        if (action === 'delete') {
            const { error } = await supabaseAdmin
                .from('boq_items')
                .delete()
                .in('id', item_ids);

            if (error) {
                console.error('Error bulk deleting BOQ:', error);
                return NextResponse.json({ error: 'Failed to delete items' }, { status: 500 });
            }

            return NextResponse.json({ success: true, deleted: item_ids.length });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
