import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { createNoCacheResponse } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { user: authUser, error: authError } = await getAuthUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client is not initialized.' },
        { status: 500 }
      );
    }

    // Fetch user details including designation from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Forbidden. User profile not found.' },
        { status: 403 }
      );
    }

    // Authorization check: User must have 'IT' in their designation
    const userDesignation = (user.designation || '').toLowerCase();
    const isITUser = userDesignation.includes('it');

    if (!isITUser) {
      return NextResponse.json(
        { error: 'Forbidden. Access restricted to IT users only.' },
        { status: 403 }
      );
    }

    // 1. Live Active Users (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentActivities, error: recentError } = await supabaseAdmin
      .from('user_activities')
      .select(`
        id,
        path,
        action,
        created_at,
        user_id,
        users:user_id (
          id,
          full_name,
          email,
          role,
          designation
        )
      `)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false });

    if (recentError) {
      console.error('Error fetching recent activities:', recentError);
      return NextResponse.json({ error: recentError.message }, { status: 500 });
    }

    const activeUsersMap = new Map<string, any>();
    for (const act of (recentActivities || [])) {
      if (!act.users) continue;
      const userId = act.user_id;
      if (!activeUsersMap.has(userId)) {
        activeUsersMap.set(userId, {
          user: act.users,
          last_path: act.path,
          last_action: act.action,
          last_active_at: act.created_at
        });
      }
    }
    const liveUsers = Array.from(activeUsersMap.values());

    // 2. Heavy Users (last 24 hours and last 7 days) via database function
    const { data: heavy24h, error: heavy24hError } = await supabaseAdmin.rpc('get_heavy_users', {
      days_limit: 1,
    });

    const { data: heavy7d, error: heavy7dError } = await supabaseAdmin.rpc('get_heavy_users', {
      days_limit: 7,
    });

    if (heavy24hError) {
      console.error('Error fetching heavy users (24h):', heavy24hError);
    }
    if (heavy7dError) {
      console.error('Error fetching heavy users (7d):', heavy7dError);
    }

    // 3. Raw live logs (most recent 100)
    const { data: rawLogs, error: rawLogsError } = await supabaseAdmin
      .from('user_activities')
      .select(`
        id,
        path,
        action,
        created_at,
        users:user_id (
          email,
          full_name,
          designation
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (rawLogsError) {
      console.error('Error fetching raw logs:', rawLogsError);
    }

    return createNoCacheResponse({
      success: true,
      data: {
        liveUsers,
        heavyUsers24h: heavy24h || [],
        heavyUsers7d: heavy7d || [],
        recentLogs: rawLogs || []
      }
    });

  } catch (err: any) {
    console.error('Telemetry API crash:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
