import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { handleApiError } from '@/lib/errorHandler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  date: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const result = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { date } = result.data;
    const selectedDate = date || new Date().toISOString().split('T')[0];

    // 1. Authenticate
    const { user: requester, role, error: authError } = await getAuthUser();
    if (authError || !requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin or the user themselves can view activity
    const isAdmin = role === 'admin';
    if (!isAdmin && requester.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Start and end of the selected day in UTC (standard for our DB timestamps)
    const startOfDay = `${selectedDate}T00:00:00Z`;
    const endOfDay = `${selectedDate}T23:59:59Z`;

    // 2. Fetch Project Updates (Timeline)
    const { data: updates, error: updatesError } = await supabaseAdmin
      .from('project_updates')
      .select(`
        *,
        project:projects(title)
      `)
      .eq('user_id', userId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (updatesError) throw updatesError;

    // 3. Fetch Site Logs (Work Entries)
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('site_logs')
      .select(`
        *,
        project:projects(title)
      `)
      .eq('created_by', userId)
      .gte('log_date', selectedDate) // Using log_date for consistency with manual logs
      .lte('log_date', selectedDate)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    // 4. Combine and format
    const formattedUpdates = (updates || []).map((u: any) => ({
      id: u.id,
      type: 'update',
      project_title: u.project?.title || 'Unknown Project',
      description: u.content,
      photos: u.photos || [],
      timestamp: u.created_at,
      status: u.status,
    }));

    const formattedLogs = (logs || []).map((l: any) => ({
      id: l.id,
      type: 'log',
      project_title: l.project?.title || 'Unknown Project',
      description: l.work_description,
      photos: l.photos || [],
      timestamp: l.created_at,
      status: l.status,
      labor_count: l.labor_count,
    }));

    const combinedActivity = [...formattedUpdates, ...formattedLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      activity: combinedActivity,
      user_id: userId,
      date: selectedDate
    });

  } catch (error: any) {
    console.error('Error in User Activity API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
