import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'employee']),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, full_name, role, password } = parsed.data;

    // Create auth user with metadata to populate public.users via trigger
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error.message), code: error.status || 'CREATE_USER_ERROR' },
        { status: error.status || 500 }
      );
    }

    // Optionally ensure profile exists if trigger not installed
    if (data.user) {
      const { id } = data.user;
      await supabaseAdmin
        .from('users')
        .upsert({ id, email, full_name, role }, { onConflict: 'id' });
    }

    return NextResponse.json(
      { success: true, user: { id: data.user?.id, email } },
      { status: 201 }
    );
  } catch (err: any) {
    const handled = handleApiError(err);
    return NextResponse.json(handled.error, { status: handled.status });
  }
}