import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';

// Check if we're in a build context
const isBuildContext = process.env.NEXT_PHASE === 'phase-production-build';

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
  // During build, return a dummy response
  if (isBuildContext) {
    return NextResponse.json(
      { success: true, member: null, message: 'Build time response - API not available during build' },
      { status: 200 }
    );
  }

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

    // Audit log - only in non-build context
    if (!isBuildContext) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          action: 'permissions_update',
          target_type: 'project',
          target_id: project_id,
          actor_user_id: user_id,
          details: { updated_member_user_id: user_id, permissions },
        });
      } catch (logError: unknown) {
        const errorMessage = logError instanceof Error ? logError.message : 'Unknown error';
        console.error('Failed to log audit:', errorMessage);
      }
    }

    return NextResponse.json({ success: true, member: data }, { status: 200 });
  } catch (err: any) {
    // During build, return a success response to prevent build failures
    if (isBuildContext) {
      return NextResponse.json(
        { success: true, member: null, message: 'Build time error handled' },
        { status: 200 }
      );
    }
    
    const handled = handleApiError(err);
    return NextResponse.json(handled.error, { status: handled.status });
  }
}