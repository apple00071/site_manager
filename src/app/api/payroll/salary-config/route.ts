import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { z } from 'zod';

const salaryConfigSchema = z.object({
    user_id: z.string().uuid('Invalid user ID'),
    base_salary: z.coerce.number().min(0),
    hra: z.coerce.number().min(0).default(0),
    special_allowance: z.coerce.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
    try {
        const { user, role, error: authError } = await getAuthUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const parsed = salaryConfigSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid payload', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { user_id, base_salary, hra, special_allowance } = parsed.data;

        // Upsert the profile (update if exists, insert if new)
        const { data, error } = await supabaseAdmin
            .from('employee_salary_profiles')
            .upsert({
                user_id,
                base_salary,
                hra,
                special_allowance,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select('*')
            .single();

        if (error) {
            console.error('Database error upserting salary config:', error);
            return NextResponse.json({ error: 'Failed to save salary configuration' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error /api/payroll/salary-config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
