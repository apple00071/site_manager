import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission, hasAnyPermission, PERMISSION_NODES } from '@/lib/rbac';
import { NotificationService } from '@/lib/notificationService';
import { sendSnagWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const snagSchema = z.object({
    project_id: z.string().uuid(),
    description: z.string().min(1, 'Description is required'),
    location: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    assigned_to_user_id: z.string().uuid().optional().nullable(),
    photos: z.array(z.string()).default([]),
    status: z.enum(['open', 'assigned', 'resolved', 'verified', 'closed']).default('open'),
    resolved_photos: z.array(z.string()).optional(),
    resolved_description: z.string().optional(),
});

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

// GET /api/snags?project_id=xxx
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
        }

        const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('snags')
            .select(`
                *,
                created_by_user:users!snags_created_by_fkey(id, full_name),
                assigned_to_user:users!snags_assigned_to_user_id_fkey(id, full_name)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            // If table doesn't exist yet, return empty array instead of crashing
            if (error.code === '42P01') {
                return NextResponse.json({ snags: [], error: 'Table not found - Run migration' });
            }
            console.error('Error fetching snags:', error);
            return NextResponse.json({ error: 'Failed to fetch snags' }, { status: 500 });
        }

        return NextResponse.json({ snags: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/snags - Create Snag
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validationResult = snagSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { project_id, assigned_to_user_id, ...snagData } = validationResult.data;

        // RBAC: Check snags.create permission
        const permResult = await verifyPermission(user.id, PERMISSION_NODES.SNAGS_CREATE, project_id);
        if (!permResult.allowed) {
            return NextResponse.json({ error: permResult.message }, { status: 403 });
        }

        // Create Snag
        const { data, error } = await supabaseAdmin
            .from('snags')
            .insert({
                ...snagData,
                project_id,
                created_by: user.id,
                assigned_to_user_id: assigned_to_user_id || null,
                status: assigned_to_user_id ? 'assigned' : 'open',
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating snag:', error);
            return NextResponse.json({ error: 'Failed to create snag' }, { status: 500 });
        }

        // --- NOTIFICATIONS ---
        try {
            // Get project and user details for notification
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('title')
                .eq('id', project_id)
                .single();

            const description = snagData.description || 'New snag reported';
            const projectName = project?.title || 'Unknown Project';

            // 1. Notify Assigned User (if any)
            if (assigned_to_user_id) {
                const { data: assignee } = await supabaseAdmin
                    .from('users')
                    .select('full_name, phone_number')
                    .eq('id', assigned_to_user_id)
                    .single();

                if (assignee) {
                    // In-app
                    await NotificationService.notifySnagAssigned(assigned_to_user_id, description, projectName);

                    // WhatsApp
                    if (assignee.phone_number) {
                        await sendSnagWhatsAppNotification(assignee.phone_number, description, projectName, 'assigned');
                    }
                }
            } else {
                // Notify Admins if no one is assigned? 
                // Typically you notify the relevant project manager or admins.
                // For now, let's notify the creator that it was reported successfully (handled by frontend)
            }
        } catch (notifError) {
            console.error('Error sending snag creation notifications:', notifError);
            // Don't fail the request if notification fails
        }

        return NextResponse.json({ snag: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/snags - Update Snag
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, action, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Snag ID is required' }, { status: 400 });
        }

        // Get existing snag
        const { data: existing } = await supabaseAdmin
            .from('snags')
            .select('project_id, status')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
        }

        let finalUpdates = { ...updates };

        // Handle Status Transitions with RBAC checks
        if (action === 'assign' && updates.assigned_to_user_id) {
            finalUpdates.status = 'assigned';
        } else if (action === 'resolve') {
            // RBAC: Check snags.resolve permission
            const canResolve = await hasAnyPermission(user.id, [PERMISSION_NODES.SNAGS_RESOLVE, PERMISSION_NODES.SNAGS_VERIFY], existing.project_id);
            if (!canResolve) {
                return NextResponse.json({ error: 'Permission denied: snag.resolve required' }, { status: 403 });
            }
            finalUpdates.status = 'resolved';
            finalUpdates.resolved_at = new Date().toISOString();
            if (updates.resolved_photos) {
                finalUpdates.resolved_photos = updates.resolved_photos;
            }
            if (updates.resolved_description) {
                finalUpdates.resolved_description = updates.resolved_description;
            }
        } else if (action === 'verify') {
            // RBAC: Check snags.verify permission
            const permResult = await verifyPermission(user.id, PERMISSION_NODES.SNAGS_VERIFY, existing.project_id);
            if (!permResult.allowed) {
                return NextResponse.json({ error: permResult.message }, { status: 403 });
            }
            finalUpdates.status = 'verified';
        } else if (action === 'close') {
            // RBAC: Check snags.verify permission (close is a verify-level action)
            const permResult = await verifyPermission(user.id, PERMISSION_NODES.SNAGS_VERIFY, existing.project_id);
            if (!permResult.allowed) {
                return NextResponse.json({ error: permResult.message }, { status: 403 });
            }
            finalUpdates.status = 'closed';
            finalUpdates.closed_at = new Date().toISOString();
        } else if (action === 'reopen') {
            finalUpdates.status = 'open';
            finalUpdates.resolved_at = null;
            finalUpdates.closed_at = null;
        }

        const { data, error } = await supabaseAdmin
            .from('snags')
            .update(finalUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating snag:', error);
            return NextResponse.json({ error: 'Failed to update snag' }, { status: 500 });
        }

        // --- NOTIFICATIONS ---
        try {
            // Get project and creator details for notification
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('title, created_by')
                .eq('id', existing.project_id)
                .single();

            const description = updates.description || existing.description || 'Snag update';
            const projectName = project?.title || 'Unknown Project';

            if (action === 'assign' && updates.assigned_to_user_id) {
                const { data: assignee } = await supabaseAdmin
                    .from('users')
                    .select('phone_number')
                    .eq('id', updates.assigned_to_user_id)
                    .single();

                await NotificationService.notifySnagAssigned(updates.assigned_to_user_id, description, projectName);
                if (assignee?.phone_number) {
                    await sendSnagWhatsAppNotification(assignee.phone_number, description, projectName, 'assigned');
                }
            } else if (action === 'resolve') {
                // Notify Project Creator or Admins that snag is resolved
                if (project?.created_by) {
                    const { data: creator } = await supabaseAdmin
                        .from('users')
                        .select('phone_number')
                        .eq('id', project.created_by)
                        .single();

                    await NotificationService.notifySnagResolved(project.created_by, description, projectName);
                    if (creator?.phone_number) {
                        await sendSnagWhatsAppNotification(creator.phone_number, description, projectName, 'resolved');
                    }
                }
            } else if (action === 'verify' || action === 'close') {
                // Notify Assignee that their work was verified/closed
                if (existing.assigned_to_user_id) {
                    const { data: assignee } = await supabaseAdmin
                        .from('users')
                        .select('phone_number')
                        .eq('id', existing.assigned_to_user_id)
                        .single();

                    await NotificationService.notifySnagVerified(existing.assigned_to_user_id, description, projectName);
                    if (assignee?.phone_number) {
                        await sendSnagWhatsAppNotification(assignee.phone_number, description, projectName, action);
                    }
                }
            }
        } catch (notifError) {
            console.error('Error sending snag update notifications:', notifError);
        }

        return NextResponse.json({ snag: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
