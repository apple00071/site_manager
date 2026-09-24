import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
  project_id: z.string().uuid({ message: 'Valid project ID is required' }),
  amount: z.coerce.number().positive({ message: 'Amount must be greater than 0' }),
  payment_date: z.string().min(1, { message: 'Payment date is required' }),
  milestone_name: z.string().min(1, { message: 'Milestone name is required' }),
  payment_mode: z.string().default('Bank Transfer'),
  reference_number: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GET /api/finance/payments - List client payments with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const userRole = user.user_metadata?.role || user.app_metadata?.role || 'employee';
    const isAdmin = userRole === 'admin';
    if (!isAdmin) {
      const permCheck = await verifyPermission(user.id, PERMISSION_NODES.FINANCE_VIEW);
      if (!permCheck.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;

    let query = supabaseAdmin
      .from('client_payments')
      .select(`
        id,
        project_id,
        amount,
        payment_date,
        milestone_name,
        payment_mode,
        reference_number,
        invoice_number,
        receipt_url,
        notes,
        created_at,
        updated_at,
        recorded_by,
        project:projects!project_id (
          id,
          title,
          project_budget,
          customer_name,
          client:client_id (
            id,
            name,
            phone
          )
        ),
        recorder:users!recorded_by (
          id,
          full_name,
          email
        )
      `)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (startDate) {
      query = query.gte('payment_date', startDate);
    }
    if (endDate) {
      query = query.lte('payment_date', endDate);
    }

    const { data: payments, error } = await query;
    if (error) {
      console.error('Error fetching client payments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optional text search filter
    let filtered = payments || [];
    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      filtered = filtered.filter((p: any) => {
        const projectTitle = p.project?.title?.toLowerCase() || '';
        const customerName = p.project?.customer_name?.toLowerCase() || p.project?.client?.name?.toLowerCase() || '';
        const milestone = p.milestone_name?.toLowerCase() || '';
        const ref = p.reference_number?.toLowerCase() || '';
        const inv = p.invoice_number?.toLowerCase() || '';
        return projectTitle.includes(q) || customerName.includes(q) || milestone.includes(q) || ref.includes(q) || inv.includes(q);
      });
    }

    return NextResponse.json({ payments: filtered });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/finance/payments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/finance/payments - Record a new client payment
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const userRole = user.user_metadata?.role || user.app_metadata?.role || 'employee';
    const isAdmin = userRole === 'admin';
    if (!isAdmin) {
      const permCheck = await verifyPermission(user.id, PERMISSION_NODES.FINANCE_MANAGE);
      if (!permCheck.allowed) {
        return NextResponse.json({ error: 'Forbidden: missing finance.manage permission' }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const paymentData = {
      ...parsed.data,
      recorded_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from('client_payments')
      .insert(paymentData)
      .select(`
        id,
        project_id,
        amount,
        payment_date,
        milestone_name,
        payment_mode,
        reference_number,
        invoice_number,
        receipt_url,
        notes,
        created_at,
        updated_at,
        recorded_by,
        project:projects!project_id (
          id,
          title,
          project_budget,
          customer_name
        )
      `)
      .single();

    if (error) {
      console.error('Error inserting client payment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payment: inserted, success: true }, { status: 201 });
  } catch (err: any) {
    console.error('Unexpected error in POST /api/finance/payments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
