import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createNoCacheResponse } from '@/lib/apiHelpers';

// Force dynamic rendering - never cache authentication checks
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete(name);
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return createNoCacheResponse({ authenticated: false }, { status: 200 });
    }

    return createNoCacheResponse({ authenticated: true, user: session.user }, { status: 200 });
  } catch (err: any) {
    return createNoCacheResponse({ error: 'Unexpected error' }, { status: 500 });
  }
}