import { NextResponse } from 'next/server';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache authentication
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    if ((!username && !email) || !password) {
      return NextResponse.json({ error: 'Username or email and password are required' }, { status: 400 });
    }

    const supabase = await createAuthenticatedClient();

    // Resolve email from username if needed
    let resolvedEmail = email as string | undefined;
    if (!resolvedEmail && username) {
      try {
        const { data: userRow, error: userErr } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('username', username)
          .single();

        if (userErr) {
          // If username column might not exist yet, fallback to treat identifier as email
          if (typeof userErr.message === 'string' && userErr.message.toLowerCase().includes('column')) {
            resolvedEmail = username as string;
          } else {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
          }
        } else if (userRow?.email) {
          resolvedEmail = userRow.email;
        } else {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }
      } catch {
        resolvedEmail = username as string;
      }
    }

    const { data: authResult, error: signInError } = await supabase.auth.signInWithPassword({ 
      email: resolvedEmail as string, 
      password 
    });

    if (signInError) {
      console.error('Supabase sign-in error:', signInError);
      return NextResponse.json({ 
        error: signInError.message || 'Invalid credentials',
        details: signInError.status === 400 ? 'Please check your email and password' : signInError.message
      }, { status: 401 });
    }

    // Get the session to ensure cookies are properly set
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
    }

    return NextResponse.json({ 
      user: authResult.user,
      session: {
        expires_at: session.expires_at,
        refresh_token: !!session.refresh_token
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in login route:', err);
    return NextResponse.json({ 
      error: 'Authentication process failed', 
      details: err?.message || 'Unknown server error' 
    }, { status: 500 });
  }
}
