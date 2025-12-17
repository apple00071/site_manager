import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/org/settings
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // In a real multi-tenant app, we'd find the user's org. 
        // For Phase 1, we assume 'apple-interior'
        const orgSlug = 'apple-interior';

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const { data: settings } = await supabaseAdmin
            .from('org_settings')
            .select('*')
            .eq('org_id', org.id)
            .single();

        // Return default structure if empty (graceful fallback)
        const config = settings?.config || {
            enabled_modules: ['boq', 'procurement', 'snag', 'projects', 'users'],
            budget_enforcement: 'warn',
            approval_strictness: 'relaxed',
            default_project_buckets: ['requirements_upload', 'design_in_progress', 'design_completed', 'execution_in_progress', 'completed']
        };

        return NextResponse.json({ settings: { ...settings, config } });

    } catch (error: any) {
        console.error('Error fetching org settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/org/settings
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { config } = body;

        const orgSlug = 'apple-interior';
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!org) {
            return NextResponse.json({ error: 'Organization not found (Seed DB first)' }, { status: 404 });
        }

        // Upsert settings
        const { data, error } = await supabaseAdmin
            .from('org_settings')
            .upsert({
                org_id: org.id,
                config: config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'org_id' })
            .select()
            .single();

        if (error) {
            console.error('Error updating settings:', error);
            throw error;
        }

        return NextResponse.json({ settings: data });

    } catch (error: any) {
        console.error('Error updating org settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
