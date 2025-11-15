import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
    }

    if (identifier.includes('@')) {
      return NextResponse.json({ email: identifier });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('username', identifier)
        .single();

      if (error || !data?.email) {
        return NextResponse.json({ error: 'Username not found' }, { status: 404 });
      }

      return NextResponse.json({ email: data.email });
    } catch {
      // If username column not available yet, assume identifier is email
      return NextResponse.json({ email: identifier });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
