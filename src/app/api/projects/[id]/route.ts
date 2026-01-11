import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';
import { createNoCacheResponse } from '@/lib/apiHelpers';
import { verifyPermission, PERMISSION_NODES } from '@/lib/rbac';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Check if we're in a build context
const isBuildContext = process.env.NEXT_PHASE === 'phase-production-build';

const updateProjectSchema = z.object({
    // Project Info
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    workflow_stage: z.string().nullable().optional(),
    project_budget: z.number().nullable().optional(),
    project_notes: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    estimated_completion_date: z.string().nullable().optional(),
    actual_completion_date: z.string().nullable().optional(),

    // Customer Details
    customer_name: z.string().optional(),
    phone_number: z.string().optional(),
    alt_phone_number: z.string().nullable().optional(),
    address: z.string().nullable().optional(),

    // Property Details
    property_type: z.string().nullable().optional(),
    apartment_name: z.string().nullable().optional(),
    block_number: z.string().nullable().optional(),
    flat_number: z.string().nullable().optional(),
    floor_number: z.string().nullable().optional(),
    area_sqft: z.number().nullable().optional(),

    // Worker Details
    carpenter_name: z.string().nullable().optional(),
    carpenter_phone: z.string().nullable().optional(),
    electrician_name: z.string().nullable().optional(),
    electrician_phone: z.string().nullable().optional(),
    plumber_name: z.string().nullable().optional(),
    plumber_phone: z.string().nullable().optional(),
    painter_name: z.string().nullable().optional(),
    painter_phone: z.string().nullable().optional(),
    granite_worker_name: z.string().nullable().optional(),
    granite_worker_phone: z.string().nullable().optional(),
    glass_worker_name: z.string().nullable().optional(),
    glass_worker_phone: z.string().nullable().optional(),
});

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (isBuildContext) {
        return NextResponse.json(
            { success: true, message: 'Build time response' },
            { status: 200 }
        );
    }

    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Auth check
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); // 401 Unauthorized
        }

        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return NextResponse.json(
                { error: sanitizeErrorMessage(error.message) },
                { status: 500 }
            );
        }

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ project }, { status: 200 });
    } catch (err: any) {
        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // During build, return a dummy response
    if (isBuildContext) {
        return NextResponse.json(
            { success: true, message: 'Build time response - API not available during build' },
            { status: 200 }
        );
    }

    try {
        const { id } = await params;
        const projectId = id;
        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const parsed = updateProjectSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request data', details: parsed.error.format() },
                { status: 400 }
            );
        }

        // Auth check
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check: only admin or users with projects.edit permission for this project
        const permResult = await verifyPermission(user.id, PERMISSION_NODES.PROJECTS_EDIT, projectId);
        if (!permResult.allowed) {
            return NextResponse.json({ error: permResult.message }, { status: 403 });
        }

        const { data: updatedProject, error } = await supabaseAdmin
            .from('projects')
            .update(parsed.data)
            .eq('id', projectId)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: sanitizeErrorMessage(error.message) },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, project: updatedProject }, { status: 200 });
    } catch (err: any) {
        // During build, return a success response to prevent build failures
        if (isBuildContext) {
            return NextResponse.json(
                { success: true, message: 'Build time error handled' },
                { status: 200 }
            );
        }

        const handled = handleApiError(err);
        return NextResponse.json(handled.error, { status: handled.status });
    }
}
