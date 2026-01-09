import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { sendInvoiceWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const invoiceSchema = z.object({
    po_id: z.string().uuid().optional().nullable(),
    project_id: z.string().uuid(),
    supplier_id: z.string().uuid().optional().nullable(),
    invoice_number: z.string().optional().nullable(),
    invoice_date: z.string().optional().nullable(),
    invoice_type: z.enum(['advance', 'ra_bill', 'final', 'credit_note']),
    amount: z.number().min(0),
    tax_amount: z.number().min(0).optional(),
    total_amount: z.number().min(0),
    file_url: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string, userRole: string) {
    if (userRole === 'admin') return true;

    // Check if user is assigned to the project directly
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('assigned_employee_id, created_by')
        .eq('id', projectId)
        .single();

    if (project && (project.assigned_employee_id === userId || project.created_by === userId)) {
        return true;
    }

    // Check if user is a project member
    const { data } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

// GET /api/invoices?project_id=xxx
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = request.nextUrl.searchParams.get('project_id');
        const poId = request.nextUrl.searchParams.get('po_id');

        if (!projectId && !poId) {
            return NextResponse.json({ error: 'project_id or po_id is required' }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('invoices')
            .select(`
        *,
        supplier:suppliers(id, name),
        po:purchase_orders(id, po_number),
        approved_by_user:users!invoices_approved_by_fkey(id, full_name)
      `)
            .order('created_at', { ascending: false });

        if (projectId) {
            const hasAccess = await checkProjectAccess(user.id, projectId, role || '');
            if (!hasAccess) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
            query = query.eq('project_id', projectId);
        }

        if (poId) {
            query = query.eq('po_id', poId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching invoices:', error);
            return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
        }

        // Calculate stats
        const invoices: any[] = data || [];
        const stats = {
            total: invoices.length,
            pending: invoices.filter((i: any) => i.status === 'pending').length,
            approved: invoices.filter((i: any) => i.status === 'approved').length,
            paid: invoices.filter((i: any) => i.status === 'paid').length,
            totalValue: invoices.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0),
            pendingValue: invoices
                .filter((i: any) => i.status === 'pending')
                .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0),
        };

        return NextResponse.json({ invoices, stats });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/invoices - Create invoice
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validationResult = invoiceSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { project_id } = validationResult.data;

        const hasAccess = await checkProjectAccess(user.id, project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('invoices')
            .insert({
                ...validationResult.data,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating invoice:', error);
            return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
        }

        // --- NOTIFICATIONS ---
        try {
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('title')
                .eq('id', project_id)
                .single();

            const projectName = project?.title || 'Unknown Project';
            const invNum = data.invoice_number || 'N/A';
            const amount = data.total_amount || 0;

            await NotificationService.notifyStakeholders(project_id, user.id, {
                title: 'New Invoice Generated',
                message: `Project: ${projectName}\nInvoice: ${invNum}\nAmount: ₹${amount.toLocaleString()}\n\nThe invoice is now available for your review.`,
                type: 'project_update',
                relatedId: data.id,
                relatedType: 'invoice'
            });
        } catch (notifError) {
            console.error('Error sending invoice creation notification:', notifError);
        }

        return NextResponse.json({ invoice: data }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/invoices - Update invoice (including approval)
export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, action, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        // Get existing invoice
        const { data: existing } = await supabaseAdmin
            .from('invoices')
            .select('project_id, status, created_by')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Handle approval actions (admin only)
        if (action === 'approve' || action === 'reject') {
            if (role !== 'admin') {
                return NextResponse.json({ error: 'Admin access required for approval' }, { status: 403 });
            }

            const updateData = action === 'approve'
                ? { status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }
                : { status: 'rejected', rejection_reason: updates.rejection_reason };

            const { data, error } = await supabaseAdmin
                .from('invoices')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating invoice:', error);
                return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
            }

            // --- NOTIFICATIONS ---
            try {
                const { data: project } = await supabaseAdmin
                    .from('projects')
                    .select('title')
                    .eq('id', existing.project_id)
                    .single();

                const projectName = project?.title || 'Unknown Project';
                const invNum = data.invoice_number || 'N/A';

                if (action === 'approve') {
                    await NotificationService.notifyStakeholders(existing.project_id, user.id, {
                        title: 'Invoice Approved',
                        message: `Project: ${projectName}\nInvoice: ${invNum}\n\nThe invoice has been approved and is being processed for payment.`,
                        type: 'project_update',
                        relatedId: id,
                        relatedType: 'invoice'
                    });
                } else if (action === 'reject' && existing.created_by) {
                    await NotificationService.notifyInvoiceRejected(existing.created_by, invNum, projectName);
                }
            } catch (notifError) {
                console.error('Error sending invoice update notifications:', notifError);
            }

            return NextResponse.json({ invoice: data });
        }

        // Regular update
        const hasAccess = await checkProjectAccess(user.id, existing.project_id, role || '');
        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('invoices')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating invoice:', error);
            return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
        }

        return NextResponse.json({ invoice: data });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/invoices?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError, role } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('invoices')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting invoice:', error);
            return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
