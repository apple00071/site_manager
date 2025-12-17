import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;

    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

    return !!data;
}

const ImportItemSchema = z.object({
    category: z.string().optional().default('Uncategorized'),
    item_name: z.string().min(1),
    description: z.string().optional().default(''),
    unit: z.string().default('Nos'),
    quantity: z.number().default(0),
    rate: z.number().default(0),
    item_type: z.string().optional().default('material'),
    source: z.string().optional().default('bought_out'),
});

const ImportPayloadSchema = z.object({
    project_id: z.string().uuid(),
    items: z.array(ImportItemSchema),
});

// POST /api/boq/import - Bulk import BOQ items from CSV/Excel
export async function POST(request: NextRequest) {
    console.log('BOQ Import: Request received');
    try {
        const { user, error: authError, role: userRole } = await getAuthUser();
        console.log('BOQ Import: Auth check', { userId: user?.id, role: userRole, error: authError });

        if (authError || !user) {
            console.error('BOQ Import: Unauthorized', authError);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can import
        if (userRole !== 'admin') {
            console.error('BOQ Import: Forbidden - Not admin', { role: userRole });
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        console.log('BOQ Import: Body received', { itemCount: body?.items?.length });

        const parsed = ImportPayloadSchema.safeParse(body);

        if (!parsed.success) {
            console.error('BOQ Import: Invalid payload', parsed.error.flatten());
            return NextResponse.json({
                error: 'Invalid payload',
                details: parsed.error.flatten()
            }, { status: 400 });
        }

        const { project_id, items } = parsed.data;

        // Check project access
        const hasAccess = await checkProjectAccess(user.id, project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get current max sort_order
        const { data: existing } = await supabaseAdmin
            .from('boq_items')
            .select('sort_order')
            .eq('project_id', project_id)
            .order('sort_order', { ascending: false })
            .limit(1);

        let sortOrder = (existing?.[0]?.sort_order || 0) + 1;

        // Prepare items for insertion
        const itemsToInsert = items.map(item => ({
            project_id,
            category: item.category,
            item_name: item.item_name,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            item_type: item.item_type,
            source: item.source,
            status: 'draft',
            order_status: 'pending',
            sort_order: sortOrder++,
            created_by: user.id,
        }));

        // Batch insert
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('boq_items')
            .insert(itemsToInsert)
            .select();

        if (insertError) {
            console.error('Import error:', insertError);
            return NextResponse.json({ error: 'Failed to import items' }, { status: 500 });
        }

        // Calculate total amount
        const totalAmount = items.reduce((sum, i) => sum + (i.quantity * i.rate), 0);

        return NextResponse.json({
            success: true,
            imported_count: inserted?.length || 0,
            total_amount: totalAmount,
            items: inserted,
        });
    } catch (err) {
        console.error('Import API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
