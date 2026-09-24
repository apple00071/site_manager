import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  payment_date: z.string().min(1).optional(),
  milestone_name: z.string().min(1).optional(),
  payment_mode: z.string().optional(),
  reference_number: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PUT /api/finance/payments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const updateData = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabaseAdmin
      .from('client_payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating client payment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payment: updated, success: true });
  } catch (err: any) {
    console.error('Unexpected error in PUT /api/finance/payments/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/finance/payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from('client_payments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting client payment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unexpected error in DELETE /api/finance/payments/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
