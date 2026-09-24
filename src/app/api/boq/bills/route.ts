import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const createBillSchema = z.object({
    project_id: z.string().uuid(),
    item_ids: z.array(z.string().uuid()).min(1, 'At least one item must be included in the bill'),
    bill_type: z.enum(['boq', 'laminate']).default('boq'),
    order_date: z.string().optional(),
    notes: z.string().optional().nullable()
});

/**
 * GET /api/boq/bills?project_id=...
 * Returns all consolidated delivery bills for the project with their constituent items.
 */
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('project_id');

        if (!projectId) {
            return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
        }

        // RBAC check: boq.view or boq.delivery
        const { checkPermission } = await import('@/lib/rbac');
        const hasView = await checkPermission(user.id, 'boq.view', projectId);
        const hasDelivery = await checkPermission(user.id, 'boq.delivery', projectId);
        if (!hasView.allowed && !hasDelivery.allowed) {
            return NextResponse.json({ error: 'Permission denied: boq.view or boq.delivery required' }, { status: 403 });
        }

        // Fetch all items for this project
        const { data: allItems, error: itemsError } = await supabaseAdmin
            .from('boq_items')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (itemsError) {
            return NextResponse.json({ error: itemsError.message }, { status: 500 });
        }

        // Try fetching from boq_bills table if it exists
        let dbBills: any[] = [];
        try {
            const { data: billsData } = await supabaseAdmin
                .from('boq_bills')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (billsData && Array.isArray(billsData)) {
                dbBills = billsData;
            }
        } catch (_) {
            // boq_bills table might not be migrated yet; fallback gracefully
        }

        // Group items by bill identifier
        // Identifier can be item.bill_number OR extracted from item.delivery_notes (e.g. "[Bill #1")
        const billMap = new Map<string, {
            id: string;
            bill_number: string;
            bill_type: 'boq' | 'laminate';
            order_date: string;
            status: 'ordered' | 'delivered';
            items: any[];
            delivery_date?: string | null;
            delivered_at?: string | null;
            delivered_by?: string | null;
            delivery_challan_url?: string | null;
            delivery_notes?: string | null;
            created_at?: string;
        }>();

        // Seed with existing dbBills
        dbBills.forEach((b: any) => {
            billMap.set(b.bill_number, {
                id: b.id,
                bill_number: b.bill_number,
                bill_type: b.bill_type || 'boq',
                order_date: b.order_date || (b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
                status: b.status || 'ordered',
                items: [],
                delivery_date: b.delivery_date,
                delivered_at: b.delivered_at,
                delivered_by: b.delivered_by,
                delivery_challan_url: b.delivery_challan_url,
                delivery_notes: b.delivery_notes,
                created_at: b.created_at
            });
        });

        // Match items to bills
        (allItems || []).forEach((item: any) => {
            let matchedBillNum: string | null = (item as any).bill_number || null;

            if (!matchedBillNum && item.delivery_notes) {
                const match = item.delivery_notes.match(/(?:\[)?(Bill\s*#?\d+)/i);
                if (match) {
                    matchedBillNum = match[1].replace(/\s+/g, ' ');
                }
            }

            // Fallback: If item is ordered/delivered, always group into a Delivery Bill
            if (!matchedBillNum && (item.order_status === 'ordered' || item.order_status === 'delivered')) {
                const datePart = (item.delivery_notes && item.delivery_notes.match(/\d{4}-\d{2}-\d{2}/)?.[0])
                    || (item.delivered_at ? item.delivered_at.split('T')[0] : null)
                    || (item.updated_at ? item.updated_at.split('T')[0] : null)
                    || new Date().toISOString().split('T')[0];
                matchedBillNum = `Bill #1`;
            }

            if (matchedBillNum) {
                if (!billMap.has(matchedBillNum)) {
                    billMap.set(matchedBillNum, {
                        id: matchedBillNum,
                        bill_number: matchedBillNum,
                        bill_type: item.category === 'laminate' ? 'laminate' : 'boq',
                        order_date: (item.delivery_notes && item.delivery_notes.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || new Date().toISOString().split('T')[0],
                        status: item.order_status === 'delivered' ? 'delivered' : 'ordered',
                        items: [],
                        delivery_date: item.delivered_at,
                        delivered_at: item.delivered_at,
                        delivered_by: item.delivered_by,
                        delivery_challan_url: item.delivery_challan_url,
                        delivery_notes: (item.delivery_notes && !item.delivery_notes.startsWith('Marked as ordered') && !item.delivery_notes.startsWith('Order placed')) ? item.delivery_notes : null,
                        created_at: item.created_at
                    });
                }

                const b = billMap.get(matchedBillNum)!;
                b.items.push(item);
                // If any item is ordered (not delivered), bill is still considered ordered / pending delivery
                if (item.order_status === 'ordered') {
                    b.status = 'ordered';
                }
                if (item.delivery_challan_url && !b.delivery_challan_url) {
                    b.delivery_challan_url = item.delivery_challan_url;
                }
                if (item.delivered_at && !b.delivered_at) {
                    b.delivered_at = item.delivered_at;
                }
            }
        });

        // Convert map to sorted list
        const bills = Array.from(billMap.values()).map(b => ({
            ...b,
            item_count: b.items.length
        }));

        // Sort: pending/ordered first, then delivered, then newest first
        bills.sort((a, b) => {
            if (a.status === 'ordered' && b.status !== 'ordered') return -1;
            if (a.status !== 'ordered' && b.status === 'ordered') return 1;
            return (b.created_at || '').localeCompare(a.created_at || '');
        });

        return NextResponse.json({ bills });
    } catch (err: any) {
        console.error('Error fetching bills:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/boq/bills
 * Creates a new consolidated Delivery Bill from exported item IDs.
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parseResult = createBillSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Invalid bill data', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const { project_id, item_ids, bill_type, order_date, notes } = parseResult.data;
        const formattedDate = order_date || new Date().toISOString().split('T')[0];

        // RBAC check: boq.delivery or boq.edit
        const { checkPermission: checkPermPost } = await import('@/lib/rbac');
        const hasDelivery = await checkPermPost(user.id, 'boq.delivery', project_id);
        const hasEdit = await checkPermPost(user.id, 'boq.edit', project_id);
        if (!hasDelivery.allowed && !hasEdit.allowed) {
            return NextResponse.json({ error: 'Permission denied: boq.delivery or boq.edit required' }, { status: 403 });
        }

        // Determine next Bill Number for this project
        // Scan existing items to count existing bills
        const { data: existingItems } = await supabaseAdmin
            .from('boq_items')
            .select('bill_number, delivery_notes')
            .eq('project_id', project_id);

        let maxBillNum = 0;
        (existingItems || []).forEach((it: any) => {
            const billStr = it.bill_number || it.delivery_notes || '';
            const m = billStr.match(/Bill\s*#(\d+)/i);
            if (m) {
                const num = parseInt(m[1], 10);
                if (num > maxBillNum) maxBillNum = num;
            }
        });

        const newBillNumber = `Bill #${maxBillNum + 1}`;
        const structuredNote = `[${newBillNumber} | ${formattedDate}] ${notes || (bill_type === 'laminate' ? 'Laminate Export Order' : 'BOQ Material Order')}`;

        // 1. Update the items in boq_items
        for (const itemId of item_ids) {
            const updatePayload: Record<string, any> = {
                order_status: 'ordered',
                delivery_notes: structuredNote,
                updated_at: new Date().toISOString()
            };

            // Attempt to update bill_number if column exists
            try {
                await supabaseAdmin
                    .from('boq_items')
                    .update({ ...updatePayload, bill_number: newBillNumber })
                    .eq('id', itemId);
            } catch (_) {
                // Fallback without bill_number column
                await supabaseAdmin
                    .from('boq_items')
                    .update(updatePayload)
                    .eq('id', itemId);
            }
        }

        // 2. Try inserting record into boq_bills table if table exists
        try {
            await supabaseAdmin.from('boq_bills').insert({
                project_id,
                bill_number: newBillNumber,
                bill_type,
                order_date: formattedDate,
                status: 'ordered',
                item_count: item_ids.length,
                delivery_notes: notes || undefined
            });
        } catch (_) {
            // Ignore if table not created yet
        }

        return NextResponse.json({
            success: true,
            bill_number: newBillNumber,
            order_date: formattedDate,
            item_count: item_ids.length
        });
    } catch (err: any) {
        console.error('Error creating bill:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
