import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// DELETE - Delete a report by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (user.user_metadata?.role || user.app_metadata?.role || 'employee') as string;

        // Only admins can delete reports
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Only admins can delete reports' }, { status: 403 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
        }

        // Check if report exists
        const { data: existingReport, error: fetchError } = await supabaseAdmin
            .from('progress_reports')
            .select('id')
            .eq('id', id)
            .single();

        if (fetchError || !existingReport) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        // Delete the report
        const { error } = await supabaseAdmin
            .from('progress_reports')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting report:', error);
            return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
