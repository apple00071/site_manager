import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

const deliveryConfirmSchema = z.object({
    project_id: z.string().uuid(),
    item_ids: z.array(z.string().uuid()).min(1, 'At least one item must be selected'),
    delivered_quantities: z.record(z.string(), z.number()).optional(),
    delivery_date: z.string().optional(),
    delivery_challan_url: z.string().optional().nullable(),
    delivery_notes: z.string().optional().nullable(),
    bill_number: z.string().optional().nullable(),
    status: z.enum(['ordered', 'delivered', 'pending']).default('delivered')
});

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parseResult = deliveryConfirmSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Invalid delivery confirmation data', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const {
            project_id,
            item_ids,
            delivered_quantities = {},
            delivery_date,
            delivery_challan_url,
            delivery_notes,
            bill_number,
            status
        } = parseResult.data;

        // Fetch user info for notification message
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id, full_name, role')
            .eq('id', user.id)
            .single();

        const userFullName = userData?.full_name || 'Site Engineer';

        // Fetch project info
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id, title, assigned_employee_id, created_by')
            .eq('id', project_id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // RBAC check: admin, assigned team member, or boq.delivery / boq.edit permission
        const isAdmin = userData?.role === 'admin';
        const isAssigned = project.assigned_employee_id === user.id || project.created_by === user.id;
        if (!isAdmin && !isAssigned) {
            const { verifyPermission } = await import('@/lib/rbac');
            const permCheck = await verifyPermission(user.id, 'boq.delivery', project_id);
            const permEdit = await verifyPermission(user.id, 'boq.edit', project_id);
            if (!permCheck.allowed && !permEdit.allowed) {
                return NextResponse.json({ error: 'Permission denied: boq.delivery or boq.edit required' }, { status: 403 });
            }
        }

        // Fetch existing items to know their details
        const { data: existingItems, error: itemsError } = await supabaseAdmin
            .from('boq_items')
            .select('id, item_name, quantity, unit')
            .in('id', item_ids);

        if (itemsError || !existingItems) {
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        const deliveredTimestamp = delivery_date
            ? new Date(delivery_date).toISOString()
            : new Date().toISOString();

        // Update each item
        for (const item of existingItems) {
            const deliveredQty = delivered_quantities[item.id] !== undefined
                ? delivered_quantities[item.id]
                : (status === 'delivered' ? item.quantity : 0);

            const updatePayload: Record<string, any> = {
                order_status: status,
                updated_at: new Date().toISOString()
            };

            if (status === 'delivered') {
                updatePayload.delivered_quantity = deliveredQty;
                updatePayload.delivered_at = deliveredTimestamp;
                updatePayload.delivered_by = user.id;
                if (delivery_challan_url) updatePayload.delivery_challan_url = delivery_challan_url;
                updatePayload.delivery_notes = delivery_notes?.trim() || null;
            } else if (status === 'ordered') {
                // If just marking as ordered
                if (delivery_notes) updatePayload.delivery_notes = delivery_notes;
            } else if (status === 'pending') {
                // Reset to pending
                updatePayload.delivered_quantity = 0;
                updatePayload.delivered_at = null;
                updatePayload.delivered_by = null;
                updatePayload.delivery_challan_url = null;
                updatePayload.delivery_notes = null;
            }

            await supabaseAdmin
                .from('boq_items')
                .update(updatePayload)
                .eq('id', item.id);
        }

        // Also update boq_bills if bill_number is provided
        if (bill_number) {
            try {
                await supabaseAdmin
                    .from('boq_bills')
                    .update({
                        status,
                        delivery_date: deliveredTimestamp,
                        delivered_at: status === 'delivered' ? deliveredTimestamp : null,
                        delivered_by: status === 'delivered' ? user.id : null,
                        delivery_challan_url: status === 'delivered' ? (delivery_challan_url || null) : null,
                        delivery_notes: delivery_notes || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('project_id', project_id)
                    .eq('bill_number', bill_number);
            } catch (_) {
                // Table might not exist; safe to ignore
            }
        }

        // Notify Admins & Project Managers if marked as delivered
        if (status === 'delivered') {
            const recipientUserIds = new Set<string>();

            // 1. Fetch all admins
            const { data: admins } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin');

            ((admins || []) as Array<{ id: string }>).forEach((a) => recipientUserIds.add(a.id));

            // 2. Project creator & assigned employee
            if (project.created_by) recipientUserIds.add(project.created_by);
            if (project.assigned_employee_id) recipientUserIds.add(project.assigned_employee_id);

            // Don't notify the user who performed the confirmation
            recipientUserIds.delete(user.id);

            // Build item description summary
            const itemsSummary = (existingItems as Array<{ id: string; item_name: string; quantity: number; unit?: string | null }>).slice(0, 3).map(it => {
                const qty = delivered_quantities[it.id] ?? it.quantity;
                return `${it.item_name} (${qty} ${it.unit || ''})`.trim();
            }).join(', ');

            const extraCount = existingItems.length > 3 ? ` and ${existingItems.length - 3} more` : '';
            const billLabel = bill_number ? `[${bill_number}] ` : '';
            const notificationTitle = bill_number
                ? `${bill_number} Delivered: ${project.title}`
                : `Material Delivered: ${project.title}`;
            const notificationMsg = `${billLabel}${itemsSummary}${extraCount} marked DELIVERED on site by ${userFullName}.${delivery_notes ? ` Notes: ${delivery_notes}` : ''}`;

            for (const recipientId of recipientUserIds) {
                try {
                    await NotificationService.createNotification({
                        userId: recipientId,
                        title: notificationTitle,
                        message: notificationMsg,
                        type: 'material_delivered',
                        relatedId: project.id,
                        relatedType: 'project',
                        metadata: {
                            project_id: project.id,
                            item_ids,
                            bill_number,
                            delivery_challan_url,
                            delivery_notes,
                            delivered_by_name: userFullName
                        }
                    });
                } catch (notifErr) {
                    console.error('Error sending delivery notification:', notifErr);
                }
            }
        }

        return NextResponse.json({
            success: true,
            status,
            updatedCount: existingItems.length
        });
    } catch (err: any) {
        console.error('Error updating BOQ delivery status:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
