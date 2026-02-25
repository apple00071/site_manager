import { createClient } from '@supabase/supabase-js';

// Setup Supabase admin client for server-side logic
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function calculateWorkingDays(userId: string, month: number, year: number) {
    // Start and end dates for the given month
    const startDate = new Date(year, month - 1, 1).toISOString();
    // Get the last day of the month by setting day 0 of the *next* month
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // 1. Fetch attendance records for this month
    const { data: attendanceRecords, error: attendanceError } = await supabaseAdmin
        .from('attendance')
        .select('check_in, date')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

    if (attendanceError) {
        console.error('Error fetching attendance for payroll calculation:', attendanceError);
        throw new Error('Failed to fetch attendance records');
    }

    // Calculate totals
    let presentDays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0; // LOP

    if (attendanceRecords) {
        // Since the user has a check_in row for this date, they were present.
        presentDays = attendanceRecords.filter(record => record.check_in).length;
    }

    // 2. Fetch approved leaves for this month to accurately count Paid vs LOP
    const { data: leaveRecords, error: leaveError } = await supabaseAdmin
        .from('leaves')
        .select('start_date, end_date, leave_type, status')
        .eq('user_id', userId)
        .eq('status', 'Approved');

    if (leaveError) {
        console.error('Error fetching leaves for payroll calculation:', leaveError);
        throw new Error('Failed to fetch leave records');
    }

    if (leaveRecords) {
        leaveRecords.forEach(leave => {
            // Check if the leave falls within the current month calculation window
            const leaveStart = new Date(leave.start_date);
            const leaveEnd = new Date(leave.end_date);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59);

            // Simple overlap logic: If the leave overlaps with this month at all
            if (leaveStart <= monthEnd && leaveEnd >= monthStart) {
                // Calculate the number of overlapping days
                const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
                const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

                // Difference in days (inclusive)
                const diffTime = Math.abs(effectiveEnd.getTime() - effectiveStart.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                if (leave.leave_type === 'Paid Leave' || leave.leave_type === 'Casual Leave' || leave.leave_type === 'Sick Leave') {
                    paidLeaves += diffDays;
                } else if (leave.leave_type === 'Loss of Pay (LOP)') {
                    unpaidLeaves += diffDays;
                }
            }
        });
    }

    // Final working days (Present + Paid Leaves + Weekends (if applicable))
    // For standard payroll, usually total days in month - LOP = Paid Days.
    // Or Present + Paid Leaves if hourly/daily rate based.
    // We will assume a Monthly Salary structure, so Working Days = Present + Paid Leaves.
    const totalPaidDays = presentDays + paidLeaves;

    return {
        presentDays,
        paidLeaves,
        unpaidLeaves,
        totalPaidDays,
        totalDaysInMonth: new Date(year, month, 0).getDate()
    };
}
