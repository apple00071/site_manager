import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
    invoice_id: z.string().uuid().optional().nullable(),
    project_id: z.string().uuid(),
    supplier_id: z.string().uuid().optional().nullable(),
    amount: z.number().min(0),
    payment_date: z.string(),
    payment_method: z.enum(['bank_transfer', 'cheque', 'cash', 'upi']).optional().nullable(),
    reference_number: z.string().optional().nullable(),
    payment_proof_url: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
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

// GET /api/payments?project_id=xxx
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        const invoiceId = request.nextUrl.searchParams.get('invoice_id');

        if (!projectId && !invoiceId) {
            return NextResponse.json({ error: 'project_id or invoice_id is required' }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('payments')
            .select(`
        *,
        supplier:suppliers(id, name),
        invoice:invoices(id, invoice_number, total_amount),
        created_by_user:users!payments_created_by_fkey(id, full_name)
      `)
            .order('payment_date', { ascending: false });

        if (projectId) {
            const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
            if (!hasAccess) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
            query = query.eq('project_id', projectId);
        }

        if (invoiceId) {
            query = query.eq('invoice_id', invoiceId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching payments:', error);
            return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
        }

        // Calculate stats
        const payments: any[] = data || [];
        const stats = {
            total: payments.length,
            totalAmount: payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
            byMethod: {
                bank_transfer: payments.filter((p: any) => p.payment_method === 'bank_transfer').reduce((sum: number, p: any) => sum + p.amount, 0),
                cheque: payments.filter((p: any) => p.payment_method === 'cheque').reduce((sum: number, p: any) => sum + p.amount, 0),
                cash: payments.filter((p: any) => p.payment_method === 'cash').reduce((sum: number, p: any) => sum + p.amount, 0),
                upi: payments.filter((p: any) => p.payment_method === 'upi').reduce((sum: number, p: any) => sum + p.amount, 0),
            }
        };

        return NextResponse.json({ payments, stats });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/payments - Record payment
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can record payments
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const validationResult = paymentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { invoice_id, project_id } = validationResult.data;

        const { data, error } = await supabaseAdmin
            .from('payments')
            .insert({
                ...validationResult.data,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating payment:', error);
            return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
        }

        // If payment is against an invoice, check if fully paid and update status
        if (invoice_id) {
            const { data: invoice } = await supabaseAdmin
                .from('invoices')
                .select('total_amount')
                .eq('id', invoice_id)
                .single();

            if (invoice) {
                const { data: allPayments } = await supabaseAdmin
                    .from('payments')
                    .select('amount')
                    .eq('invoice_id', invoice_id);

                const totalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);

                if (totalPaid >= invoice.total_amount) {
                    await supabaseAdmin
                        .from('invoices')
                        .update({ status: 'paid' })
                        .eq('id', invoice_id);
                }
            }
        }

        return NextResponse.json({ payment: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/payments - Update payment
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
            return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('payments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating payment:', error);
            return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
        }

        return NextResponse.json({ payment: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/payments?id=xxx
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
            return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting payment:', error);
            return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
