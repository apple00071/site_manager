import { NextRequest, NextResponse } from 'next/server';
import { runDailyBriefing } from '@/lib/cron-jobs/dailyBriefing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('key');
    
    // Authorization: Allow Browser Key (?key=...) OR Header
    const authHeader = req.headers.get('authorization');
    const isValidHeader = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isValidQuery = queryKey === process.env.CRON_SECRET;

    if (!isValidHeader && !isValidQuery) {
        console.warn('❌ Cron Authorization Failed');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('🌅 Starting Daily Briefing Cron Job via route');
        const result = await runDailyBriefing();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Daily Briefing Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

