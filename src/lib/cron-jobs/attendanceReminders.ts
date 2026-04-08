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

/**
 * Auto Punch-Out (Midnight IST)
 * Automatically closes any open attendance records from previous days
 */
export async function runAutoPunchOut() {
    console.log('⏰ Starting Auto Punch-Out Logic');

    const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }).split(',')[0];
    const [month, day, year] = todayStr.split('/');
    const currentISTDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // 1. Find all records where check_out is null and date < currentISTDate
    const { data: openRecords, error: findError } = await supabaseAdmin
        .from('attendance')
        .select('id, date, user_id')
        .is('check_out', null)
        .lt('date', currentISTDate);

    if (findError) {
        console.error('Error finding open records for auto-close:', findError);
        throw findError;
    }

    if (!openRecords || openRecords.length === 0) {
        return { success: true, message: 'No open records to auto-close' };
    }

    console.log(`📝 Auto-closing ${openRecords.length} records`);

    const updates = openRecords.map((record: any) => {
        // Set check_out to 18:00:00 (6 PM) of the record's date in IST
        const checkOutIST = `${record.date}T18:00:00+05:30`;
        
        return supabaseAdmin
            .from('attendance')
            .update({
                check_out: new Date(checkOutIST).toISOString(),
                status: 'approved',
                admin_comments: 'Punch by next day'
            })
            .eq('id', record.id);
    });

    const results = await Promise.allSettled(updates);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { 
        success: true, 
        message: `Auto-closed ${succeeded} records, ${failed} failed`,
        details: { succeeded, failed }
    };
}
