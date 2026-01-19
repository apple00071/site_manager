import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Fetch existing access token for project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { data, error } = await supabaseAdmin
            .from('project_client_access')
            .select('*')
            .eq('project_id', id)
            .maybeSingle();

        if (error) {
            if (error.code === '42P01') {
                return NextResponse.json({ error: 'Table not found. Please run migration.', tableMissing: true }, { status: 404 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ access: data });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Generate or Reset access token
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { data, error } = await supabaseAdmin
            .from('project_client_access')
            .upsert({
                project_id: projectId,
                token: crypto.randomUUID(),
                is_active: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'project_id' })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ access: data });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Toggle active status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { is_active } = body;

        const { data, error } = await supabaseAdmin
            .from('project_client_access')
            .update({ is_active, updated_at: new Date().toISOString() })
            .eq('project_id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ access: data });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
