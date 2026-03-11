import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

/**
 * Punch-In Reminder (10:00 AM IST)
 * Notifies employees who haven't punched in yet today
 */
export async function runPunchInReminder() {
    console.log('⏰ Starting Punch-In Reminder Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Get all employees
    const { data: employees, error: employeesError } = await supabaseAdmin
        .from('users')
        .select('id, full_name')
        .eq('role', 'employee');

    if (employeesError) throw employeesError;
    if (!employees || employees.length === 0) return { success: true, message: 'No employees found' };

    // 2. Get today's attendance records
    const { data: attendanceToday } = await supabaseAdmin
        .from('attendance')
        .select('user_id')
        .eq('date', todayStr);

    const punchedInUserIds = new Set(attendanceToday?.map((a: { user_id: string }) => a.user_id) || []);

    // 3. Filter employees who haven't punched in
    const missingPunchUsers = employees.filter((e: { id: string }) => !punchedInUserIds.has(e.id));

    const updates = [];
    for (const user of missingPunchUsers) {
        updates.push(
            NotificationService.createNotification({
                userId: user.id,
                title: 'Punch-In Reminder',
                message: `Good morning ${user.full_name}! Don't forget to punch in for today.`,
                type: 'attendance_appealed', // Reusing type or using general
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent punch-in reminders to ${missingPunchUsers.length} employees` };
}

/**
 * Punch-Out Reminder (6:00 PM IST)
 * Notifies employees who have punched in but not punched out yet today
 */
export async function runPunchOutReminder() {
    console.log('⏰ Starting Punch-Out Reminder Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Get all active attendance records without check_out for today
    const { data: openRecords, error: recordsError } = await supabaseAdmin
        .from('attendance')
        .select('id, user_id, users(full_name)')
        .eq('date', todayStr)
        .is('check_out', null);

    if (recordsError) throw recordsError;
    if (!openRecords || openRecords.length === 0) return { success: true, message: 'No active punch-ins found' };

    const updates = [];
    for (const record of openRecords) {
        const userName = (record.users as any)?.full_name || 'Employee';
        updates.push(
            NotificationService.createNotification({
                userId: record.user_id,
                title: 'Punch-Out Reminder',
                message: `Hi ${userName}! Please remember to punch out before leaving for the day.`,
                type: 'attendance_appealed',
                skipInApp: true
            })
        );
    }

    await Promise.allSettled(updates);
    return { success: true, message: `Sent punch-out reminders to ${openRecords.length} employees` };
}
