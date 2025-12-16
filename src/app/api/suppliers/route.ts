import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const supplierSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact_name: z.string().optional().nullable(),
    contact_email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
    contact_phone: z.string().optional().nullable(),
    gst_number: z.string().optional().nullable(),
    pan_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    bank_name: z.string().optional().nullable(),
    bank_account_number: z.string().optional().nullable(),
    bank_ifsc: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
});

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

        return NextResponse.json({ suppliers: data || [] });
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

        // Only admins can create suppliers
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const validationResult = supplierSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .insert({
                ...validationResult.data,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating supplier:', error);
            return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
        }

        return NextResponse.json({ supplier: data }, { status: 201 });
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
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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

        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .update(validationResult.data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating supplier:', error);
            return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
        }

        return NextResponse.json({ supplier: data });
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
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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
