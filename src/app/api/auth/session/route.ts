import { NextResponse } from 'next/server';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { createAuthenticatedClient } from '@/lib/supabase-server';

// Force dynamic rendering - never cache authentication checks
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return createNoCacheResponse({ authenticated: false }, { status: 200 });
    }

    return createNoCacheResponse({ authenticated: true, user: session.user }, { status: 200 });
  } catch (err: any) {
    return createNoCacheResponse({ error: 'Unexpected error' }, { status: 500 });
  }
}