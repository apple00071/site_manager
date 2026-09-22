import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { popup_id } = body;

    if (!popup_id) {
      return NextResponse.json({ error: 'Missing popup_id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('app_popup_dismissals')
      .upsert(
        {
          popup_id,
          user_id: user.id,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: 'popup_id,user_id' }
      );

    if (error) {
      console.warn('Could not record popup dismissal in DB:', error);
      // Even if DB insert fails (e.g. table not migrated yet), return success so client proceeds
      return NextResponse.json({ success: true, localOnly: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error dismissing popup:', error);
    return NextResponse.json({ success: true, localOnly: true });
  }
}
