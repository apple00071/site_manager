import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const poSchema = z.object({
    project_id: z.string().uuid(),
    supplier_id: z.string().uuid().optional().nullable(),
    po_date: z.string().optional(),
    delivery_date: z.string().optional().nullable(),
    delivery_address: z.string().optional().nullable(),
    terms_conditions: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    line_items: z.array(z.object({
        boq_item_id: z.string().uuid().optional().nullable(),
        description: z.string().min(1),
        unit: z.string().optional().nullable(),
        quantity: z.number().min(0),
        rate: z.number().min(0),
    })).optional(),
});

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;

    // Check if user is assigned to the project directly
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    // Check if user is a project member
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

// Generate PO number
async function generatePoNumber(): Promise<string> {
    const { data } = await supabaseAdmin.rpc('generate_po_number');
    return data || `PO-${Date.now()}`;
}

// GET /api/purchase-orders?project_id=xxx
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        const poId = request.nextUrl.searchParams.get('id');

        // Get single PO with line items
        if (poId) {
            const { data: po, error } = await supabaseAdmin
                .from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(*),
          line_items:po_line_items(*, boq_item:boq_items(*))
        `)
                .eq('id', poId)
                .single();

            if (error || !po) {
                return NextResponse.json({ error: 'PO not found' }, { status: 404 });
            }

            const hasAccess = await checkProjectAccess(user.id, po.project_id, role || '');
            if (!hasAccess) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }

            return NextResponse.json({ po });
        }

        // List POs for project
        if (!projectId) {
            return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
        }

        const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .select(`
        *,
        supplier:suppliers(id, name),
        line_items:po_line_items(boq_item_id, description, unit, quantity, rate, amount)
      `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching POs:', error);
            return NextResponse.json({ error: 'Failed to fetch POs' }, { status: 500 });
        }

        // Calculate stats
        const pos: any[] = data || [];
        const stats = {
            total: pos.length,
            draft: pos.filter((po: any) => po.status === 'draft').length,
            sent: pos.filter((po: any) => po.status === 'sent').length,
            received: pos.filter((po: any) => ['received', 'partially_received'].includes(po.status)).length,
            totalValue: pos.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0),
        };

        return NextResponse.json({ pos, stats });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/purchase-orders - Create PO
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validationResult = poSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { project_id, line_items, ...poData } = validationResult.data;

        const hasAccess = await checkProjectAccess(user.id, project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Calculate totals
        const subtotal = (line_items || []).reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const taxAmount = subtotal * 0.18; // 18% GST
        const totalAmount = subtotal + taxAmount;

        // BUDGET & VALIDATION WARNINGS
        let budgetWarning: any = null;
        const warnings: string[] = [];

        // 1. Check Project Budget
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('budget')
            .eq('id', project_id)
            .single();

        if (project?.budget && project.budget > 0) {
            // Get existing PO totals for this project
            const { data: existingPos } = await supabaseAdmin
                .from('purchase_orders')
                .select('total_amount')
                .eq('project_id', project_id)
                .neq('status', 'cancelled');

            const existingTotal = existingPos?.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0) || 0;
            const newTotal = existingTotal + totalAmount;

            if (newTotal > project.budget) {
                warnings.push(`Project Budget Exceeded: Total POs (₹${newTotal.toLocaleString()}) > Budget (₹${project.budget.toLocaleString()})`);
            }
        }

        // 2. Check Item Rates & Quantities
        const boqItemIds = line_items?.map(i => i.boq_item_id).filter(Boolean) as string[] || [];
        if (boqItemIds.length > 0) {
            const { data: boqItems } = await supabaseAdmin
                .from('boq_items')
                .select('id, rate, quantity, item_name, status') // Added status
                .in('id', boqItemIds);

            // Fetch existing ordered quantities for these items
            const { data: existingLines } = await supabaseAdmin
                .from('po_line_items')
                .select(`
                    boq_item_id, 
                    quantity,
                    po:purchase_orders!inner(status)
                `)
                .in('boq_item_id', boqItemIds)
                .neq('po.status', 'cancelled');

            const orderedMap: Record<string, number> = {};
            existingLines?.forEach((line: any) => {
                orderedMap[line.boq_item_id] = (orderedMap[line.boq_item_id] || 0) + (line.quantity || 0);
            });

            for (const item of (line_items || [])) { // Changed to for..of loop for async/return support
                if (!item.boq_item_id) continue;
                const boqItem = boqItems?.find((b: any) => b.id === item.boq_item_id);
                if (!boqItem) continue;

                // CRITICAL VALIDATION: Only allow POs for confirmed items
                if (boqItem.status !== 'confirmed') {
                    return NextResponse.json(
                        { error: `Cannot create PO for item '${boqItem.item_name}' because it is in '${boqItem.status}' status. Only 'confirmed' items can be ordered.` },
                        { status: 400 }
                    );
                }

                // Rate Check (allow 5% variance before warning)
                if (item.rate > boqItem.rate * 1.05) {
                    warnings.push(`Rate Warning: '${boqItem.item_name}' rate (₹${item.rate}) is higher than BOQ rate (₹${boqItem.rate})`);
                }

                // Quantity Check
                const previouslyOrdered = orderedMap[item.boq_item_id] || 0;
                const newTotalQty = previouslyOrdered + item.quantity;
                if (newTotalQty > boqItem.quantity) {
                    warnings.push(`Quantity Warning: '${boqItem.item_name}' total ordered (${newTotalQty}) exceeds BOQ quantity (${boqItem.quantity})`);
                }
            }
        }

        if (warnings.length > 0) {
            budgetWarning = {
                warning: 'validation_warnings',
                messages: warnings
            };
        }

        // Generate PO number
        const poNumber = await generatePoNumber();

        // Create PO
        const { data: po, error: poError } = await supabaseAdmin
            .from('purchase_orders')
            .insert({
                ...poData,
                project_id,
                po_number: poNumber,
                subtotal,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                created_by: user.id,
            })
            .select()
            .single();

        if (poError) {
            console.error('Error creating PO:', poError);
            return NextResponse.json({ error: 'Failed to create PO' }, { status: 500 });
        }

        // Create line items
        if (line_items && line_items.length > 0) {
            const { error: lineError } = await supabaseAdmin
                .from('po_line_items')
                .insert(
                    line_items.map(item => ({
                        po_id: po.id,
                        boq_item_id: item.boq_item_id,
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        rate: item.rate,
                    }))
                );

            if (lineError) {
                console.error('Error creating line items:', lineError);
            }
        }

        // --- NOTIFICATIONS ---
        try {
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('title, created_by')
                .eq('id', project_id)
                .single();

            if (project?.created_by) {
                const projectName = project.title || 'Unknown Project';
                const poNum = po.po_number || 'N/A';
                const amount = po.total_amount || 0;

                await NotificationService.createNotification({
                    userId: project.created_by,
                    title: 'New Purchase Order Created',
                    message: `A new PO (${poNum}) for ₹${amount.toLocaleString()} was created for project "${projectName}"`,
                    type: 'project_update',
                    relatedId: po.id,
                    relatedType: 'purchase_order'
                });
            }
        } catch (notifError) {
            console.error('Error sending PO creation notification:', notifError);
        }

        return NextResponse.json({ po, budget_warning: budgetWarning }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/purchase-orders - Update PO
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, line_items, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'PO ID is required' }, { status: 400 });
        }

        // Get existing PO
        const { data: existing } = await supabaseAdmin
            .from('purchase_orders')
            .select('project_id, status')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'PO not found' }, { status: 404 });
        }

        const hasAccess = await checkProjectAccess(user.id, existing.project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Recalculate totals if line items updated
        if (line_items) {
            const subtotal = line_items.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
            updates.subtotal = subtotal;
            updates.tax_amount = subtotal * 0.18;
            updates.total_amount = subtotal + updates.tax_amount;

            // Delete existing line items and recreate
            await supabaseAdmin.from('po_line_items').delete().eq('po_id', id);

            await supabaseAdmin
                .from('po_line_items')
                .insert(
                    line_items.map((item: any) => ({
                        po_id: id,
                        boq_item_id: item.boq_item_id,
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        rate: item.rate,
                    }))
                );
        }

        const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating PO:', error);
            return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 });
        }

        // --- NOTIFICATIONS ---
        try {
            if (updates.status && updates.status !== existing.status) {
                const { data: project } = await supabaseAdmin
                    .from('projects')
                    .select('title, created_by')
                    .eq('id', existing.project_id)
                    .single();

                if (project?.created_by) {
                    const projectName = project.title || 'Unknown Project';
                    const poNum = data.po_number || 'N/A';
                    const statusText = updates.status.replace('_', ' ').toUpperCase();

                    await NotificationService.createNotification({
                        userId: project.created_by,
                        title: 'Purchase Order Updated',
                        message: `PO ${poNum} for project "${projectName}" is now ${statusText}`,
                        type: 'project_update',
                        relatedId: id,
                        relatedType: 'purchase_order'
                    });
                }
            }
        } catch (notifError) {
            console.error('Error sending PO update notification:', notifError);
        }

        return NextResponse.json({ po: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/purchase-orders?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'PO ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('purchase_orders')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting PO:', error);
            return NextResponse.json({ error: 'Failed to delete PO' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
