import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auth helper
async function getAuthUser() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
}

// Get user role
async function getUserRole(userId: string): Promise<string> {
    const { data } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
    return data?.role || '';
}

// Check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;

    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

    return !!data;
}

const ProposalSchema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    selected_items: z.array(z.string().uuid()),
});

// GET /api/proposals - List proposals for project
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
        }

        const userRole = await getUserRole(user.id);
        const hasAccess = await checkProjectAccess(user.id, projectId, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('proposals')
            .select(`
                *,
                created_by_user:users!proposals_created_by_fkey(id, name),
                approved_by_user:users!proposals_approved_by_fkey(id, name)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching proposals:', error);
            return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
        }

        // Get items for each proposal
        const proposalsWithItems = await Promise.all((data || []).map(async (proposal) => {
            if (proposal.selected_items?.length > 0) {
                const { data: items } = await supabaseAdmin
                    .from('boq_items')
                    .select('id, item_name, quantity, rate, amount, status')
                    .in('id', proposal.selected_items);
                return { ...proposal, items: items || [] };
            }
            return { ...proposal, items: [] };
        }));

        return NextResponse.json({ proposals: proposalsWithItems });
    } catch (err) {
        console.error('Proposals GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/proposals - Create proposal
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = await getUserRole(user.id);
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const parsed = ProposalSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }

        const { project_id, title, description, selected_items } = parsed.data;

        // Check access
        const hasAccess = await checkProjectAccess(user.id, project_id, userRole);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Calculate total amount from selected items
        const { data: items } = await supabaseAdmin
            .from('boq_items')
            .select('id, amount')
            .in('id', selected_items);

        const totalAmount = items?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;

        // Create proposal
        const { data: proposal, error: createError } = await supabaseAdmin
            .from('proposals')
            .insert({
                project_id,
                title,
                description,
                selected_items,
                total_amount: totalAmount,
                status: 'draft',
                created_by: user.id,
            })
            .select()
            .single();

        if (createError) {
            console.error('Create proposal error:', createError);
            return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
        }

        return NextResponse.json({ proposal });
    } catch (err) {
        console.error('Proposals POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/proposals - Update proposal (send, approve, reject)
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = await getUserRole(user.id);
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { id, action } = body;

        if (!id) {
            return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
        }

        // Get proposal
        const { data: proposal } = await supabaseAdmin
            .from('proposals')
            .select('*')
            .eq('id', id)
            .single();

        if (!proposal) {
            return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        let updates: any = {};

        if (action === 'send') {
            updates = { status: 'sent', sent_at: new Date().toISOString() };

            // Update BOQ items to 'proposed' status
            if (proposal.selected_items?.length > 0) {
                await supabaseAdmin
                    .from('boq_items')
                    .update({ status: 'proposed' })
                    .in('id', proposal.selected_items);
            }
        } else if (action === 'approve') {
            updates = {
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: user.id
            };

            // Update BOQ items to 'confirmed' status
            if (proposal.selected_items?.length > 0) {
                await supabaseAdmin
                    .from('boq_items')
                    .update({ status: 'confirmed' })
                    .in('id', proposal.selected_items);
            }
        } else if (action === 'reject') {
            updates = {
                status: 'rejected',
                rejection_reason: body.reason || ''
            };

            // Revert BOQ items to 'draft' status
            if (proposal.selected_items?.length > 0) {
                await supabaseAdmin
                    .from('boq_items')
                    .update({ status: 'draft' })
                    .in('id', proposal.selected_items);
            }
        } else {
            // Regular update
            const { title, description, selected_items } = body;
            if (title) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (selected_items) {
                updates.selected_items = selected_items;
                // Recalculate total
                const { data: items } = await supabaseAdmin
                    .from('boq_items')
                    .select('amount')
                    .in('id', selected_items);
                updates.total_amount = items?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
            }
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('proposals')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Update proposal error:', updateError);
            return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
        }

        return NextResponse.json({ proposal: updated });
    } catch (err) {
        console.error('Proposals PATCH error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/proposals
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = await getUserRole(user.id);
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
        }

        // Get proposal to revert items
        const { data: proposal } = await supabaseAdmin
            .from('proposals')
            .select('selected_items')
            .eq('id', id)
            .single();

        // Revert items to draft if proposal had them as proposed
        if (proposal?.selected_items?.length > 0) {
            await supabaseAdmin
                .from('boq_items')
                .update({ status: 'draft' })
                .in('id', proposal.selected_items)
                .eq('status', 'proposed');
        }

        const { error } = await supabaseAdmin
            .from('proposals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete proposal error:', error);
            return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Proposals DELETE error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
