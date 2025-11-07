import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';
import { NotificationService } from '@/lib/notificationService';

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

    // Notify user of project member assignment
    if (!isBuildContext) {
      try {
        // Get project and user details
        const { data: projectData } = await supabaseAdmin
          .from('projects')
          .select('title, created_by')
          .eq('id', project_id)
          .single();

        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('full_name')
          .eq('id', user_id)
          .single();

        if (projectData && userData) {
          // Notify the user being added to the project
          await NotificationService.createNotification({
            userId: user_id,
            title: 'Added to Project',
            message: `You have been added to project "${projectData.title}" with new permissions`,
            type: 'task_assigned',
            relatedId: project_id,
            relatedType: 'project'
          });

          // Notify admin if they're not the one making the change
          if (projectData.created_by !== user_id) {
            await NotificationService.createNotification({
              userId: projectData.created_by,
              title: 'Project Member Updated',
              message: `${userData.full_name} has been added/updated in project "${projectData.title}"`,
              type: 'project_update',
              relatedId: project_id,
              relatedType: 'project'
            });
          }

          console.log('Project member notifications sent');
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
          action: 'permissions_update',
          target_type: 'project',
          target_id: project_id,
          actor_user_id: user_id,
          details: { updated_member_user_id: user_id, permissions },
        });
      } catch (logError: unknown) {
        const errorMessage = logError instanceof Error ? logError.message : 'Unknown error';
        console.error('Failed to log audit or send notifications:', errorMessage);
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