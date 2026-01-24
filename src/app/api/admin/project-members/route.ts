import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

import { createNoCacheResponse } from '@/lib/apiHelpers';

// Force dynamic rendering - never cache project member data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

          try {
            const { data: member } = await supabaseAdmin
              .from('users')
              .select('phone_number')
              .eq('id', user_id)
              .single();
            if (member?.phone_number) {
              const origin = (req as Request).headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              const link = `${origin}/dashboard/projects/${project_id}`;
              await sendCustomWhatsAppNotification(
                member.phone_number,
                `👋 You were added to project "${projectData.title}" with new permissions.\n\nOpen: ${link}`
              );
            }
          } catch (_) { }

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

            try {
              const { data: adminUser } = await supabaseAdmin
                .from('users')
                .select('phone_number')
                .eq('id', projectData.created_by)
                .single();
              if (adminUser?.phone_number) {
                const origin = (req as Request).headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const link = `${origin}/dashboard/projects/${project_id}`;
                await sendCustomWhatsAppNotification(
                  adminUser.phone_number,
                  `👥 Project Member Updated\n\n${userData.full_name} was added/updated in project "${projectData.title}"\n\nOpen: ${link}`
                );
              }
            } catch (_) { }
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

export async function GET(req: Request) {
  // During build, return a dummy response
  if (isBuildContext) {
    return NextResponse.json(
      { success: true, members: [], message: 'Build time response - API not available during build' },
      { status: 200 }
    );
  }

  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Fetch project members with user details using admin client
    const { data: members, error } = await supabaseAdmin
      .from('project_members')
      .select(`
        user_id,
        permissions,
        users:user_id (
          id,
          full_name,
          email,
          phone_number,
          designation,
          role,
          username
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error.message) },
        { status: 500 }
      );
    }

    return createNoCacheResponse({ success: true, members: members || [] });
  } catch (err: any) {
    // During build, return a success response to prevent build failures
    if (isBuildContext) {
      return NextResponse.json(
        { success: true, members: [], message: 'Build time error handled' },
        { status: 200 }
      );
    }

    const handled = handleApiError(err);
    return NextResponse.json(handled.error, { status: handled.status });
  }
}

export async function DELETE(req: Request) {
  // During build, return a dummy response
  if (isBuildContext) {
    return NextResponse.json(
      { success: true, message: 'Build time response - API not available during build' },
      { status: 200 }
    );
  }

  try {
    const { user, role, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    const userId = searchParams.get('user_id');

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: 'project_id and user_id are required' },
        { status: 400 }
      );
    }

    // Delete the project member
    const { error } = await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    // During build, return a success response to prevent build failures
    if (isBuildContext) {
      return NextResponse.json(
        { success: true, message: 'Build time error handled' },
        { status: 200 }
      );
    }

    const handled = handleApiError(err);
    return NextResponse.json(handled.error, { status: handled.status });
  }
}
