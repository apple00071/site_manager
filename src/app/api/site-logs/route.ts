import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';
import { verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// Helper to convert empty strings to null for date fields
function sanitizeDateFields(data: Record<string, any>): Record<string, any> {
    const dateFields = ['log_date', 'work_start_date', 'estimated_completion_date', 'actual_completion_date'];
    const sanitized = { ...data };
    for (const field of dateFields) {
        if (sanitized[field] === '') {
            sanitized[field] = null;
        }
    }
    return sanitized;
}

const createLogSchema = z.object({
    project_id: z.string().uuid(),
    log_date: z.string(),
    work_description: z.string().min(1, "Description is required"),
    work_start_date: z.string().optional().nullable(),
    estimated_completion_date: z.string().optional().nullable(),
    actual_completion_date: z.string().optional().nullable(),
    labor_count: z.number().min(0).optional(),
    main_worker_name: z.string().optional().nullable(),
    main_worker_phone: z.string().optional().nullable(),
    photos: z.array(z.string()).optional().default([]),
    status: z.enum(['in_progress', 'completed']).optional().default('in_progress'),
});

const updateLogSchema = createLogSchema.partial().extend({
    id: z.string().uuid(),
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const permission = await verifyPermission(user.id, 'site_logs.view', projectId);
        if (!permission.allowed) {
            return NextResponse.json({ error: permission.message }, { status: 403 });
        }

        const { data: logs, error } = await supabaseAdmin
            .from('site_logs')
            .select(`
                *,
                creator:users!site_logs_created_by_fkey(full_name, email)
            `)
            .eq('project_id', projectId)
            .order('log_date', { ascending: false });

        if (error) {
            console.error('Error fetching site logs:', error);
            return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
        }

        return NextResponse.json({ logs });
    } catch (err: any) {
        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}

export async function POST(req: Request) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parseResult = createLogSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: parseResult.error }, { status: 400 });
        }

        const data = parseResult.data;

        const permission = await verifyPermission(user.id, 'site_logs.create', data.project_id);
        if (!permission.allowed) {
            return NextResponse.json({ error: permission.message }, { status: 403 });
        }

        const sanitizedData = sanitizeDateFields(data);

        const { data: log, error } = await supabaseAdmin
            .from('site_logs')
            .insert({
                ...sanitizedData,
                created_by: user.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating site log:', error);
            return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
        }

        return NextResponse.json({ log }, { status: 201 });
    } catch (err: any) {
        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}

export async function PATCH(req: Request) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parseResult = updateLogSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: parseResult.error }, { status: 400 });
        }

        const { id, ...updates } = parseResult.data;

        // Fetch existing to get project_id for permission check
        const { data: existingLog } = await supabaseAdmin
            .from('site_logs')
            .select('project_id')
            .eq('id', id)
            .single();

        if (existingLog) {
            const permission = await verifyPermission(user.id, 'site_logs.edit', existingLog.project_id);
            if (!permission.allowed) {
                return NextResponse.json({ error: permission.message }, { status: 403 });
            }
        }

        const sanitizedUpdates = sanitizeDateFields(updates);

        const { data: log, error } = await supabaseAdmin
            .from('site_logs')
            .update({ ...sanitizedUpdates })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating site log:', error);
            return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
        }

        return NextResponse.json({ log });
    } catch (err: any) {
        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Log ID is required' }, { status: 400 });
        }

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch existing to get project_id for permission check
        const { data: existingLog } = await supabaseAdmin
            .from('site_logs')
            .select('project_id')
            .eq('id', id)
            .single();

        if (existingLog) {
            const permission = await verifyPermission(user.id, 'site_logs.delete', existingLog.project_id);
            if (!permission.allowed) {
                return NextResponse.json({ error: permission.message }, { status: 403 });
            }
        }

        const { error } = await supabaseAdmin
            .from('site_logs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting site log:', error);
            return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}
