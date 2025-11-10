import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper to get current authenticated user
 */
async function getCurrentUser(request: NextRequest) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.user) {
    return { user: null, error: 'Unauthorized' };
  }

  // Get user details including role
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (userError || !userData) {
    return { user: null, error: 'User not found' };
  }

  return { user: userData, error: null };
}

/**
 * POST /api/push-subscription
 * Save or update push notification subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription data is required' }, { status: 400 });
    }

    // Store subscription in database
    // First, check if subscription already exists for this user
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .update({
          subscription_data: subscription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating push subscription:', error);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Subscription updated' });
    } else {
      // Create new subscription
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          subscription_data: subscription,
        });

      if (error) {
        console.error('Error creating push subscription:', error);
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Subscription saved' });
    }
  } catch (error) {
    console.error('Unexpected error in POST /api/push-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/push-subscription
 * Remove push notification subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all subscriptions for this user
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting push subscription:', error);
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/push-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/push-subscription
 * Get current user's push subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Unexpected error in GET /api/push-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

