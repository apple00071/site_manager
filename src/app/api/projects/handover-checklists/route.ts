import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const checklistSchema = z.object({
    project_id: z.string().uuid('Invalid project ID'),
    room_name: z.string().min(1, 'Room name is required'),
    item_name: z.string().min(1, 'Item name is required'),
    status: z.boolean().default(false),
    notes: z.string().optional().nullable(),
    photos: z.array(z.string()).default([]),
});

const updateSchema = z.object({
    status: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    photos: z.array(z.string()).optional(),
});

// GET handler to fetch all checklist items for a project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('project_id');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rely on RLS policies to filter accessible items
        const { data: checklists, error } = await supabaseAdmin
            .from('handover_checklists')
            .select('*')
            .eq('project_id', projectId)
            .order('room_name', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching handover checklists:', error);
            return NextResponse.json({ error: 'Failed to fetch checklists' }, { status: 500 });
        }

        return NextResponse.json({ checklists });
    } catch (error) {
        console.error('Unexpected error in GET /api/projects/handover-checklists:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST handler to create a new checklist item
export async function POST(req: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parsed = checklistSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const checklistData = {
            ...parsed.data,
            created_by: user.id,
            updated_by: user.id,
        };

        let { data, error } = await supabaseAdmin
            .from('handover_checklists')
            .insert([checklistData])
            .select()
            .single();

        if (error) {
            console.error('Initial error creating handover checklist:', error);

            // Fallback for missing photos column in cache
            if (error.code === 'PGRST204' || error.message?.includes('photos')) {
                console.log('Retrying POST without photos field...');
                const { photos, ...rest } = checklistData as any;
                const { data: retryData, error: retryError } = await supabaseAdmin
                    .from('handover_checklists')
                    .insert([rest])
                    .select()
                    .single();

                if (retryError) {
                    console.error('Retry failed:', retryError);
                    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
                }
                data = retryData;
            } else {
                return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, checklist: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error in POST /api/projects/handover-checklists:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH handler to update an existing checklist item
export async function PATCH(req: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, ...updateDataRaw } = body;

        if (!id) {
            return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 });
        }

        const parsed = updateSchema.safeParse(updateDataRaw);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const updateData = {
            ...parsed.data,
            updated_by: user.id,
        };

        let { data, error } = await supabaseAdmin
            .from('handover_checklists')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Initial error updating handover checklist:', error);

            // Fallback for missing photos column in cache
            if ((error.code === 'PGRST204' || error.message?.includes('photos')) && updateData.photos) {
                console.log('Retrying update without photos field...');
                const { photos, ...rest } = updateData;
                const { data: retryData, error: retryError } = await supabaseAdmin
                    .from('handover_checklists')
                    .update(rest)
                    .eq('id', id)
                    .select()
                    .single();

                if (retryError) {
                    console.error('Retry failed:', retryError);
                    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
                }
                data = retryData;
            } else {
                return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, checklist: data });
    } catch (error) {
        console.error('Unexpected error in PATCH /api/projects/handover-checklists:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE handler
export async function DELETE(req: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('handover_checklists')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting handover checklist:', error);
            return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error in DELETE /api/projects/handover-checklists:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
