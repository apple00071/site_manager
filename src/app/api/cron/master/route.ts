import { NextRequest, NextResponse } from 'next/server';
import { runDailyBriefing } from '@/lib/cron-jobs/dailyBriefing';
import { runTaskReminders } from '@/lib/cron-jobs/taskReminders';
import { runSiteLogReminder } from '@/lib/cron-jobs/siteLogReminder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const manualJob = searchParams.get('job'); // Allow manual override for testing: ?job=daily-briefing

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();

    console.log(`🤖 Master Cron triggered at UTC: ${utcHour}:${utcMin}, Manual Job: ${manualJob || 'none'}`);

    try {
        const results: any = {
            timestamp: now.toISOString(),
            executed: []
        };

        // 1. ALWAYS Run Immediate Task Reminders (For tasks starting in next 30 mins)
        // This ensures high-precision notifications regardless of the daily reporting schedule.
        if (!manualJob || manualJob === 'task-reminders' || manualJob === 'all') {
            console.log('Running Task Reminders (High Precision)...');
            results.taskReminders = await runTaskReminders();
            results.executed.push('taskReminders');
        }

        // 2. Scheduled Status Reports (IST mapped to UTC)

        // A. Daily Briefing: 9:00 AM IST (3:30 AM UTC)
        if (manualJob === 'daily-briefing' || (!manualJob && utcHour === 3 && utcMin >= 30)) {
            console.log('Running Daily Briefing (9 AM IST)...');
            results.dailyBriefing = await runDailyBriefing();
            results.executed.push('dailyBriefing');
        }

        // B. Admin Assign Reminder: 10:30 AM IST (5:00 AM UTC)
        if (manualJob === 'admin-assign' || (!manualJob && utcHour === 5 && utcMin < 30)) {
            const { runAdminAssignReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            console.log('Running Admin Assign Reminder (10:30 AM IST)...');
            results.adminAssign = await runAdminAssignReminder();
            results.executed.push('adminAssign');
        }

        // C. Member Check-up: 1:00 PM IST (7:30 AM UTC)
        if (manualJob === 'member-checkup' || (!manualJob && utcHour === 7 && utcMin >= 30)) {
            const { runMemberCheckupReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            console.log('Running Member Check-up (1 PM IST)...');
            results.memberCheckup = await runMemberCheckupReminder();
            results.executed.push('memberCheckup');
        }

        // D. Site Log & DPR Reminder: 5:00 PM IST (11:30 AM UTC)
        if (manualJob === 'site-log-reminder' || (!manualJob && utcHour === 11 && utcMin >= 30)) {
            console.log('Running Site Log & DPR Reminder (5 PM IST)...');
            results.siteLogs = await runSiteLogReminder();
            results.executed.push('siteLogs');
        }

        // E. Admin Task Review: 5:30 PM IST (12:00 PM UTC)
        if (manualJob === 'admin-check' || (!manualJob && utcHour === 12 && utcMin < 30)) {
            const { runAdminTaskCheckReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            console.log('Running Admin Review (5:30 PM IST)...');
            results.adminCheck = await runAdminTaskCheckReminder();
            results.executed.push('adminCheck');
        }

        if (results.executed.length === 0) {
            return NextResponse.json({
                success: true,
                message: `No major status reports scheduled for UTC ${utcHour}:${utcMin}.`,
                taskReminders: results.taskReminders
            });
        }

        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('Master Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
