import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

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

        // Handle Status Transitions
        if (action === 'assign' && updates.assigned_to_user_id) {
            finalUpdates.status = 'assigned';
        } else if (action === 'resolve') {
            finalUpdates.status = 'resolved';
            finalUpdates.resolved_at = new Date().toISOString();
            if (updates.resolved_photos) {
                finalUpdates.resolved_photos = updates.resolved_photos;
            }
            if (updates.resolved_description) {
                finalUpdates.resolved_description = updates.resolved_description;
            }
        } else if (action === 'verify') {
            if (role !== 'admin') {
                return NextResponse.json({ error: 'Only admin can verify snags' }, { status: 403 });
            }
            finalUpdates.status = 'verified';
        } else if (action === 'close') {
            if (role !== 'admin') {
                return NextResponse.json({ error: 'Only admin can close snags' }, { status: 403 });
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

        return NextResponse.json({ snag: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
