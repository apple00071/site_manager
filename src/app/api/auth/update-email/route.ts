import { NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createAuthenticatedClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ email });

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to update email' }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error in update-email route:', err);
    return NextResponse.json(
      { error: 'Unexpected error', details: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
