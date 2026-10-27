import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from './logoBase64';

export interface RequirementPdfItem {
    id?: string;
    section: string;
    item_name: string;
    is_lumpsum: boolean;
    length_ft: number | null;
    width_ft: number | null;
    area_sqft: number;
    unit?: string;
}

export interface RequirementPdfOptions {
    siteName: string;
    siteAddress?: string | null;
    engineerName?: string | null;
    engineerMobile?: string | null;
    date?: string | null;
    sections: Record<string, RequirementPdfItem[]>;
    materialSpecs?: Record<string, string> | null;
    notes?: string | null;
    fileName?: string;
}

function formatDisplayDate(inputDate?: string | null): string {
    if (!inputDate) {
        const d = new Date();
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(inputDate);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return inputDate;
}

/**
 * Generates and downloads a clean, branded Scope of Work PDF (Strictly price-free)
 */
export function generateRequirementPDF(options: RequirementPdfOptions): void {
    const {
        siteName,
        siteAddress = 'N/A',
        engineerName = 'Not Assigned',
        engineerMobile = 'N/A',
        date,
        sections,
        materialSpecs,
        notes,
        fileName
    } = options;

    const formattedDate = formatDisplayDate(date);

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    }) as any;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // 1. TOP ACCENT BAR (Apple Gold #f5c518)
    doc.setFillColor(245, 197, 24);
    doc.rect(margin, 10, contentWidth, 2, 'F');

    // 2. TOP HEADER BANNER (Dark Slate #2b2b2b)
    doc.setFillColor(43, 43, 43);
    doc.rect(margin, 12, contentWidth, 26, 'F');

    // Logo Box
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 3, 14, 48, 22, 2, 2, 'F');

    try {
        doc.addImage(LOGO_BASE64, 'PNG', margin + 4.5, 15, 45, 20);
    } catch (e) {
        doc.setFontSize(14);
        doc.setTextColor(43, 43, 43);
        doc.setFont('helvetica', 'bold');
        doc.text('APPLE', margin + 8, 24);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('INTERIORS', margin + 26, 24);
    }

    // Company Contact Info on Header Right
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('APPLE INTERIORS', pageWidth - margin - 3, 19, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(210, 210, 210);
    doc.text('Kukatpally, Hyderabad', pageWidth - margin - 3, 24, { align: 'right' });
    doc.text('+91 9603 9603 37 · +91 91606 77899', pageWidth - margin - 3, 29, { align: 'right' });
    doc.text('www.appleinteriors.in', pageWidth - margin - 3, 34, { align: 'right' });

    // 3. DOCUMENT TITLE
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 33, 33);
    doc.text('PROJECT SCOPE OF WORK & SPECIFICATIONS', margin, 44);

    // 4. HEADER CARD: Project Details & Site Engineer
    const cardY = 47;
    const cardHeight = 26;

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'FD');

    // Row 1: Site / Project Name
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('SITE / PROJECT:', margin + 4, cardY + 5.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const splitSiteName = doc.splitTextToSize(siteName || 'N/A', contentWidth - 36);
    doc.text(splitSiteName, margin + 32, cardY + 5.5);

    doc.setDrawColor(235, 237, 240);
    doc.setLineWidth(0.2);
    doc.line(margin + 4, cardY + 8.5, margin + contentWidth - 4, cardY + 8.5);

    // Row 2-3 Left: Site Address & Date
    const col1X = margin + 4;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('SITE ADDRESS:', col1X, cardY + 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const splitAddress = doc.splitTextToSize(siteAddress || 'N/A', 75).slice(0, 2);
    doc.text(splitAddress, col1X + 26, cardY + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('DATE:', col1X, cardY + 21);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(formattedDate, col1X + 26, cardY + 21);

    // Row 2-3 Right: Site Engineer & Mobile
    const col2X = margin + 104;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('SITE ENGINEER:', col2X, cardY + 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerName || 'Not Assigned', col2X + 26, cardY + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('MOBILE NO:', col2X, cardY + 21);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerMobile || 'N/A', col2X + 26, cardY + 21);

    // 5. ROOM BY ROOM SECTIONS TABLES
    let currentY = cardY + cardHeight + 5;

    const sectionEntries = Object.entries(sections);

    sectionEntries.forEach(([sectionName, items], secIdx) => {
        const totalSecArea = items.reduce((s, it) => s + (Number(it.area_sqft) || 0), 0);

        // Section Banner (Check if need new page)
        if (currentY > 250) {
            doc.addPage();
            currentY = 16;
        }

        // Section Title Header Bar
        doc.setFillColor(254, 249, 195); // Light yellow #fef9c3
        doc.setDrawColor(250, 204, 21); // #facc15
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(113, 63, 18); // Dark Amber
        const titleText = `${secIdx + 1}. ${sectionName.toUpperCase()} ${totalSecArea > 0 ? `(${totalSecArea} sq.ft)` : ''}`;
        doc.text(titleText, margin + 4, currentY + 4.8);

        currentY += 8.5;

        // Table Rows
        const rows = items.map((it, idx) => [
            (idx + 1).toString(),
            it.item_name || '—',
            it.is_lumpsum ? '—' : (it.length_ft != null ? String(it.length_ft) : '—'),
            it.is_lumpsum ? '—' : (it.width_ft != null ? String(it.width_ft) : '—'),
            it.is_lumpsum ? '1 Lumpsum' : `${it.area_sqft || 0} ${it.unit || 'sq.ft'}`
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Work / Item Description', 'L (ft)', 'W (ft)', 'Area / Qty']],
            body: rows,
            margin: { left: margin, right: margin, bottom: 20 },
            theme: 'grid',
            headStyles: {
                fillColor: [243, 244, 246], // #f3f4f6
                textColor: [75, 85, 99], // #4b5563
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.15,
                lineColor: [229, 231, 235],
                cellPadding: 2,
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [31, 41, 55],
                valign: 'middle',
                lineWidth: 0.15,
                lineColor: [243, 244, 246],
                cellPadding: 2,
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255],
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left', fontStyle: 'bold' },
                2: { halign: 'center', cellWidth: 22 },
                3: { halign: 'center', cellWidth: 22 },
                4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
            },
            didDrawPage: (data: any) => {
                // Keep track of current page
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
    });

    // 6. MATERIAL & HARDWARE SPECIFICATIONS TABLE (IF ANY)
    if (materialSpecs && Object.keys(materialSpecs).length > 0) {
        if (currentY > 240) {
            doc.addPage();
            currentY = 16;
        }

        doc.setFillColor(243, 244, 246);
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('AGREED MATERIAL & HARDWARE SPECIFICATIONS', margin + 4, currentY + 4.8);

        currentY += 8.5;

        const specRows = Object.entries(materialSpecs).map(([cat, val]) => [cat, val]);

        autoTable(doc, {
            startY: currentY,
            head: [['Category', 'Specification']],
            body: specRows,
            margin: { left: margin, right: margin, bottom: 20 },
            theme: 'grid',
            headStyles: {
                fillColor: [243, 244, 246],
                textColor: [75, 85, 99],
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'left',
                lineWidth: 0.15,
                lineColor: [229, 231, 235],
                cellPadding: 2,
            },
            bodyStyles: {
                fontSize: 7.5,
                textColor: [31, 41, 55],
                valign: 'middle',
                lineWidth: 0.15,
                lineColor: [243, 244, 246],
                cellPadding: 2,
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { fontStyle: 'normal' },
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // 7. FOOTER PAGE NUMBERS ON ALL PAGES
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${totalPages}  •  Apple Interiors Project Requirement Scope`,
            pageWidth / 2,
            290,
            { align: 'center' }
        );
    }

    const safeName = (fileName || siteName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_Scope_Of_Work.pdf`);
}
