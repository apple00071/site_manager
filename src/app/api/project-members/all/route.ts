import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET handler for fetching all project members (for dashboard team overview)
export async function GET() {
    try {
        // Fetch all project members with just the IDs needed for dashboard
        const { data: members, error } = await supabaseAdmin
            .from('project_members')
            .select('project_id, user_id');

        if (error) {
            console.error('Error fetching project members:', error);
            return NextResponse.json(
                { error: 'Failed to fetch project members' },
                { status: 500 }
            );
        }

        return NextResponse.json(members || []);
    } catch (err: any) {
        console.error('Unexpected error in GET /api/project-members/all:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
