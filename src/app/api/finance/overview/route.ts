import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

export const dynamic = 'force-dynamic';

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

    // 1. Fetch active projects
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        title,
        customer_name,
        project_budget,
        status,
        unified_status,
        created_at,
        client:client_id (
          id,
          name,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects for finance overview:', projectsError);
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    // 2. Fetch all client payments
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('client_payments')
      .select('id, project_id, amount, payment_date');

    if (paymentsError) {
      console.error('Error fetching client payments for overview:', paymentsError);
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    // 3. Fetch all site expenses from inventory_items
    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from('inventory_items')
      .select('id, project_id, total_cost, bill_approval_status');

    if (expensesError) {
      console.error('Error fetching inventory items for overview:', expensesError);
    }

    // Map payments by project_id
    const paymentsByProject = new Map<string, { total: number; count: number; lastDate: string | null }>();
    (payments || []).forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      const current = paymentsByProject.get(p.project_id) || { total: 0, count: 0, lastDate: null };
      current.total += amt;
      current.count += 1;
      if (!current.lastDate || (p.payment_date && p.payment_date > current.lastDate)) {
        current.lastDate = p.payment_date;
      }
      paymentsByProject.set(p.project_id, current);
    });

    // Map expenses by project_id (exclude rejected bills)
    const expensesByProject = new Map<string, number>();
    (expenses || []).forEach((e: any) => {
      if (e.bill_approval_status === 'rejected') return;
      const cost = Number(e.total_cost) || 0;
      const current = expensesByProject.get(e.project_id) || 0;
      expensesByProject.set(e.project_id, current + cost);
    });

    let totalBudget = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalExpenses = 0;

    const projectBreakdown = (projects || []).map((proj: any) => {
      const budget = Number(proj.project_budget) || 0;
      const pStats = paymentsByProject.get(proj.id) || { total: 0, count: 0, lastDate: null };
      const collected = pStats.total;
      const projectExp = expensesByProject.get(proj.id) || 0;
      const pending = budget > 0 ? Math.max(0, budget - collected) : 0;
      const netMargin = collected - projectExp;
      const collectionRate = budget > 0 ? Math.min(100, Math.round((collected / budget) * 100)) : (collected > 0 ? 100 : 0);

      totalBudget += budget;
      totalCollected += collected;
      totalPending += pending;
      totalExpenses += projectExp;

      return {
        id: proj.id,
        title: proj.title,
        customerName: proj.customer_name || proj.client?.name || 'Unknown Client',
        clientPhone: proj.client?.phone || null,
        status: proj.status || 'pending',
        budget,
        collected,
        pending,
        expenses: projectExp,
        netMargin,
        collectionRate,
        paymentCount: pStats.count,
        lastPaymentDate: pStats.lastDate,
      };
    });

    const kpis = {
      totalBudget,
      totalCollected,
      totalPending,
      totalExpenses,
      netMargin: totalCollected - totalExpenses,
      projectCount: (projects || []).length,
      paymentCount: (payments || []).length,
    };

    return NextResponse.json({ kpis, projects: projectBreakdown });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/finance/overview:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
