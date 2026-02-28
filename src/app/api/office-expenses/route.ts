import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { PERMISSION_NODES, verifyPermission } from '@/lib/rbac';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            console.error('supabaseAdmin is not initialized');
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const userIdFilter = searchParams.get('user_id');

        let query = supabaseAdmin
            .from('office_expenses')
            .select(`
                *,
                user:users!user_id(full_name, email)
            `)
            .order('expense_date', { ascending: false });

        if (month && year) {
            if (month === 'all') {
                // Filter by the entire year
                const startDate = `${year}-01-01T00:00:00.000Z`;
                const endDateStr = `${year}-12-31T23:59:59.999Z`;
                query = query.gte('expense_date', startDate).lte('expense_date', endDateStr);
            } else {
                // Calculate start and end of the month in IST (UTC+5:30)
                const startDate = `${year}-${month.padStart(2, '0')}-01T00:00:00.000Z`;
                const endDate = new Date(Number(year), Number(month), 0); // Last day of month
                const endDateStr = `${year}-${month.padStart(2, '0')}-${endDate.getDate()}T23:59:59.999Z`;
                query = query.gte('expense_date', startDate).lte('expense_date', endDateStr);
            }
        }

        // Fetch user data for role check
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (userError) {
            console.error('Error fetching userData:', userError);
        }

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        } else if (userIdFilter) {
            query = query.eq('user_id', userIdFilter);
        }

        const { data: expenses, error } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            expenses: expenses || []
        });
    } catch (error: any) {
        console.error('Error fetching office expenses:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        const body = await request.json();
        const { amount, description, category, expense_date, bill_urls, status, admin_remarks } = body;

        // Check ownership or admin status
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('office_expenses')
            .select('user_id, status')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin && existing.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Only admins can change status or add remarks
        const updateData: any = {};
        if (amount !== undefined) updateData.amount = amount;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (expense_date !== undefined) updateData.expense_date = expense_date;
        if (bill_urls !== undefined) updateData.bill_urls = bill_urls;

        if (isAdmin) {
            if (status !== undefined) {
                updateData.status = status;
                updateData.approved_by = user.id;
                updateData.approved_at = new Date().toISOString();
            }
            if (admin_remarks !== undefined) updateData.admin_remarks = admin_remarks;
        } else {
            // Non-admins can only update if status is pending
            if (existing.status !== 'pending') {
                return NextResponse.json({ error: 'Cannot update non-pending expense' }, { status: 400 });
            }
        }

        const { data: expense, error } = await supabaseAdmin
            .from('office_expenses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // --- NOTIFICATIONS ---
        try {
            if (isAdmin && existing.status !== status && existing.user_id) {
                if (status === 'approved') {
                    await NotificationService.notifyExpenseApproved(
                        existing.user_id,
                        existing.description,
                        existing.amount
                    );
                } else if (status === 'rejected') {
                    await NotificationService.notifyExpenseRejected(
                        existing.user_id,
                        existing.description,
                        existing.amount
                    );
                }
            }
        } catch (notifError) {
            console.error('Error sending expense status notification:', notifError);
        }

        return NextResponse.json({ expense });
    } catch (error: any) {
        console.error('Error updating office expense:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        // Check ownership or admin status
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('office_expenses')
            .select('user_id, status')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin && existing.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!isAdmin && existing.status !== 'pending') {
            return NextResponse.json({ error: 'Cannot delete non-pending expense' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('office_expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting office expense:', error);
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

        // --- NOTIFICATIONS ---
        try {
            // Notify all admins
            const { data: admins } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin');

            const { data: requester } = await supabaseAdmin
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const requesterName = requester?.full_name || 'Unknown User';

            if (admins && admins.length > 0) {
                // Unified notifications
                await Promise.all(admins.map((admin: { id: string }) =>
                    NotificationService.notifyExpenseCreated(
                        admin.id,
                        description,
                        amount,
                        requesterName
                    )
                ));
            }
        } catch (notifError) {
            console.error('Error sending expense creation notification:', notifError);
        }

        return NextResponse.json({ expense }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating office expense:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
