import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export async function generateDPR(report: any, project: any) {
    const doc = new jsPDF() as any;
    const title = `Daily Progress Report - ${project.title}`;
    const date = format(new Date(report.report_date), 'dd MMMM yyyy');

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
    doc.text(`Date: ${date}`, 14, 52);
    doc.text(`Status: ${report.status.toUpperCase()}`, 14, 57);

    // Generated time
    const generatedTime = report.created_at
        ? format(new Date(report.created_at), 'dd MMM yyyy, hh:mm a')
        : format(new Date(), 'dd MMM yyyy, hh:mm a');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${generatedTime}`, 14, 62);
    doc.setTextColor(0, 0, 0);

    // Summary Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Summary', 14, 75);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(report.summary || 'No summary provided.', 180);
    doc.text(summaryLines, 14, 82);

    let currentY = 82 + (summaryLines.length * 5) + 10;

    // Aggregated Data Tables
    if (report.aggregated_data?.tasks?.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Tasks Completed Today', 14, currentY);
        currentY += 5;

        autoTable(doc, {
            startY: currentY,
            head: [['Task Name', 'Status']],
            body: report.aggregated_data.tasks.map((t: any) => [t.title, t.status.toUpperCase()]),
            theme: 'striped',
            headStyles: { fillColor: [251, 191, 36] } // Amber/Yellow
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (report.aggregated_data?.inventory?.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Materials Received', 14, currentY);
        currentY += 5;

        autoTable(doc, {
            startY: currentY,
            head: [['Item Name', 'Quantity', 'Cost']],
            body: report.aggregated_data.inventory.map((i: any) => [i.item_name, i.quantity || '-', i.total_cost || '-']),
            theme: 'striped',
            headStyles: { fillColor: [251, 191, 36] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Blockers & Tomorrow
    if (report.blockers) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Site Blockers', 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const blockerLines = doc.splitTextToSize(report.blockers, 180);
        doc.text(blockerLines, 14, currentY + 7);
        currentY += 7 + (blockerLines.length * 5) + 10;
    }

    if (report.tomorrow_plan) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Tomorrow's Plan", 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const planLines = doc.splitTextToSize(report.tomorrow_plan, 180);
        doc.text(planLines, 14, currentY + 7);
        currentY += 7 + (planLines.length * 5) + 10;
    }

    // Viewpoint Photos Section
    if (report.viewpoint_photos && report.viewpoint_photos.length > 0) {
        // Check if we need a new page
        if (currentY > 200) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Site Viewpoints', 14, currentY);
        currentY += 10;

        const photoWidth = 85;
        const photoHeight = 60;
        const margin = 14;
        const gutter = 10;
        let xPos = margin;
        let photosInRow = 0;

        for (const vp of report.viewpoint_photos) {
            // Check if we need a new page
            if (currentY + photoHeight + 20 > 280) {
                doc.addPage();
                currentY = 20;
                xPos = margin;
                photosInRow = 0;
            }

            // Try to fetch and embed the image
            const imageData = await fetchImageAsBase64(vp.photo_url);

            if (imageData) {
                try {
                    doc.addImage(imageData, 'JPEG', xPos, currentY, photoWidth, photoHeight);
                } catch (imgError) {
                    // If image fails, draw a placeholder
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(xPos, currentY, photoWidth, photoHeight);
                    doc.setFontSize(8);
                    doc.text('Image unavailable', xPos + 20, currentY + 30);
                }
            } else {
                // Draw placeholder for missing image
                doc.setDrawColor(200, 200, 200);
                doc.rect(xPos, currentY, photoWidth, photoHeight);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text('Image unavailable', xPos + 20, currentY + 30);
                doc.setTextColor(0, 0, 0);
            }

            // Add viewpoint name below image
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            const vpName = vp.viewpoint?.name || 'Viewpoint';
            doc.text(vpName, xPos, currentY + photoHeight + 5);
            doc.setFont('helvetica', 'normal');

            // Move to next position
            photosInRow++;
            if (photosInRow >= 2) {
                // Move to next row
                xPos = margin;
                currentY += photoHeight + 15;
                photosInRow = 0;
            } else {
                // Move to next column
                xPos += photoWidth + gutter;
            }
        }

        // Add space after last row if we didn't complete a full row
        if (photosInRow > 0) {
            currentY += photoHeight + 15;
        }
    }

    // Page Number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc.output('arraybuffer');
}

