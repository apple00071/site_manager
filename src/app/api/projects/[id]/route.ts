import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { handleApiError, sanitizeErrorMessage } from '@/lib/errorHandler';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { attachProjectCodes } from '@/lib/projectUtils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Check if we're in a build context
const isBuildContext = process.env.NEXT_PHASE === 'phase-production-build';

const updateProjectSchema = z.object({
    // Project Info
    title: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    workflow_stage: z.string().nullable().optional(),
    project_budget: z.coerce.number().nullable().optional(),
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
    area_sqft: z.coerce.number().nullable().optional(),

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
    requirements_pdf_url: z.string().nullable().optional(),

    // Designer / Employee Assignment
    assigned_employee_id: z.string().uuid().optional(),
    designer_id: z.string().uuid().nullable().optional(),
    site_supervisor_id: z.string().uuid().nullable().optional(),
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
            .select(`
                *,
                assigned_employee:assigned_employee_id(
                    id,
                    email,
                    name:full_name,
                    designation
                ),
                designer:designer_id(
                    id,
                    email,
                    full_name
                ),
                site_supervisor:site_supervisor_id(
                    id,
                    email,
                    full_name
                ),
                creator:created_by(
                    id,
                    email,
                    full_name,
                    username
                ),
                project_members(
                    user_id,
                    users:user_id(
                        id,
                        email,
                        full_name,
                        designation
                    )
                )
            `)
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

        const projectWithCode = await attachProjectCodes(project);
        return NextResponse.json({ project: projectWithCode }, { status: 200 });
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

        const updatePayload: any = { ...parsed.data };
        if (updatePayload.assigned_employee_id) {
            updatePayload.designer_id = updatePayload.assigned_employee_id;
        }

        // Check if assigned designer changed
        let newDesignerAssigned = false;
        if (updatePayload.assigned_employee_id) {
            const { data: existingProject } = await supabaseAdmin
                .from('projects')
                .select('assigned_employee_id')
                .eq('id', projectId)
                .single();
            if (existingProject && existingProject.assigned_employee_id !== updatePayload.assigned_employee_id) {
                newDesignerAssigned = true;
            }
        }

        // Check if site supervisor changed
        let newSupervisorAssigned = false;
        if (updatePayload.site_supervisor_id) {
            const { data: existingProject } = await supabaseAdmin
                .from('projects')
                .select('site_supervisor_id')
                .eq('id', projectId)
                .single();
            if (existingProject && existingProject.site_supervisor_id !== updatePayload.site_supervisor_id) {
                newSupervisorAssigned = true;
                updatePayload.site_supervisor_assigned_at = new Date().toISOString();
            }
        }

        const { data: updatedProject, error } = await supabaseAdmin
            .from('projects')
            .update(updatePayload)
            .eq('id', projectId)
            .select(`
                *,
                assigned_employee:assigned_employee_id(
                    id,
                    email,
                    name:full_name,
                    designation
                ),
                designer:designer_id(
                    id,
                    email,
                    full_name
                ),
                site_supervisor:site_supervisor_id(
                    id,
                    email,
                    full_name
                ),
                creator:created_by(
                    id,
                    email,
                    full_name,
                    username
                ),
                project_members(
                    user_id,
                    users:user_id(
                        id,
                        email,
                        full_name,
                        designation
                    )
                )
            `)
            .single();

        if (error) {
            return NextResponse.json(
                { error: sanitizeErrorMessage(error.message) },
                { status: 500 }
            );
        }

        // If a new designer was assigned, add to project_members and send notifications
        if (newDesignerAssigned && updatePayload.assigned_employee_id) {
            try {
                await supabaseAdmin
                    .from('project_members')
                    .upsert({
                        project_id: projectId,
                        user_id: updatePayload.assigned_employee_id,
                        role: 'member',
                        permissions: { view: true, edit: true, upload: true, mark_done: true }
                    }, { onConflict: 'project_id,user_id' });

                await NotificationService.createNotification({
                    userId: updatePayload.assigned_employee_id,
                    title: 'New Project Assigned',
                    message: `You have been assigned to project "${updatedProject.title}" for customer ${updatedProject.customer_name}`,
                    type: 'task_assigned',
                    relatedId: projectId,
                    relatedType: 'project'
                });

                const { data: empUser } = await supabaseAdmin
                    .from('users')
                    .select('phone_number')
                    .eq('id', updatePayload.assigned_employee_id)
                    .single();
                if (empUser?.phone_number) {
                    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                    const link = `${origin}/dashboard/projects/${projectId}`;
                    await sendCustomWhatsAppNotification(
                        empUser.phone_number,
                        `🆕 New Project Assigned\n\nYou have been assigned to project "${updatedProject.title}" for customer ${updatedProject.customer_name}\n\nOpen: ${link}`
                    );
                }
            } catch (notifyErr) {
                console.error('Failed to notify newly assigned designer:', notifyErr);
            }
        }

        // If a new site supervisor was assigned, add to project_members and send notifications
        if (newSupervisorAssigned && updatePayload.site_supervisor_id) {
            try {
                await supabaseAdmin
                    .from('project_members')
                    .upsert({
                        project_id: projectId,
                        user_id: updatePayload.site_supervisor_id,
                        role: 'member',
                        permissions: { view: true, edit: true, upload: true, mark_done: true }
                    }, { onConflict: 'project_id,user_id' });

                await NotificationService.createNotification({
                    userId: updatePayload.site_supervisor_id,
                    title: 'Project Assigned',
                    message: `You have been assigned as site supervisor for project: ${updatedProject.title}`,
                    type: 'project_update',
                    relatedId: projectId,
                    relatedType: 'project'
                });

                const { data: supUser } = await supabaseAdmin
                    .from('users')
                    .select('phone_number')
                    .eq('id', updatePayload.site_supervisor_id)
                    .single();
                if (supUser?.phone_number) {
                    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                    const link = `${origin}/dashboard/projects/${projectId}`;
                    await sendCustomWhatsAppNotification(
                        supUser.phone_number,
                        `🏢 Project Assigned\n\nYou have been assigned as site supervisor for project "${updatedProject.title}"\n\nOpen: ${link}`
                    );
                }
            } catch (notifyErr) {
                console.error('Failed to notify newly assigned site supervisor:', notifyErr);
            }
        }

        const updatedProjectWithCode = await attachProjectCodes(updatedProject);
        return NextResponse.json({ success: true, project: updatedProjectWithCode }, { status: 200 });
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
