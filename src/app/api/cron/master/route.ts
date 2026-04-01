import { NextRequest, NextResponse } from 'next/server';
import { runDailyBriefing } from '@/lib/cron-jobs/dailyBriefing';
import { runTaskReminders } from '@/lib/cron-jobs/taskReminders';
import { runSiteLogReminder } from '@/lib/cron-jobs/siteLogReminder';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const manualJob = searchParams.get('job');
    const isTest = searchParams.get('test') === 'true';
    const queryKey = searchParams.get('key');
    
    // Authorization: Allow Browser Key (?key=...) OR Header
    const authHeader = req.headers.get('authorization');
    const isValidHeader = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isValidQuery = queryKey === process.env.CRON_SECRET;

    if (!isValidHeader && !isValidQuery) {
        console.warn('❌ Cron Authorization Failed');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();

    console.log(`🤖 Master Cron starting at UTC: ${utcHour}:${utcMin}, Manual Job: ${manualJob || 'none'}`);

    // Results object to track every sub-job
    const results: any = {
        timestamp: now.toISOString(),
        utcTime: `${utcHour}:${utcMin}`,
        executed: [],
        errors: {}
    };

    // Helper: Mark job as completed
    const safeMarkJobCompleted = async (jobName: string) => {
        try {
            if (isTest) return;
            await supabaseAdmin
                .from('cron_job_logs')
                .upsert({
                    job_name: jobName,
                    last_run_at: now.toISOString(),
                    status: 'success'
                });
        } catch (e: any) {
            console.error(`⚠️ Failed to log completion for ${jobName}:`, e.message);
        }
    };

    // Helper: Holiday Check with Safety Net
    const checkSilentMode = async () => {
        try {
            const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const dateString = istDate.toISOString().split('T')[0];
            const { data: holiday } = await supabaseAdmin
                .from('holidays')
                .select('name')
                .eq('date', dateString)
                .maybeSingle();

            return holiday ? { status: true, reason: holiday.name } : { status: false };
        } catch (e: any) {
            console.error('⚠️ Holiday Check Failed (Safety Skip):', e.message);
            return { status: false, error: e.message };
        }
    };

    // Helper: Job Runner with Safety Net
    const runJobSafely = async (jobName: string, jobFn: () => Promise<any>) => {
        try {
            console.log(`🚀 Running Job: ${jobName}`);
            const output = await jobFn();
            results[jobName] = output;
            results.executed.push(jobName);
            await safeMarkJobCompleted(jobName);
        } catch (e: any) {
            console.error(`❌ Job Failed: ${jobName}:`, e.message);
            results.errors[jobName] = e.message;
        }
    };

    // 1. SILENT MODE CHECK
    const silentMode = await checkSilentMode();
    results.silentMode = silentMode.status ? silentMode.reason : false;

    // 2. IMMEDIATE CRITICAL JOBS (Regardless of holiday)
    // Task Reminders - High Precision
    if (!manualJob || manualJob === 'task-reminders' || manualJob === 'all') {
        await runJobSafely('taskReminders', runTaskReminders);
    }

    // 3. SCHEDULED STATUS REPORTS (Only if NOT silenced by holiday)
    if (silentMode.status && !manualJob) {
        console.log(`🔕 Silent Mode: ${silentMode.reason}. Skipping scheduled reports.`);
        return NextResponse.json({ success: true, ...results });
    }

    // A. Daily Briefing: 9:00 AM IST (3:30 AM UTC)
    if (manualJob === 'daily-briefing' || (!manualJob && utcHour === 3 && utcMin >= 30)) {
        await runJobSafely('dailyBriefing', runDailyBriefing);
    }

    // B. Admin Assign Reminder: 10:30 AM IST (5:00 AM UTC)
    if (manualJob === 'admin-assign' || (!manualJob && utcHour === 5 && utcMin < 30)) {
        await runJobSafely('adminAssign', async () => {
            const { runAdminAssignReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            return runAdminAssignReminder();
        });
    }

    // F. Attendance Punch-In Reminder: 10:00 AM IST (4:30 AM UTC)
    if (manualJob === 'attendance-in' || (!manualJob && utcHour === 4 && utcMin >= 30)) {
        await runJobSafely('punchInReminder', async () => {
            const { runPunchInReminder } = await import('@/lib/cron-jobs/attendanceReminders');
            return runPunchInReminder();
        });
    }

    // C. Member Check-up: 1:00 PM IST (7:30 AM UTC)
    if (manualJob === 'member-checkup' || (!manualJob && utcHour === 7 && utcMin >= 30)) {
        await runJobSafely('memberCheckup', async () => {
            const { runMemberCheckupReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            return runMemberCheckupReminder();
        });
    }

    // D. Site Log & DPR Reminder: 5:00 PM IST (11:30 AM UTC)
    if (manualJob === 'site-log-reminder' || (!manualJob && utcHour === 11 && utcMin >= 30)) {
        await runJobSafely('siteLogs', runSiteLogReminder);
    }

    // E. Admin Task Review: 5:30 PM IST (12:00 PM UTC)
    if (manualJob === 'admin-check' || (!manualJob && utcHour === 12 && utcMin < 30)) {
        await runJobSafely('adminCheck', async () => {
            const { runAdminTaskCheckReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
            return runAdminTaskCheckReminder();
        });
    }

    // G. Attendance Punch-Out Reminder: 6:00 PM IST (12:30 PM UTC)
    if (manualJob === 'attendance-out' || (!manualJob && utcHour === 12 && utcMin >= 30)) {
        await runJobSafely('punchOutReminder', async () => {
            const { runPunchOutReminder } = await import('@/lib/cron-jobs/attendanceReminders');
            return runPunchOutReminder();
        });
    }

    // Final Success Response (Even if some jobs had errors)
    return NextResponse.json({
        success: true,
        message: results.executed.length > 0 ? "Processed scheduled jobs" : "No jobs scheduled to run",
        ...results
    }, { status: 200 });
}
