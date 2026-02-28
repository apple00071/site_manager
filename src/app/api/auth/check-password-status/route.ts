import { NextResponse } from 'next/server';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createAuthenticatedClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Use admin client to bypass RLS
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('password_changed')
            .eq('id', user.id)
            .single();

        if (error) {
            // Column might not exist yet
            return NextResponse.json({ password_changed: true }, { status: 200 });
        }

        return NextResponse.json({ password_changed: data.password_changed ?? true });
    } catch (err: any) {
        return NextResponse.json({ password_changed: true }, { status: 200 });
    }
}
