import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateWorkingDays } from '@/lib/payrollUtils';

// Initialize a Supabase client with the service role key to bypass RLS for admin tasks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// GET: Fetch all payrolls or a specific user's payrolls
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        let query = supabaseAdmin.from('payrolls').select(`
      *,
      users:user_id ( full_name, role, designation )
    `).order('created_at', { ascending: false });

        if (userId) query = query.eq('user_id', userId);
        if (month) query = query.eq('month', parseInt(month));
        if (year) query = query.eq('year', parseInt(year));

        const { data, error } = await query;

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching payrolls:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Generate a new payroll for a user for a specific month
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, month, year, adminId } = body;

        if (!month || !year) {
            return NextResponse.json({ error: 'Missing required parameters (month/year)' }, { status: 400 });
        }

        const userIdsToProcess = userId === 'all'
            ? (await (async () => {
                const { data } = await supabaseAdmin.from('users').select('id').eq('role', 'employee');
                return data?.map(u => u.id) || [];
            })())
            : userId ? [userId] : [];

        if (userIdsToProcess.length === 0) {
            return NextResponse.json({ error: 'No employees found to process or missing userId' }, { status: 400 });
        }

        const results = [];
        for (const targetUserId of userIdsToProcess) {
            // Check if payroll already exists for this user/month/year
            const { data: existing } = await supabaseAdmin
                .from('payrolls')
                .select('id')
                .eq('user_id', targetUserId)
                .eq('month', parseInt(month))
                .eq('year', parseInt(year))
                .maybeSingle();

            if (existing) {
                if (userId !== 'all') {
                    return NextResponse.json({ error: 'Payroll already generated for this user for the specified month/year.' }, { status: 409 });
                }
                continue; // Skip in batch mode
            }

            // 1. Fetch Salary Profile
            const { data: salaryProfile, error: profileError } = await supabaseAdmin
                .from('employee_salary_profiles')
                .select('*')
                .eq('user_id', targetUserId)
                .single();

            if (profileError || !salaryProfile) {
                if (userId !== 'all') {
                    const msg = profileError?.code === 'PGRST116'
                        ? 'User does not have a configured salary profile.'
                        : `Failed to fetch salary profile: ${profileError?.message}`;
                    return NextResponse.json({ error: msg }, { status: 400 });
                }
                continue; // Skip in batch mode
            }

            // 2. Fetch Attendance and Leaves
            const attendanceStats = await calculateWorkingDays(targetUserId, month, year);

            // 3. Calculate Pay Logic
            const baseSalary = parseFloat(salaryProfile.base_salary) || 0;
            const allowanceBreakdown = salaryProfile.allowances || {};
            let totalAllowances = 0;
            for (const key in allowanceBreakdown) {
                totalAllowances += parseFloat(allowanceBreakdown[key]) || 0;
            }

            const deductionBreakdown = salaryProfile.deductions || {};
            let totalDeductions = 0;
            for (const key in deductionBreakdown) {
                totalDeductions += parseFloat(deductionBreakdown[key]) || 0;
            }

            const totalExpectedSalary = baseSalary + totalAllowances;
            const perDaySalary = totalExpectedSalary / attendanceStats.totalDaysInMonth;
            const lopDeductions = perDaySalary * attendanceStats.unpaidLeaves;
            const netPay = (baseSalary + totalAllowances) - totalDeductions - lopDeductions;

            // 4. Create record
            const payrollRecord = {
                user_id: targetUserId,
                month: parseInt(month),
                year: parseInt(year),
                total_days: attendanceStats.totalDaysInMonth,
                worked_days: attendanceStats.presentDays,
                paid_leaves: attendanceStats.paidLeaves,
                unpaid_leaves: attendanceStats.unpaidLeaves,
                base_pay_earned: parseFloat(baseSalary.toFixed(2)),
                allowances_earned: parseFloat(totalAllowances.toFixed(2)),
                deductions: parseFloat((totalDeductions + lopDeductions).toFixed(2)),
                net_pay: parseFloat(netPay.toFixed(2)),
                status: 'draft',
                processed_by: adminId,
                processed_at: new Date().toISOString()
            };

            const { data: generatedPayroll, error: insertError } = await supabaseAdmin
                .from('payrolls')
                .insert([payrollRecord])
                .select()
                .single();

            if (!insertError) {
                results.push(generatedPayroll);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${results.length} payroll(s)`,
            count: results.length,
            payrolls: results
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error generating payroll batch:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update the status of a payroll (e.g. Generated -> Paid)
export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const urlId = searchParams.get('id');

        const body = await request.json();
        const { id, status, paymentDate, notes } = body;

        const finalId = id || urlId;

        if (!finalId || !status) {
            return NextResponse.json({ error: 'Missing required parameters (id or status)' }, { status: 400 });
        }

        const updates: any = { status };
        if (paymentDate) updates.payment_date = paymentDate;
        if (notes !== undefined) updates.notes = notes;

        const { data, error } = await supabaseAdmin
            .from('payrolls')
            .update(updates)
            .eq('id', finalId)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, payroll: data });
    } catch (error: any) {
        console.error('Error updating payroll status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove a generated payroll
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('payrolls')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting payroll:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
