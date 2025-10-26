import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';

const permissionSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  permissions: z.object({
    view: z.boolean(),
    edit: z.boolean(),
    upload: z.boolean(),
    mark_done: z.boolean(),
  }),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = permissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, user_id, permissions } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from('project_members')
      .upsert({ project_id, user_id, permissions }, { onConflict: 'project_id,user_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error.message) },
        { status: 500 }
      );
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'permissions_update',
      target_type: 'project',
      target_id: project_id,
      actor_user_id: user_id, // Note: in real-world, capture admin actor separately
      details: { updated_member_user_id: user_id, permissions },
    });

    return NextResponse.json({ success: true, member: data }, { status: 200 });
  } catch (err: any) {
    const handled = handleApiError(err);
    return NextResponse.json(handled.error, { status: handled.status });
  }
}