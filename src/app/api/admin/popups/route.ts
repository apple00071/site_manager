import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

export const dynamic = 'force-dynamic';

async function checkAuthorization(user: any, role?: string | null, requiredPerm: string = PERMISSION_NODES.POPUPS_VIEW): Promise<boolean> {
  if (role === 'admin') return true;
  const designation = (user?.designation || '').toLowerCase();
  if (designation.includes('it')) return true;
  const permCheck = await verifyPermission(user.id, requiredPerm as any);
  return permCheck.allowed;
}

export async function GET(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorized = await checkAuthorization(user, role, PERMISSION_NODES.POPUPS_VIEW);
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: popups, error } = await supabaseAdmin
      .from('app_popups')
      .select(`
        *,
        creator:users!created_by(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet in Supabase
      if (error.code === '42P01') {
        return NextResponse.json([], { status: 200 });
      }
      throw error;
    }

    // Fetch dismissal counts per popup
    const popupIds = (popups || []).map((p: any) => p.id);
    let dismissalCounts: Record<string, number> = {};

    if (popupIds.length > 0) {
      try {
        const { data: dismissals } = await supabaseAdmin
          .from('app_popup_dismissals')
          .select('popup_id')
          .in('popup_id', popupIds);

        if (dismissals) {
          dismissals.forEach((d: any) => {
            dismissalCounts[d.popup_id] = (dismissalCounts[d.popup_id] || 0) + 1;
          });
        }
      } catch (err) {
        console.error('Error fetching dismissal counts:', err);
      }
    }

    const enrichedPopups = (popups || []).map((p: any) => ({
      ...p,
      dismissal_count: dismissalCounts[p.id] || 0,
    }));

    return NextResponse.json(enrichedPopups);
  } catch (error: any) {
    console.error('Error fetching popups:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch popups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorized = await checkAuthorization(user, role, PERMISSION_NODES.POPUPS_MANAGE);
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      message,
      popup_type = 'announcement',
      image_url = null,
      action_label = 'Got it',
      action_url = null,
      target_type = 'all',
      target_roles = [],
      target_user_ids = [],
      is_active = true,
      expires_at = null,
      send_notification = false,
    } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const insertPayload = {
      title: title.trim(),
      message: message.trim(),
      popup_type,
      image_url: image_url?.trim() || null,
      action_label: action_label?.trim() || 'Got it',
      action_url: action_url?.trim() || null,
      target_type,
      target_roles: Array.isArray(target_roles) ? target_roles : [],
      target_user_ids: Array.isArray(target_user_ids) ? target_user_ids : [],
      is_active: Boolean(is_active),
      expires_at: expires_at || null,
      created_by: user.id,
    };

    const { data: newPopup, error } = await supabaseAdmin
      .from('app_popups')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          error: 'The app_popups table does not exist in the database yet. Please run migration 20260922_create_app_popups.sql in Supabase SQL editor.',
        }, { status: 500 });
      }
      throw error;
    }

    // Optional: send in-app notification / push notification to target audience
    if (send_notification) {
      try {
        let recipientIds: string[] = [];
        if (target_type === 'users' && target_user_ids.length > 0) {
          recipientIds = target_user_ids;
        } else if (target_type === 'role' && target_roles.length > 0) {
          const { data: matchedUsers } = await supabaseAdmin
            .from('users')
            .select('id, designation, role')
            .eq('is_active', true);

          if (matchedUsers) {
            recipientIds = matchedUsers
              .filter((u: any) => target_roles.includes(u.designation) || target_roles.includes(u.role))
              .map((u: any) => u.id);
          }
        } else {
          const { data: allActiveUsers } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('is_active', true);
          if (allActiveUsers) {
            recipientIds = allActiveUsers.map((u: any) => u.id);
          }
        }

        if (recipientIds.length > 0) {
          // Send notification to each recipient
          for (const uid of recipientIds) {
            await NotificationService.createNotification({
              userId: uid,
              title: `📢 ${title}`,
              message: message.length > 120 ? message.slice(0, 117) + '...' : message,
              type: 'general',
            });
          }
        }
      } catch (notifErr) {
        console.error('Failed to dispatch background notification for popup:', notifErr);
      }
    }

    return NextResponse.json(newPopup, { status: 201 });
  } catch (error: any) {
    console.error('Error creating popup:', error);
    return NextResponse.json({ error: error.message || 'Failed to create popup' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorized = await checkAuthorization(user, role, PERMISSION_NODES.POPUPS_MANAGE);
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing popup id' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (typeof is_active === 'boolean') {
      updates.is_active = is_active;
    }

    const { data, error } = await supabaseAdmin
      .from('app_popups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating popup:', error);
    return NextResponse.json({ error: error.message || 'Failed to update popup' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorized = await checkAuthorization(user, role, PERMISSION_NODES.POPUPS_MANAGE);
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing popup id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('app_popups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting popup:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete popup' }, { status: 500 });
  }
}
