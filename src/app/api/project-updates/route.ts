import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache project updates
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas
const createUpdateSchema = z.object({
  project_id: z.string().uuid(),
  update_date: z.string(), // ISO date string
  description: z.string().min(1),
  photos: z.array(z.string()).optional().default([]),
  audio_url: z.string().optional().nullable(),
});

const updateUpdateSchema = z.object({
  id: z.string().uuid(),
  update_date: z.string().optional(),
  description: z.string().min(1).optional(),
  photos: z.array(z.string()).optional(),
  audio_url: z.string().optional().nullable(),
});

// GET - Fetch project updates
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch updates with user information
    const { data: updates, error } = await supabaseAdmin
      .from('project_updates')
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .eq('project_id', project_id)
      .order('update_date', { ascending: false });

    if (error) {
      console.error('Error fetching project updates:', error);
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new project update
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const body = await request.json();
    const parsed = createUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, update_date, description, photos, audio_url } = parsed.data;

    console.log('DEBUG API: Received photos:', photos, 'isArray:', Array.isArray(photos), 'length:', photos?.length);

    const { data: update, error } = await supabaseAdmin
      .from('project_updates')
      .insert({
        project_id,
        user_id: userId,
        update_date,
        description,
        photos,
        audio_url,
      })
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .single();

    console.log('DEBUG API: Saved update photos:', update?.photos, 'isArray:', Array.isArray(update?.photos));

    if (error) {
      console.error('Error creating project update:', error);
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
    }

    // Parse mentions and notify users
    try {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('created_by, title')
        .eq('id', project_id)
        .single();

      // 1. Notify admin (existing logic)
      if (projectData && projectData.created_by !== userId) {
        await NotificationService.createNotification({
          userId: projectData.created_by,
          title: 'Project Update Added',
          message: `${userFullName} added an update to project "${projectData.title}"`,
          type: 'project_update',
          relatedId: project_id,
          relatedType: 'project'
        });

        try {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${project_id}`;
          const { data: adminUser } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', projectData.created_by)
            .single();
          if (adminUser?.phone_number) {
            await sendCustomWhatsAppNotification(
              adminUser.phone_number,
              `📣 Project Update\n\n${userFullName} added an update to project "${projectData.title}"\n\nOpen: ${link}`
            );
          }
        } catch (_) { }
      }

      // 2. Notify all project members (except the user who created the update and admin who was already notified)
      try {
        const { data: allProjectMembers } = await supabaseAdmin
          .from('project_members')
          .select(`
            user_id,
            users:user_id (
              id,
              full_name,
              phone_number,
              email
            )
          `)
          .eq('project_id', project_id);

        if (allProjectMembers) {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${project_id}`;

          for (const member of allProjectMembers) {
            const memberUser = member.users as any;
            if (!memberUser || !memberUser.id) continue;

            // Skip the user who created the update
            if (memberUser.id === userId) continue;

            // Skip admin (already notified above)
            if (projectData && memberUser.id === projectData.created_by) continue;

            // Send in-app notification
            await NotificationService.createNotification({
              userId: memberUser.id,
              title: 'Project Update Added',
              message: `${userFullName} added an update to project "${projectData?.title || 'Project'}"`,
              type: 'project_update',
              relatedId: project_id,
              relatedType: 'project'
            });

            // Send WhatsApp notification if phone number exists
            if (memberUser.phone_number) {
              try {
                await sendCustomWhatsAppNotification(
                  memberUser.phone_number,
                  `📣 Project Update\n\n${userFullName} added an update to project "${projectData?.title || 'Project'}"\n\nOpen: ${link}`
                );
              } catch (waError) {
                console.error('Failed to send WhatsApp to member:', waError);
              }
            }
          }
        }
      } catch (memberNotifyError) {
        console.error('Failed to notify project members:', memberNotifyError);
      }

      // 3. Handle @Mentions (additional notification for specifically mentioned users)
      const mentionRegex = /@(\w+)/g;
      const mentions = description.match(mentionRegex);

      if (mentions) {
        const usernames = [...new Set(mentions.map((m: string) => m.substring(1)))];

        // Fetch all project members to resolve fallback mentions (slugified names)
        const { data: projectUsers } = await supabaseAdmin
          .from('project_members')
          .select(`
            user_id,
            users:user_id (
              id,
              full_name,
              phone_number,
              username,
              email
            )
          `)
          .eq('project_id', project_id);

        if (projectUsers) {
          const mentionedUsers = [];

          for (const username of usernames) {
            const matchedUser = projectUsers.find((m: any) => {
              const u = m.users;
              const slug = u.full_name ? u.full_name.toLowerCase().replace(/\s+/g, '') : '';
              const emailPrefix = u.email?.split('@')[0];
              return u.username === username || slug === username || emailPrefix === username;
            });

            if (matchedUser && matchedUser.users) {
              mentionedUsers.push(matchedUser.users);
            }
          }

          if (mentionedUsers.length > 0) {
            for (const mentionedUser of mentionedUsers) {
              // Don't notify self
              if (mentionedUser.id === userId) continue;

              await NotificationService.notifyMention(
                mentionedUser.id,
                userFullName,
                projectData?.title || 'Project',
                description,
                update.id
              );

              if (mentionedUser.phone_number) {
                const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const link = `${origin}/dashboard/projects/${project_id}`;
                await sendCustomWhatsAppNotification(
                  mentionedUser.phone_number,
                  `👋 You were mentioned by ${userFullName} in project "${projectData?.title || 'Project'}":\n\n"${description.substring(0, 100)}${description.length > 100 ? '...' : ''}"\n\nOpen: ${link}`
                );
              }
            }
          }
        }
      }
    } catch (notificationError) {
      console.error('Failed to process notifications:', notificationError);
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update existing project update
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;
    const userFullName =
      user.user_metadata?.full_name ||
      user.app_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const body = await request.json();
    const parsed = updateUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    // Check if user owns this update or is admin
    const { data: existingUpdate, error: fetchError } = await supabaseAdmin
      .from('project_updates')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUpdate) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 });
    }

    // Only allow update if user is the creator or is an admin
    if (existingUpdate.user_id !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own updates' }, { status: 403 });
    }

    const { data: update, error } = await supabaseAdmin
      .from('project_updates')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating project update:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    // WhatsApp notify admin when a project update is modified
    try {
      if (update?.project_id) {
        const { data: projectData } = await supabaseAdmin
          .from('projects')
          .select('created_by, title')
          .eq('id', update.project_id)
          .single();

        if (projectData && projectData.created_by !== userId) {
          const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const link = `${origin}/dashboard/projects/${update.project_id}`;
          const { data: adminUser } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', projectData.created_by)
            .single();
          if (adminUser?.phone_number) {
            await sendCustomWhatsAppNotification(
              adminUser.phone_number,
              `✏️ Project Update Edited\n\n${userFullName} edited an update in project "${projectData.title}"\n\nOpen: ${link}`
            );
          }
        }
      }
    } catch (waErr) {
      console.error('Failed to send WhatsApp for update edit:', waErr);
    }

    return NextResponse.json({ update });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete project update
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Check if user owns this update or is admin
    const { data: existingUpdate, error: fetchError } = await supabaseAdmin
      .from('project_updates')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUpdate) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 });
    }

    // Only allow deletion if user is the creator or is an admin
    if (existingUpdate.user_id !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own updates' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('project_updates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project update:', error);
      return NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

