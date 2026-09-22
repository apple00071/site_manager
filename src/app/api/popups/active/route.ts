import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ popup: null }, { status: 200 });
    }

    const nowIso = new Date().toISOString();

    // 1. Fetch active popups
    const { data: popups, error: popupsError } = await supabaseAdmin
      .from('app_popups')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false });

    if (popupsError) {
      // Table may not exist yet or connection issue
      if (popupsError.code === '42P01') {
        return NextResponse.json({ popup: null });
      }
      console.warn('Error fetching active popups:', popupsError);
      return NextResponse.json({ popup: null });
    }

    if (!popups || popups.length === 0) {
      return NextResponse.json({ popup: null });
    }

    // 2. Fetch user's dismissed popups
    let dismissedIds = new Set<string>();
    try {
      const { data: dismissals } = await supabaseAdmin
        .from('app_popup_dismissals')
        .select('popup_id')
        .eq('user_id', user.id);

      if (dismissals) {
        dismissals.forEach((d: any) => dismissedIds.add(d.popup_id));
      }
    } catch (dismissalErr) {
      console.warn('Error fetching dismissals:', dismissalErr);
    }

    // 3. Find the first eligible undismissed popup
    const userRole = role || '';
    const userDesignation = (user as any).designation || '';

    const eligiblePopup = popups.find((p: any) => {
      // Already dismissed?
      if (dismissedIds.has(p.id)) return false;

      // Check audience targeting
      if (p.target_type === 'all') return true;

      if (p.target_type === 'role') {
        const roles: string[] = Array.isArray(p.target_roles) ? p.target_roles : [];
        const matchesRole = roles.some(
          r => r.toLowerCase() === userRole.toLowerCase() ||
               (userDesignation && r.toLowerCase() === userDesignation.toLowerCase())
        );
        return matchesRole;
      }

      if (p.target_type === 'users') {
        const userIds: string[] = Array.isArray(p.target_user_ids) ? p.target_user_ids : [];
        return userIds.includes(user.id);
      }

      return false;
    });

    return NextResponse.json({ popup: eligiblePopup || null });
  } catch (error: any) {
    console.error('Unexpected error in /api/popups/active:', error);
    return NextResponse.json({ popup: null }, { status: 200 });
  }
}
