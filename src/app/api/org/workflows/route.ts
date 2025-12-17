import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/org/workflows
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgSlug = 'apple-interior';
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const { data: workflows, error } = await supabaseAdmin
            .from('approval_workflows')
            .select('*')
            .eq('org_id', org.id)
            .order('entity_type', { ascending: true })
            .order('min_amount', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ workflows: workflows || [] });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/org/workflows (Create/Add Rule)
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        // Basic validation
        if (!body.entity_type || !body.approver_role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const orgSlug = 'apple-interior';
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const { data, error } = await supabaseAdmin
            .from('approval_workflows')
            .insert({
                ...body,
                org_id: org.id
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ workflow: data }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating workflow:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/org/workflows?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user || role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('approval_workflows')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
