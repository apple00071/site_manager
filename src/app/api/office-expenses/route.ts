import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { PERMISSION_NODES, verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // For list view, we want to see expenses
        // If admin, see all. If employee, maybe only own?
        // Let's check permissions or just filter by user_id if not admin

        let query = supabaseAdmin
            .from('office_expenses')
            .select(`
                *,
                user:users!user_id(full_name, avatar_url)
            `)
            .order('created_at', { ascending: false });

        // If not admin, only show own expenses (simplified version)
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (userData?.role !== 'admin') {
            query = query.eq('user_id', user.id);
        }

        const { data: expenses, error } = await query;

        if (error) throw error;

        return NextResponse.json({ expenses });
    } catch (error: any) {
        console.error('Error fetching office expenses:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const check = await verifyPermission(user.id, PERMISSION_NODES.OFFICE_EXPENSES_CREATE);
        if (!check.allowed) {
            return NextResponse.json({ error: check.message }, { status: 403 });
        }

        const body = await request.json();
        const { amount, description, category, expense_date, bill_urls } = body;

        if (!amount || !description || !category || !expense_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: expense, error } = await supabaseAdmin
            .from('office_expenses')
            .insert({
                user_id: user.id,
                amount,
                description,
                category,
                expense_date,
                bill_urls: bill_urls || [],
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ expense }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating office expense:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
