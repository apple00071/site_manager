import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { generateSnagReport } from '@/lib/reports/snagPdfGenerator';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // 1. Fetch Project and Snags
        const { data: project, error: pError } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (pError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: snags, error: sError } = await supabaseAdmin
            .from('snags')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (sError) {
            return NextResponse.json({ error: 'Failed to fetch snags' }, { status: 500 });
        }

        if (!snags || snags.length === 0) {
            return NextResponse.json({ error: 'No snags found for this project' }, { status: 400 });
        }

        // 2. Generate PDF
        const pdfBuffer = await generateSnagReport(project, snags);

        // 3. Upload to Supabase Storage
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const autoFileName = `${projectId}/Snag_Report_${timestamp}.pdf`;

        const { error: uError } = await supabaseAdmin.storage
            .from('project-documents')
            .upload(autoFileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uError) {
            console.error('Storage Upload Error:', uError);
            return NextResponse.json({ error: 'Failed to upload report' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('project-documents')
            .getPublicUrl(autoFileName);

        return NextResponse.json({ success: true, pdf_url: publicUrl });

    } catch (error) {
        console.error('Snag Report Generation Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
