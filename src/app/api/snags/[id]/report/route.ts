import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

// Helper to fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        return null;
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Fetch the snag
        const { data: snag, error } = await supabaseAdmin
            .from('snags')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !snag) {
            return NextResponse.json({ error: 'Snag not found' }, { status: 404 });
        }

        // Generate PDF
        const doc = new jsPDF() as any;
        const title = snag.site_name || 'Snag Report';
        const date = format(new Date(), 'dd MMMM yyyy');

        // Header
        doc.setFontSize(22);
        doc.setTextColor(251, 191, 36);
        doc.setFont('helvetica', 'bold');
        doc.text('APPLE INTERIORS', 14, 22);

        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('Snag Resolution Report', 14, 28);

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(title, 14, 45);
        doc.setFontSize(10);
        doc.text(`Generated: ${date}`, 14, 52);

        let y = 65;

        // Snag Details
        doc.setFillColor(243, 244, 246);
        doc.rect(14, y, 182, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Snag Details', 18, y + 5.5);
        y += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Description: ${snag.description || 'N/A'}`, 18, y);
        y += 7;
        doc.text(`Location: ${snag.location || 'N/A'}`, 18, y);
        y += 7;
        doc.text(`Client: ${snag.client_name || 'N/A'}`, 18, y);
        y += 7;
        doc.text(`Status: ${snag.status?.toUpperCase() || 'CLOSED'}`, 18, y);
        y += 7;
        if (snag.closed_at) {
            doc.text(`Closed On: ${format(new Date(snag.closed_at), 'dd MMM yyyy')}`, 18, y);
            y += 7;
        }

        y += 10;

        const photoWidth = 85;
        const photoHeight = 60;
        const margin = 14;
        const gutter = 10;

        // Before Photo
        doc.setFont('helvetica', 'bold');
        doc.text('BEFORE (Reported)', margin, y);
        y += 5;

        const beforeUrl = snag.photos?.[0];
        if (beforeUrl) {
            const imgData = await fetchImageAsBase64(beforeUrl);
            if (imgData) {
                try { doc.addImage(imgData, 'JPEG', margin, y, photoWidth, photoHeight); } catch (e) { }
            }
        } else {
            doc.rect(margin, y, photoWidth, photoHeight);
            doc.setFont('helvetica', 'normal');
            doc.text('No Photo', margin + 30, y + 30);
        }

        // After Photo
        doc.setFont('helvetica', 'bold');
        doc.text('AFTER (Resolved)', margin + photoWidth + gutter, y - 5);

        const afterUrl = snag.resolved_photos?.[0];
        if (afterUrl) {
            const imgData = await fetchImageAsBase64(afterUrl);
            if (imgData) {
                try { doc.addImage(imgData, 'JPEG', margin + photoWidth + gutter, y, photoWidth, photoHeight); } catch (e) { }
            }
        } else {
            doc.rect(margin + photoWidth + gutter, y, photoWidth, photoHeight);
            doc.setFont('helvetica', 'normal');
            doc.text('No Photo', margin + photoWidth + gutter + 25, y + 30);
        }

        y += photoHeight + 15;

        // Resolution Description
        if (snag.resolved_description) {
            doc.setFont('helvetica', 'bold');
            doc.text('Resolution Notes:', 14, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(snag.resolved_description, 180);
            doc.text(lines, 14, y);
        }

        // Output as Buffer
        const pdfBuffer = doc.output('arraybuffer');

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Snag_Report_${id.slice(0, 8)}.pdf"`
            }
        });

    } catch (err) {
        console.error('Single Snag PDF Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
