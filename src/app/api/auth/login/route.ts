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

    const { data, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail as string, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Get the session to ensure cookies are properly set
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
    }

    return NextResponse.json({ user: data.user }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}