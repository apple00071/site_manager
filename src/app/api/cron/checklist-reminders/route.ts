import { NextRequest, NextResponse } from 'next/server';
import { runChecklistSpecsReminder } from '@/lib/cron-jobs/checklistReminders';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get('key');

  const isValidHeader = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isValidQuery = queryKey === process.env.CRON_SECRET;

  if (!isValidHeader && !isValidQuery && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runChecklistSpecsReminder();
  return NextResponse.json(result);
}
