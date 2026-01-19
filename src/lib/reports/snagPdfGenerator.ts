import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

// Helper to fetch image and convert to base64 for embedding
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('Failed to fetch image:', url, error);
        return null;
    }
}

export async function generateSnagReport(project: any, snags: any[]) {
    const doc = new jsPDF() as any;
    const title = `Snag List Report - ${project.title}`;
    const date = format(new Date(), 'dd MMMM yyyy');

    // Header
    doc.setFontSize(22);
    doc.setTextColor(251, 191, 36); // Apple Interiors Amber
    doc.setFont('helvetica', 'bold');
    doc.text('APPLE INTERIORS', 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Interior Design & Execution Excellence', 14, 28);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(title, 14, 45);
    doc.setFontSize(10);
    doc.text(`Date Generated: ${date}`, 14, 52);
    doc.text(`Total Snags: ${snags.length}`, 14, 57);

    let currentY = 70;

    for (const [index, snag] of snags.entries()) {
        // Check if we need a new page for the next snag entry
        // We need space for text + photos (at least 80 units)
        if (currentY + 80 > 280) {
            doc.addPage();
            currentY = 20;
        }

        // Snag Header
        doc.setFillColor(243, 244, 246);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Snag #${index + 1}: ${snag.description || 'No Description'}`, 18, currentY + 5.5);
        currentY += 12;

        // Snag Details
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Location: ${snag.location || 'N/A'}`, 18, currentY);
        doc.text(`Category: ${snag.category || 'N/A'}`, 80, currentY);
        doc.text(`Status: ${snag.status?.toUpperCase() || 'OPEN'}`, 140, currentY);
        currentY += 8;

        const photoWidth = 85;
        const photoHeight = 60;
        const margin = 14;
        const gutter = 10;

        // "Before" Photo (Reported)
        const beforePhotoUrl = snag.photos && snag.photos.length > 0 ? snag.photos[0] : null;
        if (beforePhotoUrl) {
            doc.setFont('helvetica', 'bold');
            doc.text('Reported (Before)', margin + 4, currentY + 4);
            currentY += 6;

            const imageData = await fetchImageAsBase64(beforePhotoUrl);
            if (imageData) {
                try {
                    doc.addImage(imageData, 'JPEG', margin, currentY, photoWidth, photoHeight);
                } catch (e) {
                    doc.rect(margin, currentY, photoWidth, photoHeight);
                    doc.text('Image Error', margin + 30, currentY + 30);
                }
            } else {
                doc.rect(margin, currentY, photoWidth, photoHeight);
                doc.text('No Photo', margin + 30, currentY + 30);
            }
        } else {
            doc.text('No Before Photo', margin + 4, currentY + 4);
            currentY += 6;
            doc.rect(margin, currentY, photoWidth, photoHeight);
        }

        // "After" Photo (Resolved)
        const afterPhotoUrl = snag.resolved_photos && snag.resolved_photos.length > 0 ? snag.resolved_photos[0] : null;
        if (snag.status === 'resolved' || snag.status === 'verified' || snag.status === 'closed') {
            doc.setFont('helvetica', 'bold');
            doc.text('Resolved (After)', margin + photoWidth + gutter + 4, currentY - 6 + 4);

            if (afterPhotoUrl) {
                const imageData = await fetchImageAsBase64(afterPhotoUrl);
                if (imageData) {
                    try {
                        doc.addImage(imageData, 'JPEG', margin + photoWidth + gutter, currentY, photoWidth, photoHeight);
                    } catch (e) {
                        doc.rect(margin + photoWidth + gutter, currentY, photoWidth, photoHeight);
                    }
                } else {
                    doc.rect(margin + photoWidth + gutter, currentY, photoWidth, photoHeight);
                }
            } else {
                doc.rect(margin + photoWidth + gutter, currentY, photoWidth, photoHeight);
                doc.setFont('helvetica', 'normal');
                doc.text('No Resolution Photo', margin + photoWidth + gutter + 25, currentY + 30);
            }
        }

        currentY += photoHeight + 15;

        // Resolved Description if exists
        if (snag.resolved_description) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const resLines = doc.splitTextToSize(`Resolution: ${snag.resolved_description}`, 180);
            doc.text(resLines, 14, currentY - 8);
        }
    }

    // Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
