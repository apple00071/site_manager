import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const defaultChecklistItems = [
    { room_name: 'Living Room', item_name: 'Wall paint and finish' },
    { room_name: 'Living Room', item_name: 'Flooring condition' },
    { room_name: 'Living Room', item_name: 'Electrical switches and sockets' },
    { room_name: 'Living Room', item_name: 'Doors and windows operation' },
    { room_name: 'Kitchen', item_name: 'Cabinet hinges and channels' },
    { room_name: 'Kitchen', item_name: 'Countertop finish and edges' },
    { room_name: 'Kitchen', item_name: 'Plumbing fixtures and leaks' },
    { room_name: 'Kitchen', item_name: 'Appliance functionality (if any)' },
    { room_name: 'Master Bedroom', item_name: 'Wardrobe finish and sliding/hinges' },
    { room_name: 'Master Bedroom', item_name: 'Wall paint and flooring' },
    { room_name: 'Master Bedroom', item_name: 'Electrical and lighting' },
    { room_name: 'Bathrooms', item_name: 'Water flow and pressure' },
    { room_name: 'Bathrooms', item_name: 'Drainage blocks/slopes' },
    { room_name: 'Bathrooms', item_name: 'Sanitaryware condition' },
    { room_name: 'General', item_name: 'Main door lock and keys' },
    { room_name: 'General', item_name: 'Deep cleaning completed' }
];

export async function POST(req: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { project_id } = body;

        if (!project_id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const checklistData = defaultChecklistItems.map(item => ({
            ...item,
            project_id,
            status: false,
            created_by: user.id,
            updated_by: user.id,
            photos: []
        }));

        let { data, error } = await supabaseAdmin
            .from('handover_checklists')
            .insert(checklistData)
            .select();

        if (error) {
            console.error('Initial error creating default handover checklist:', error);

            // If the error is about the photos column (PGRST204 or similar)
            // try inserting without the photos field as a fallback
            if (error.message?.includes('photos') || error.code === 'PGRST204') {
                console.log('Retrying insertion without photos column...');
                const fallbackData = checklistData.map(({ photos, ...rest }) => rest);
                const { data: retryData, error: retryError } = await supabaseAdmin
                    .from('handover_checklists')
                    .insert(fallbackData)
                    .select();

                if (retryError) {
                    console.error('Retry failed:', retryError);
                    return NextResponse.json({ error: 'Failed to create default checklist' }, { status: 500 });
                }
                data = retryData;
            } else {
                return NextResponse.json({ error: 'Failed to create default checklist' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, items: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error in POST /api/projects/handover-checklists/default:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
