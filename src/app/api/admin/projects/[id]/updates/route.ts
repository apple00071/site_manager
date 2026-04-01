import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { type NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { description, photos, audio_url } = await request.json();

        if (!description) {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('project_updates')
            .insert({
                project_id: id,
                user_id: user.id,
                description,
                photos,
                audio_url
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating update:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Send notifications
        // Fetch project name first
        const { data: project } = await supabaseAdmin.from('projects').select('title').eq('id', id).single();
        if (project) {
            await NotificationService.notifyStakeholders(id, user.id, { 
                title: 'Project Update', 
                message: `A new update has been posted: ${description.substring(0, 50)}...`, 
                type: 'project_update', 
                relatedId: id, 
                relatedType: 'project' 
            });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
    }
}
