import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const deliveryConfirmSchema = z.object({
    project_id: z.string().uuid(),
    item_ids: z.array(z.string().uuid()).min(1, 'At least one item must be selected'),
    delivered_quantities: z.record(z.string(), z.number()).optional(),
    delivery_date: z.string().optional(),
    delivery_challan_url: z.string().optional().nullable(),
    delivery_notes: z.string().optional().nullable(),
    bill_number: z.string().optional().nullable(),
    status: z.enum(['ordered', 'delivered', 'pending', 'partial']).default('delivered')
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

        // Fetch user info for notification message & authorization
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id, full_name, role, role_id, designation, roles:role_id(name)')
            .eq('id', user.id)
            .single();

        const userFullName = userData?.full_name || user.full_name || 'Site Engineer';
        const userRoleName = ((userData?.roles as any)?.name || userData?.role || '').toLowerCase();
        const userDesignation = (userData?.designation || user.designation || '').toLowerCase();

        // Fetch project info (including site_supervisor_id)
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id, title, assigned_employee_id, site_supervisor_id, created_by')
            .eq('id', project_id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Comprehensive Authorization Check:
        // 1. Admin or Admin HR
        const isAdmin = user.isAdmin ||
            userData?.role?.toLowerCase() === 'admin' ||
            userRoleName.includes('admin');

        // 2. Site Engineer (by role name or designation)
        const isSiteEngineer =
            userRoleName.includes('site') ||
            userRoleName.includes('engineer') ||
            userDesignation.includes('site') ||
            userDesignation.includes('engineer');

        // 3. Project assigned role (site supervisor, designer, creator)
        const isProjectAssigned =
            project.site_supervisor_id === user.id ||
            project.assigned_employee_id === user.id ||
            project.created_by === user.id;

        // 4. Project member
        let isProjectMember = false;
        if (!isAdmin && !isSiteEngineer && !isProjectAssigned) {
            const { data: member } = await supabaseAdmin
                .from('project_members')
                .select('id')
                .eq('project_id', project_id)
                .eq('user_id', user.id)
                .maybeSingle();
            if (member) isProjectMember = true;
        }

        // 5. RBAC permission (boq.delivery or boq.edit)
        const hasDeliveryPerm = user.permissionCodes?.has('boq.delivery') || user.permissionCodes?.has('*');
        const hasEditPerm = user.permissionCodes?.has('boq.edit');

        const isAuthorized = isAdmin || isSiteEngineer || isProjectAssigned || isProjectMember || hasDeliveryPerm || hasEditPerm;

        if (!isAuthorized) {
            const { verifyPermission } = await import('@/lib/rbac');
            const permCheck = await verifyPermission(user, 'boq.delivery', project_id);
            const permEdit = await verifyPermission(user, 'boq.edit', project_id);
            if (!permCheck.allowed && !permEdit.allowed) {
                return NextResponse.json({ error: 'Permission denied: boq.delivery or boq.edit required' }, { status: 403 });
            }
        }

        // Fetch existing items to know their details
        const { data: existingItems, error: itemsError } = await supabaseAdmin
            .from('boq_items')
            .select('id, item_name, quantity, unit, bill_number')
            .in('id', item_ids);

        if (itemsError || !existingItems || existingItems.length === 0) {
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        const deliveredTimestamp = delivery_date
            ? new Date(delivery_date).toISOString()
            : new Date().toISOString();

        // Track shortfalls and excesses across items
        const shortfalls: string[] = [];
        const excesses: string[] = [];

        // Update each item in boq_items
        for (const item of existingItems) {
            const deliveredQty = delivered_quantities[item.id] !== undefined
                ? Number(delivered_quantities[item.id])
                : (status === 'delivered' ? item.quantity : 0);

            let itemStatus: string = status;
            if (status === 'delivered') {
                if (deliveredQty < item.quantity && deliveredQty > 0) {
                    itemStatus = 'partial';
                    shortfalls.push(`${item.item_name} (${deliveredQty}/${item.quantity} ${item.unit || ''})`);
                } else if (deliveredQty === 0) {
                    itemStatus = 'ordered';
                    shortfalls.push(`${item.item_name} (0/${item.quantity} ${item.unit || ''})`);
                } else {
                    itemStatus = 'delivered';
                    if (deliveredQty > item.quantity) {
                        excesses.push(`${item.item_name} (+${(deliveredQty - item.quantity).toFixed(1).replace(/\.0$/, '')} ${item.unit || ''})`);
                    }
                }
            }

            const updatePayload: Record<string, any> = {
                order_status: itemStatus,
                updated_at: new Date().toISOString()
            };

            if (status === 'delivered') {
                updatePayload.delivered_quantity = deliveredQty;
                updatePayload.delivered_at = deliveredTimestamp;
                updatePayload.delivered_by = user.id;
                if (delivery_challan_url) updatePayload.delivery_challan_url = delivery_challan_url;
                if (delivery_notes) updatePayload.delivery_notes = delivery_notes.trim();
            } else if (status === 'ordered') {
                if (delivery_notes) updatePayload.delivery_notes = delivery_notes.trim();
            } else if (status === 'pending') {
                updatePayload.delivered_quantity = 0;
                updatePayload.delivered_at = null;
                updatePayload.delivered_by = null;
                updatePayload.delivery_challan_url = null;
                updatePayload.delivery_notes = null;
            }

            const { error: updErr } = await supabaseAdmin
                .from('boq_items')
                .update(updatePayload)
                .eq('id', item.id);

            if (updErr) {
                console.error(`Failed to update boq_item ${item.id}:`, updErr);
                return NextResponse.json(
                    { error: `Failed to update item "${item.item_name}": ${updErr.message}` },
                    { status: 500 }
                );
            }
        }

        // Determine all affected bills: either explicitly passed or derived from items
        const affectedBillNumbers = new Set<string>();
        if (bill_number) affectedBillNumbers.add(bill_number);
        for (const it of existingItems) {
            if ((it as any).bill_number) affectedBillNumbers.add((it as any).bill_number);
        }

        // Update boq_bills for each affected bill
        for (const bNum of affectedBillNumbers) {
            try {
                const { data: billItems } = await supabaseAdmin
                    .from('boq_items')
                    .select('id, quantity, delivered_quantity, order_status')
                    .eq('project_id', project_id)
                    .eq('bill_number', bNum);

                let billStatus = 'delivered';
                const itemsList = (billItems || []) as Array<{ id: string; quantity: number; delivered_quantity: number | null; order_status: string }>;
                if (itemsList.length > 0) {
                    const anyOrdered = itemsList.some(i => i.order_status === 'ordered');
                    const anyPartial = itemsList.some(i => i.order_status === 'partial');
                    const anyDelivered = itemsList.some(i => i.order_status === 'delivered');

                    if (anyOrdered && (anyDelivered || anyPartial)) {
                        billStatus = 'partial';
                    } else if (anyOrdered && !anyDelivered && !anyPartial) {
                        billStatus = 'ordered';
                    } else if (anyPartial) {
                        billStatus = 'partial';
                    } else {
                        billStatus = 'delivered';
                    }
                } else {
                    billStatus = shortfalls.length > 0 ? 'partial' : status;
                }

                const billUpdatePayload: Record<string, any> = {
                    status: billStatus,
                    updated_at: new Date().toISOString()
                };
                if (status === 'delivered') {
                    billUpdatePayload.delivery_date = deliveredTimestamp;
                    billUpdatePayload.delivered_at = deliveredTimestamp;
                    billUpdatePayload.delivered_by = user.id;
                    if (delivery_challan_url) billUpdatePayload.delivery_challan_url = delivery_challan_url;
                    if (delivery_notes) billUpdatePayload.delivery_notes = delivery_notes.trim();
                }

                await supabaseAdmin
                    .from('boq_bills')
                    .update(billUpdatePayload)
                    .eq('project_id', project_id)
                    .eq('bill_number', bNum);
            } catch (billErr) {
                console.error(`Error updating boq_bills for ${bNum}:`, billErr);
            }
        }

        // Notify Admins, Project Managers & Assigned Employees if marked as delivered
        if (status === 'delivered') {
            const recipientUserMap = new Map<string, { id: string; phone_number?: string | null }>();

            // 1. Fetch all admins (Role admin or Admin HR)
            const { data: adminUsers } = await supabaseAdmin
                .from('users')
                .select('id, phone_number, role, role_id')
                .or('role.eq.admin,role_id.eq.f0acded2-9796-4f56-b2b6-a837997fe125,role_id.eq.9a26e4c4-751f-4ef2-b9a7-60f4a062a782');

            ((adminUsers || []) as Array<{ id: string; phone_number?: string | null }>).forEach(a => recipientUserMap.set(a.id, a));

            // 2. Project creator & assigned employee
            const otherIds = [project.created_by, project.assigned_employee_id].filter(Boolean) as string[];
            if (otherIds.length > 0) {
                const { data: others } = await supabaseAdmin
                    .from('users')
                    .select('id, phone_number')
                    .in('id', otherIds);
                ((others || []) as Array<{ id: string; phone_number?: string | null }>).forEach(o => recipientUserMap.set(o.id, o));
            }

            // Don't notify the user who performed the confirmation
            recipientUserMap.delete(user.id);

            // Build item description summary
            const typedExistingItems = existingItems as Array<{ id: string; item_name: string; quantity: number; unit?: string | null; bill_number?: string | null }>;
            const itemsSummary = typedExistingItems.slice(0, 3).map(it => {
                const qty = delivered_quantities[it.id] ?? it.quantity;
                return `${it.item_name} (${qty} ${it.unit || ''})`.trim();
            }).join(', ');

            const extraCount = typedExistingItems.length > 3 ? ` and ${typedExistingItems.length - 3} more` : '';
            const billLabel = bill_number ? `[${bill_number}] ` : '';

            let notificationTitle = bill_number
                ? `${bill_number} Delivered: ${project.title}`
                : `Material Delivered: ${project.title}`;

            let varianceDetails = '';
            if (shortfalls.length > 0) {
                notificationTitle = bill_number
                    ? `⚠️ Shortfall in ${bill_number}: ${project.title}`
                    : `⚠️ Partial Delivery: ${project.title}`;
                varianceDetails += ` ⚠️ Shortfall: ${shortfalls.join(', ')}.`;
            }
            if (excesses.length > 0) {
                varianceDetails += ` ℹ️ Excess: ${excesses.join(', ')}.`;
            }

            const notificationMsg = `${billLabel}${itemsSummary}${extraCount} verified on site by ${userFullName}.${varianceDetails}${delivery_notes ? ` Notes: ${delivery_notes}` : ''}`;
            const projectRoute = `/dashboard/projects/${project.id}?tab=boq`;

            for (const [recipientId, recipientData] of recipientUserMap.entries()) {
                // In-App Notification & Push Notification
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
                            delivered_by_name: userFullName,
                            route: projectRoute
                        }
                    });
                } catch (notifErr) {
                    console.error('Error sending delivery in-app notification:', notifErr);
                }

                // WhatsApp Alert to Admin
                if (recipientData?.phone_number) {
                    try {
                        const waMsg = `📦 *Material Delivery Alert*\n\n*Project:* ${project.title}\n*Verified By:* ${userFullName}\n${bill_number ? `*Bill:* ${bill_number}\n` : ''}*Items:* ${itemsSummary}${extraCount}\n${varianceDetails ? `${varianceDetails}\n` : ''}${delivery_notes ? `*Notes:* ${delivery_notes}\n` : ''}\nView details on dashboard.`;
                        await sendCustomWhatsAppNotification(recipientData.phone_number, waMsg);
                    } catch (waErr) {
                        console.error('Error sending WhatsApp delivery alert:', waErr);
                    }
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
