import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/push-subscription
 * Save or update push notification subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
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
    const { user, error: authError } = await getAuthUser();
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
    const { user, error: authError } = await getAuthUser();
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

