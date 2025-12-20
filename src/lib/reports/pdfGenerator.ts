import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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

    // Summary Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Summary', 14, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(report.summary || 'No summary provided.', 180);
    doc.text(summaryLines, 14, 77);

    let currentY = 77 + (summaryLines.length * 5) + 10;

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
