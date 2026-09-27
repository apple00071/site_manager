import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const supplierSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact_name: z.string().optional().nullable(),
    contact_email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
    contact_phone: z.string().optional().nullable(),
    vendor_type: z.string().optional().nullable(),
    trade_category: z.string().optional().nullable(),
    wage_type: z.string().optional().nullable(),
    daily_wage: z.coerce.number().min(0).optional().nullable(),
    upi_id: z.string().optional().nullable(),
    rating: z.number().optional().nullable(),
    gst_number: z.string().optional().nullable(),
    pan_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    bank_name: z.string().optional().nullable(),
    bank_account_number: z.string().optional().nullable(),
    bank_ifsc: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    id_proof_url: z.string().optional().nullable(),
    documents: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).optional().nullable(),
    is_active: z.boolean().optional(),
});

function parseWageMeta(row: any) {
    if (!row) return row;
    let wage_type = row.wage_type ?? null;
    let daily_wage = row.daily_wage ?? null;
    let upi_id = row.upi_id ?? null;
    let id_proof_url = row.id_proof_url ?? null;
    let documents: Array<{ name: string; url: string }> = [];
    let notes = row.notes ?? '';

    if (notes && notes.includes('<!--doc_list:')) {
        const docListMatch = notes.match(/<!--doc_list:(.*?)-->/);
        if (docListMatch && docListMatch[1]) {
            try {
                documents = JSON.parse(docListMatch[1]);
            } catch (_) {}
            notes = notes.replace(/<!--doc_list:.*?-->/, '').trim();
        }
    }

    if (notes && notes.includes('<!--doc_url:')) {
        const docMatch = notes.match(/<!--doc_url:(.*?)-->/);
        if (docMatch && docMatch[1]) {
            id_proof_url = id_proof_url || docMatch[1].trim();
            notes = notes.replace(/<!--doc_url:.*?-->/, '').trim();
        }
    }

    if (documents.length === 0 && id_proof_url) {
        documents = [{ name: 'Document / ID Proof', url: id_proof_url }];
    } else if (documents.length > 0 && !id_proof_url) {
        id_proof_url = documents[0].url;
    }

    if ((wage_type === undefined || wage_type === null) && notes && notes.includes('<!--wage_meta:')) {
        try {
            const match = notes.match(/<!--wage_meta:(.*?)-->/);
            if (match && match[1]) {
                const parsed = JSON.parse(match[1]);
                wage_type = parsed.wage_type ?? wage_type;
                daily_wage = parsed.daily_wage ?? daily_wage;
                upi_id = parsed.upi_id ?? upi_id;
                notes = notes.replace(/<!--wage_meta:.*?-->/, '').trim();
            }
        } catch {
            // ignore JSON parse error
        }
    }
    return {
        ...row,
        wage_type: wage_type || 'Daily',
        daily_wage: daily_wage !== null && daily_wage !== undefined ? Number(daily_wage) : 0,
        upi_id: upi_id || '',
        id_proof_url: id_proof_url || '',
        documents,
        notes,
    };
}

// GET /api/suppliers - List all suppliers
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search');
        const activeOnly = searchParams.get('active') === 'true';

        let query = supabaseAdmin
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true });

        if (search) {
            query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%`);
        }

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching suppliers:', error);
            return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
        }

        return NextResponse.json({ suppliers: (data || []).map(parseWageMeta) });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/suppliers - Create a supplier
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Allow admins, or users with supplier.create / project edit permissions
        if (role !== 'admin') {
            const { checkPermission } = await import('@/lib/rbac');
            const hasCreate = await checkPermission(user.id, 'suppliers.create');
            const hasProjEdit = await checkPermission(user.id, 'projects.edit');
            if (!hasCreate.allowed && !hasProjEdit.allowed) {
                return NextResponse.json({ error: 'Admin or supplier create access required' }, { status: 403 });
            }
        }

        const body = await request.json();
        const validationResult = supplierSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { documents, ...rawPayload } = validationResult.data;
        let initialNotes = rawPayload.notes || '';
        if (documents !== undefined) {
            initialNotes = (initialNotes || '').replace(/<!--doc_list:.*?-->/, '').trim();
            if (documents && documents.length > 0) {
                initialNotes = `${initialNotes ? initialNotes + '\n' : ''}<!--doc_list:${JSON.stringify(documents)}-->`.trim();
            }
        }
        let insertPayload: any = { ...rawPayload, notes: initialNotes };
        if (documents && documents.length > 0 && !insertPayload.id_proof_url) {
            insertPayload.id_proof_url = documents[0].url;
        }

        let { data, error } = await supabaseAdmin
            .from('suppliers')
            .insert({
                ...insertPayload,
                created_by: user.id,
            })
            .select()
            .single();

        // Graceful fallback if wage_type / daily_wage / upi_id / id_proof_url columns do not exist in Postgres yet
        if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
            const { wage_type, daily_wage, upi_id, id_proof_url, ...coreData } = insertPayload;
            const wageMeta = { wage_type: wage_type || 'Daily', daily_wage: daily_wage || 0, upi_id: upi_id || '' };
            let existingNotes = (coreData.notes || '').replace(/<!--wage_meta:.*?-->/, '').replace(/<!--doc_url:.*?-->/, '').trim();
            if (id_proof_url) {
                existingNotes = `${existingNotes ? existingNotes + '\n' : ''}<!--doc_url:${id_proof_url}-->`.trim();
            }
            const fallbackNotes = `${existingNotes ? existingNotes + '\n' : ''}<!--wage_meta:${JSON.stringify(wageMeta)}-->`.trim();

            const retry = await supabaseAdmin
                .from('suppliers')
                .insert({
                    ...coreData,
                    notes: fallbackNotes,
                    created_by: user.id,
                })
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error('Error creating supplier:', error);
            return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
        }

        return NextResponse.json({ supplier: parseWageMeta(data) }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/suppliers - Update a supplier
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            const { checkPermission } = await import('@/lib/rbac');
            const hasEdit = await checkPermission(user.id, 'vendors.edit');
            const hasCreate = await checkPermission(user.id, 'suppliers.create');
            if (!hasEdit.allowed && !hasCreate.allowed) {
                return NextResponse.json({ error: 'Permission denied: vendors.edit required' }, { status: 403 });
            }
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
        }

        const validationResult = supplierSchema.partial().safeParse(updates);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { documents, ...rawUpdates } = validationResult.data;
        let updatePayload: any = { ...rawUpdates };

        if (documents !== undefined) {
            let baseNotes = updatePayload.notes;
            if (baseNotes === undefined) {
                const { data: existingRow } = await supabaseAdmin.from('suppliers').select('notes').eq('id', id).single();
                baseNotes = existingRow?.notes || '';
            }
            let cleanNotes = (baseNotes || '').replace(/<!--doc_list:.*?-->/, '').trim();
            if (documents && documents.length > 0) {
                cleanNotes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--doc_list:${JSON.stringify(documents)}-->`.trim();
                if (!updatePayload.id_proof_url) {
                    updatePayload.id_proof_url = documents[0].url;
                }
            } else {
                updatePayload.id_proof_url = null;
            }
            updatePayload.notes = cleanNotes;
        }

        let { data, error } = await supabaseAdmin
            .from('suppliers')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        // Graceful fallback if wage_type / daily_wage / upi_id / id_proof_url columns do not exist in Postgres yet
        if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
            const { wage_type, daily_wage, upi_id, id_proof_url, ...coreUpdates } = updatePayload;
            const wageMeta = {
                wage_type: wage_type !== undefined ? wage_type : 'Daily',
                daily_wage: daily_wage !== undefined ? daily_wage : 0,
                upi_id: upi_id !== undefined ? upi_id : '',
            };

            let baseNotes = coreUpdates.notes;
            if (baseNotes === undefined) {
                const { data: existingRow } = await supabaseAdmin.from('suppliers').select('notes').eq('id', id).single();
                baseNotes = existingRow?.notes || '';
            }
            let cleanNotes = (baseNotes || '').replace(/<!--wage_meta:.*?-->/, '').trim();
            if (id_proof_url !== undefined) {
                cleanNotes = cleanNotes.replace(/<!--doc_url:.*?-->/, '').trim();
                if (id_proof_url) {
                    cleanNotes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--doc_url:${id_proof_url}-->`.trim();
                }
            }
            const fallbackNotes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--wage_meta:${JSON.stringify(wageMeta)}-->`.trim();

            const retry = await supabaseAdmin
                .from('suppliers')
                .update({
                    ...coreUpdates,
                    notes: fallbackNotes,
                })
                .eq('id', id)
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error('Error updating supplier:', error);
            return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
        }

        return NextResponse.json({ supplier: parseWageMeta(data) });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/suppliers?id=xxx - Delete a supplier
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            const { checkPermission } = await import('@/lib/rbac');
            const hasDelete = await checkPermission(user.id, 'vendors.delete');
            if (!hasDelete.allowed) {
                return NextResponse.json({ error: 'Permission denied: vendors.delete required' }, { status: 403 });
            }
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting supplier:', error);
            return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
