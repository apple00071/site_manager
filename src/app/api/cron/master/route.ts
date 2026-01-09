import { runDailyBriefing } from '@/lib/cron-jobs/dailyBriefing';
import { runTaskReminders } from '@/lib/cron-jobs/taskReminders';
import { runSiteLogReminder } from '@/lib/cron-jobs/siteLogReminder';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const manualJob = searchParams.get('job'); // Allow manual override for testing: ?job=daily-briefing
    const isTest = searchParams.get('test') === 'true';

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();

    console.log(`🤖 Master Cron triggered at UTC: ${utcHour}:${utcMin}, Manual Job: ${manualJob || 'none'}`);

    // Helper to check if a job should run (Once-per-day logic)
    const shouldRunJob = async (jobName: string) => {
        if (manualJob === jobName) return true;
        if (manualJob) return false; // If another manual job requested, skip others

        const { data, error } = await supabaseAdmin
            .from('cron_job_logs')
            .select('last_run_at')
            .eq('job_name', jobName)
            .maybeSingle();

        if (error) {
            console.error(`Error checking job log for ${jobName}:`, error);
            return true; // Fallback to running if check fails
        }

        if (!data) return true;

        const lastRun = new Date(data.last_run_at);
        const isSameDay = lastRun.getUTCDate() === now.getUTCDate() &&
            lastRun.getUTCMonth() === now.getUTCMonth() &&
            lastRun.getUTCFullYear() === now.getUTCFullYear();

        return !isSameDay;
    };

    const markJobCompleted = async (jobName: string) => {
        if (isTest) return; // Don't log test runs
        await supabaseAdmin
            .from('cron_job_logs')
            .upsert({
                job_name: jobName,
                last_run_at: now.toISOString(),
                status: 'success'
            });
    };

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
            if (await shouldRunJob('daily-briefing')) {
                console.log('Running Daily Briefing (9 AM IST)...');
                results.dailyBriefing = await runDailyBriefing();
                results.executed.push('dailyBriefing');
                await markJobCompleted('daily-briefing');
            } else {
                console.log('Daily Briefing skipped (already run today)');
            }
        }

        // B. Admin Assign Reminder: 10:30 AM IST (5:00 AM UTC)
        if (manualJob === 'admin-assign' || (!manualJob && utcHour === 5 && utcMin < 30)) {
            if (await shouldRunJob('admin-assign')) {
                const { runAdminAssignReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
                console.log('Running Admin Assign Reminder (10:30 AM IST)...');
                results.adminAssign = await runAdminAssignReminder();
                results.executed.push('adminAssign');
                await markJobCompleted('admin-assign');
            } else {
                console.log('Admin Assign Reminder skipped (already run today)');
            }
        }

        // C. Member Check-up: 1:00 PM IST (7:30 AM UTC)
        if (manualJob === 'member-checkup' || (!manualJob && utcHour === 7 && utcMin >= 30)) {
            if (await shouldRunJob('member-checkup')) {
                const { runMemberCheckupReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
                console.log('Running Member Check-up (1 PM IST)...');
                results.memberCheckup = await runMemberCheckupReminder();
                results.executed.push('memberCheckup');
                await markJobCompleted('member-checkup');
            } else {
                console.log('Member Check-up skipped (already run today)');
            }
        }

        // D. Site Log & DPR Reminder: 5:00 PM IST (11:30 AM UTC)
        if (manualJob === 'site-log-reminder' || (!manualJob && utcHour === 11 && utcMin >= 30)) {
            if (await shouldRunJob('site-log-reminder')) {
                console.log('Running Site Log & DPR Reminder (5 PM IST)...');
                results.siteLogs = await runSiteLogReminder();
                results.executed.push('siteLogs');
                await markJobCompleted('site-log-reminder');
            } else {
                console.log('Site Log Reminder skipped (already run today)');
            }
        }

        // E. Admin Task Review: 5:30 PM IST (12:00 PM UTC)
        if (manualJob === 'admin-check' || (!manualJob && utcHour === 12 && utcMin < 30)) {
            if (await shouldRunJob('admin-check')) {
                const { runAdminTaskCheckReminder } = await import('@/lib/cron-jobs/dailyStatusReminders');
                console.log('Running Admin Review (5:30 PM IST)...');
                results.adminCheck = await runAdminTaskCheckReminder();
                results.executed.push('adminCheck');
                await markJobCompleted('admin-check');
            } else {
                console.log('Admin Review skipped (already run today)');
            }
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
