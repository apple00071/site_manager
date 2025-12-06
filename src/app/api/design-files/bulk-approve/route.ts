import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const bulkApproveSchema = z.object({
    design_ids: z.array(z.string().uuid()).min(1),
    action: z.enum(['approve', 'reject']),
    admin_comments: z.string().optional(),
});

/**
 * POST /api/design-files/bulk-approve
 * Bulk approve or reject multiple design files
 * RBAC: admin only
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;

        // Get user role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, full_name')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // RBAC: Only admin can bulk approve
        if (userData.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden: Only admins can bulk approve designs' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = bulkApproveSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { design_ids, action, admin_comments } = parsed.data;

        // Update all specified designs
        const updateData: any = {
            approval_status: action === 'approve' ? 'approved' : 'rejected',
            approved_by: userId,
            approved_at: new Date().toISOString(),
        };

        if (admin_comments) {
            updateData.admin_comments = admin_comments;
        }

        if (action === 'approve') {
            updateData.is_current_approved = true;
        }

        const { data: updatedDesigns, error: updateError } = await supabaseAdmin
            .from('design_files')
            .update(updateData)
            .in('id', design_ids)
            .select('id, file_name, uploaded_by, project_id');

        if (updateError) {
            console.error('Error bulk updating designs:', updateError);
            return NextResponse.json(
                { error: 'Failed to bulk update designs' },
                { status: 500 }
            );
        }

        // Send notifications to uploaders
        try {
            const notifications = (updatedDesigns || []).map(design =>
                NotificationService.createNotification({
                    userId: design.uploaded_by,
                    title: `Design ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                    message: `Your design "${design.file_name}" has been ${action === 'approve' ? 'approved' : 'rejected'} by ${userData.full_name}`,
                    type: action === 'approve' ? 'design_approved' : 'design_rejected',
                    relatedId: design.id,
                    relatedType: 'design_file'
                })
            );
            await Promise.all(notifications);
        } catch (notificationError) {
            console.error('Failed to send bulk approval notifications:', notificationError);
        }

        return NextResponse.json({
            message: `Successfully ${action}d ${updatedDesigns?.length || 0} design(s)`,
            updated_count: updatedDesigns?.length || 0,
            design_ids: updatedDesigns?.map(d => d.id) || [],
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
