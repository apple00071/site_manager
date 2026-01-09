import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission, hasAnyPermission, PERMISSION_NODES } from '@/lib/rbac';
import { NotificationService } from '@/lib/notificationService';
import { sendSnagWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const snagSchema = z.object({
    project_id: z.string().uuid().optional().nullable(),
    site_name: z.string().optional().nullable(),
    client_name: z.string().optional().nullable(),
    customer_phone: z.string().optional().nullable(),
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
async function checkProjectAccess(userId: string, projectId: string | null, userRole: string) {
    if (!projectId) return true; // Global/Unassigned snags accessible to all auth users? Or just admin/creator?
    if (userRole === 'admin') return true;
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

// GET /api/snags?project_id=xxx OR /api/snags?all=true
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('project_id');
        const fetchAll = searchParams.get('all') === 'true';

        // NOTE: If both missing, maybe return user's created snags or empty?
        // Current logic requires one.
        if (!projectId && !fetchAll) {
            return NextResponse.json({ error: 'project_id or all=true is required' }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('snags')
            .select(`
                *,
                created_by_user:users!snags_created_by_fkey(id, full_name),
                assigned_to_user:users!snags_assigned_to_user_id_fkey(id, full_name),
                project:projects(id, title)
            `)
            .order('created_at', { ascending: false });

        if (projectId) {
            // Check specific project access
            const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
            if (!hasAccess) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
            query = query.eq('project_id', projectId);
        } else if (fetchAll) {
            // Fetch all accessible projects AND unassigned snags created by user?
            if (role !== 'admin') {
                // Get projects user is a member of
                const { data: members } = await supabaseAdmin
                    .from('project_members')
                    .select('project_id')
                    .eq('user_id', user.id);

                const projectIds = members?.map((m: { project_id: string }) => m.project_id) || [];

                // Filter Logic:
                // 1. Snags in projects user is member of
                // 2. Snags assigned to user (regardless of project)
                // 3. Snags created by user (regardless of project)

                let orConditions = [
                    `assigned_to_user_id.eq.${user.id}`,
                    `created_by.eq.${user.id}`
                ];

                if (projectIds.length > 0) {
                    orConditions.push(`project_id.in.(${projectIds.join(',')})`);
                }

                // If project_id is null (global snag) and user is not admin,
                // they only see it if assigned or created by them.
                // The OR condition handles this implicitly because we check all 3 conditions.

                query = query.or(orConditions.join(','));
            }
        }

        const { data, error } = await query;

        if (error) {
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

        const { project_id, assigned_to_user_id, site_name, customer_phone, ...snagData } = validationResult.data;

        // RBAC: Check snags.create permission
        const permResult = await verifyPermission(
            user.id,
            PERMISSION_NODES.SNAGS_CREATE,
            project_id || undefined
        );

        if (!permResult.allowed) {
            return NextResponse.json({ error: permResult.message }, { status: 403 });
        }

        // Create Snag
        const { data, error } = await supabaseAdmin
            .from('snags')
            .insert({
                ...snagData,
                project_id: project_id || null,
                site_name: site_name || null,
                customer_phone: customer_phone || null,
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
            let contextName = site_name || 'General Snag';
            if (project_id) {
                const { data: project } = await supabaseAdmin
                    .from('projects')
                    .select('title')
                    .eq('id', project_id)
                    .single();
                if (project) contextName = project.title;
            }

            const description = snagData.description || 'New snag reported';

            if (assigned_to_user_id) {
                await NotificationService.notifySnagAssigned(
                    assigned_to_user_id,
                    description,
                    contextName
                );
            }
        } catch (notifError) {
            console.error('Error sending snag creation notifications:', notifError);
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
            const description = updates.description || existing.description || 'Snag update';
            let contextName = existing.site_name || 'General Snag';

            if (existing.project_id) {
                const { data: project } = await supabaseAdmin
                    .from('projects')
                    .select('title, created_by')
                    .eq('id', existing.project_id)
                    .single();
                if (project) contextName = project.title;
            }

            if (action === 'assign' && updates.assigned_to_user_id) {
                await NotificationService.notifySnagAssigned(updates.assigned_to_user_id, description, contextName);
            } else if (action === 'resolve') {
                // If it's a project snag, notify project creator. 
                // If it's a global site snag, who to notify? Maybe all admins or creator?
                // For now, only notify if project exists.
                const { data: project } = await supabaseAdmin
                    .from('projects')
                    .select('created_by')
                    .eq('id', existing.project_id)
                    .single();

                if (project?.created_by) {
                    await NotificationService.notifySnagResolved(project.created_by, description, contextName);
                }
            } else if ((action === 'verify' || action === 'close') && existing.assigned_to_user_id) {
                await NotificationService.notifySnagVerified(existing.assigned_to_user_id, description, contextName);
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
