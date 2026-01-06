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
    const manualJob = searchParams.get('job'); // Allow manual override: ?job=daily-briefing

    const now = new Date();
    const utcHour = now.getUTCHours();

    console.log(`🤖 Master Cron triggered at UTC Hour: ${utcHour}, Manual Job: ${manualJob || 'none'}`);

    try {
        let result;

        // 1. Daily Briefing (Schedule: 2:30 UTC) -> Checks if hour is 2
        if (manualJob === 'daily-briefing' || (manualJob === 'all') || (!manualJob && utcHour === 2)) {
            console.log('Running Daily Briefing...');
            result = await runDailyBriefing();
        }

        // 2. Site Log Reminder (Schedule: 11:30 UTC) -> Checks if hour is 11
        else if (manualJob === 'site-log-reminder' || (manualJob === 'all') || (!manualJob && utcHour === 11)) {
            console.log('Running Site Log Reminder...');
            result = await runSiteLogReminder();
        }

        // 3. Task Reminders (Schedule: 12:30 UTC) -> Checks if hour is 12
        else if (manualJob === 'task-reminders' || (manualJob === 'all') || (!manualJob && utcHour === 12)) {
            console.log('Running Task Reminders...');
            result = await runTaskReminders();
        }

        else {
            return NextResponse.json({
                success: true,
                message: `No job matched for UTC Hour ${utcHour}.`,
                hint: 'Jobs run at 2 (Briefing), 11 (Site Logs), 12 (Tasks).'
            });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Master Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
