import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from './logoBase64';

export interface BoqPdfItem {
    id?: string;
    item_name: string;
    material_company?: string | null;
    quantity: number | string;
    unit?: string | null;
}

export interface BoqPdfOptions {
    siteName: string;
    siteAddress?: string | null;
    engineerName?: string | null;
    engineerMobile?: string | null;
    deliveryFloor?: string | null;
    items: BoqPdfItem[];
    fileName?: string;
}

/**
 * Generates and downloads a branded BOQ Material Requirement PDF
 */
export function generateBoqPDF(options: BoqPdfOptions): void {
    const {
        siteName,
        siteAddress = 'N/A',
        engineerName = 'Not Assigned',
        engineerMobile = 'N/A',
        deliveryFloor = 'Ground Floor',
        items,
        fileName
    } = options;

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

    // Logo Box (White background card)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 3, 14, 48, 22, 2, 2, 'F');

    try {
        doc.addImage(LOGO_BASE64, 'PNG', margin + 4.5, 15, 45, 20);
    } catch (e) {
        // Fallback text if logo fails to render
        doc.setFontSize(14);
        doc.setTextColor(43, 43, 43);
        doc.setFont('helvetica', 'bold');
        doc.text('APPLE', margin + 8, 24);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('INTERIORS', margin + 26, 24);
        doc.setFontSize(6);
        doc.setTextColor(245, 197, 24);
        doc.text('We build your Dream', margin + 8, 29);
    }

    // Company Contact Info on Header Right
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24); // Amber Gold
    doc.text('APPLE INTERIORS', pageWidth - margin - 3, 19, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(210, 210, 210);
    doc.text('Kukatpally, Hyderabad', pageWidth - margin - 3, 24, { align: 'right' });
    doc.text('+91 9603 9603 37 · +91 91606 77899', pageWidth - margin - 3, 29, { align: 'right' });
    doc.text('www.appleinteriors.in', pageWidth - margin - 3, 34, { align: 'right' });

    // 3. DOCUMENT TITLE
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 33, 33);
    doc.text('BILL OF QUANTITIES (BOQ) - MATERIAL REQUIREMENT', margin, 45);

    // Thin accent line below title
    doc.setDrawColor(245, 197, 24);
    doc.setLineWidth(0.5);
    doc.line(margin, 47, pageWidth - margin, 47);

    // 4. SITE & DELIVERY DETAILS CARD
    const cardY = 50;
    const cardHeight = 27;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'FD');

    // Left Column: Site Info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE / PROJECT NAME:', margin + 4, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(siteName || 'N/A', margin + 40, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE ADDRESS:', margin + 4, cardY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const splitAddress = doc.splitTextToSize(siteAddress || 'N/A', 65);
    doc.text(splitAddress, margin + 40, cardY + 12);

    // Right Column: Engineer & Delivery Floor
    const col2X = margin + 105;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE ENGINEER:', col2X, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerName || 'Unassigned', col2X + 27, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('MOBILE NO:', col2X, cardY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerMobile || 'N/A', col2X + 27, cardY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('DELIVERY FLOOR:', col2X, cardY + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(deliveryFloor || 'Ground Floor', col2X + 27, cardY + 18);

    // 5. MATERIAL ITEMS TABLE
    const tableBody = items.map((item, index) => [
        (index + 1).toString(),
        item.item_name || '-',
        `${item.quantity ?? 0} ${item.unit || ''}`.trim()
    ]);

    autoTable(doc, {
        startY: cardY + cardHeight + 5,
        head: [['Sl.No', 'Particular (Item)', 'Quantity']],
        body: tableBody,
        margin: { left: margin, right: margin, bottom: 35 },
        theme: 'plain',
        headStyles: {
            fillColor: [43, 43, 43],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 135 },
            2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [33, 33, 33],
            cellPadding: 2.5
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        tableLineColor: [220, 220, 220],
        tableLineWidth: 0.2,
        didDrawPage: (data: any) => {
            // Footer on every page
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Apple Interiors · BOQ Material Requirement · Generated for ${siteName}`,
                margin,
                pageHeight - 8
            );
            const pageNum = `Page ${doc.internal.getNumberOfPages()}`;
            doc.text(pageNum, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
    });

    // 6. SIGN-OFF BLOCK AT BOTTOM OF LAST PAGE
    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    const pageHeight = doc.internal.pageSize.getHeight();
    let signY = finalY + 15;

    // Check if sign-off block fits on current page, else add page
    if (signY + 22 > pageHeight - 15) {
        doc.addPage();
        signY = 30;
    }

    const boxWidth = (contentWidth - 10) / 3;
    const signBoxes = [
        { label: 'Site Engineer Sign', sub: engineerName || 'Site In-Charge', x: margin },
        { label: 'Project Manager Sign', sub: 'Apple Interiors', x: margin + boxWidth + 5 },
        { label: 'Receiver / Vendor Sign', sub: 'Material In-charge', x: margin + (boxWidth * 2) + 10 }
    ];

    signBoxes.forEach(box => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(box.x, signY + 12, box.x + boxWidth, signY + 12);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.text(box.label, box.x + (boxWidth / 2), signY + 16, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`(${box.sub})`, box.x + (boxWidth / 2), signY + 20, { align: 'center' });
    });

    // Save and trigger browser download
    const cleanSiteName = (siteName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const outName = fileName || `BOQ_${cleanSiteName}_${dateStr}.pdf`;
    doc.save(outName);
}

export interface LaminatePdfItem {
    id?: string;
    item_name: string;      // Laminate Code
    company?: string | null; // Company / Brand
    quantity: number | string;
    unit?: string | null;
}

export interface LaminatePdfOptions {
    siteName: string;
    siteAddress?: string | null;
    engineerName?: string | null;
    engineerMobile?: string | null;
    deliveryFloor?: string | null;
    items: LaminatePdfItem[];
    fileName?: string;
}

/**
 * Generates and downloads a branded Laminate Requirement PDF
 */
export function generateLaminatePDF(options: LaminatePdfOptions): void {
    const {
        siteName,
        siteAddress = 'N/A',
        engineerName = 'Not Assigned',
        engineerMobile = 'N/A',
        deliveryFloor = 'Ground Floor',
        items,
        fileName
    } = options;

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
        doc.setFontSize(6);
        doc.setTextColor(245, 197, 24);
        doc.text('We build your Dream', margin + 8, 29);
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
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 33, 33);
    doc.text('BILL OF QUANTITIES (BOQ) - LAMINATE REQUIREMENT', margin, 45);

    // Thin accent line below title
    doc.setDrawColor(245, 197, 24);
    doc.setLineWidth(0.5);
    doc.line(margin, 47, pageWidth - margin, 47);

    // 4. SITE & DELIVERY DETAILS CARD
    const cardY = 50;
    const cardHeight = 27;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'FD');

    // Left Column: Site Info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE / PROJECT NAME:', margin + 4, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(siteName || 'N/A', margin + 40, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE ADDRESS:', margin + 4, cardY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const splitAddress = doc.splitTextToSize(siteAddress || 'N/A', 65);
    doc.text(splitAddress, margin + 40, cardY + 12);

    // Right Column: Engineer & Delivery Floor
    const col2X = margin + 105;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SITE ENGINEER:', col2X, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerName || 'Unassigned', col2X + 27, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('MOBILE NO:', col2X, cardY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(engineerMobile || 'N/A', col2X + 27, cardY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('DELIVERY FLOOR:', col2X, cardY + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(deliveryFloor || 'Ground Floor', col2X + 27, cardY + 18);

    // 5. LAMINATE ITEMS TABLE
    const tableBody = items.map((item, index) => [
        (index + 1).toString(),
        item.item_name || '-',
        item.company || '-',
        `${item.quantity ?? 0} ${item.unit || 'Sheets'}`.trim()
    ]);

    autoTable(doc, {
        startY: cardY + cardHeight + 5,
        head: [['Sl.No', 'Laminate Code', 'Company', 'Sheets']],
        body: tableBody,
        margin: { left: margin, right: margin, bottom: 35 },
        theme: 'plain',
        headStyles: {
            fillColor: [43, 43, 43],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 18, halign: 'center' },
            1: { cellWidth: 90 },
            2: { cellWidth: 45 },
            3: { cellWidth: 29, halign: 'right', fontStyle: 'bold' }
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [33, 33, 33],
            cellPadding: 2.5
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        tableLineColor: [220, 220, 220],
        tableLineWidth: 0.2,
        didDrawPage: () => {
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Apple Interiors · Laminate Requirement · Generated for ${siteName}`,
                margin,
                pageHeight - 8
            );
            const pageNum = `Page ${doc.internal.getNumberOfPages()}`;
            doc.text(pageNum, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
    });

    // 6. SIGN-OFF BLOCK AT BOTTOM OF LAST PAGE
    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    const pageHeight = doc.internal.pageSize.getHeight();
    let signY = finalY + 15;

    if (signY + 22 > pageHeight - 15) {
        doc.addPage();
        signY = 30;
    }

    const boxWidth = (contentWidth - 10) / 3;
    const signBoxes = [
        { label: 'Site Engineer Sign', sub: engineerName || 'Site In-Charge', x: margin },
        { label: 'Project Manager Sign', sub: 'Apple Interiors', x: margin + boxWidth + 5 },
        { label: 'Receiver / Vendor Sign', sub: 'Laminate In-charge', x: margin + (boxWidth * 2) + 10 }
    ];

    signBoxes.forEach(box => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(box.x, signY + 12, box.x + boxWidth, signY + 12);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.text(box.label, box.x + (boxWidth / 2), signY + 16, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`(${box.sub})`, box.x + (boxWidth / 2), signY + 20, { align: 'center' });
    });

    const cleanSite = (siteName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const output = fileName || `Laminate_${cleanSite}_${date}.pdf`;
    doc.save(output);
}

