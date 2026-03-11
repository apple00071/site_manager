import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*, employee_salary_profiles(*)')
            .limit(5);

        return NextResponse.json({ data, error });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}
