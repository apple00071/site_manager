import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase-server';

// Force dynamic rendering - never cache authentication
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const cookieStore = await cookies();

    try {
      const supabase = await createAuthenticatedClient();
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.warn('Supabase signOut error during logout route:', signOutError);
    }

    const allCookies = cookieStore.getAll();
    const isAuthCookie = (name: string) =>
      name.includes('auth-token') || name.startsWith('sb-') || name.includes('supabase');

    allCookies.forEach((c) => {
      if (isAuthCookie(c.name)) {
        cookieStore.set(c.name, '', { path: '/', maxAge: 0, expires: new Date(0) });
        cookieStore.delete(c.name);
      }
    });

    const response = NextResponse.json({ success: true }, { status: 200 });

    allCookies.forEach((c) => {
      if (isAuthCookie(c.name)) {
        response.cookies.set(c.name, '', { path: '/', maxAge: 0, expires: new Date(0) });
      }
    });

    return response;
  } catch (err: any) {
    console.error('Unexpected error in logout route:', err);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
