import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { getViewpointName } from './viewpoints';
import { LOGO_BASE64 } from './logoBase64';

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

    // Generated time - convert to IST (UTC+5:30)
    const createdDate = report.created_at ? new Date(report.created_at) : new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istDate = new Date(createdDate.getTime() + istOffset);
    const generatedTime = format(istDate, 'dd MMM yyyy, hh:mm a');
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
            if (currentY + photoHeight + 20 > 280) {
                doc.addPage();
                currentY = 20;
                xPos = margin;
                photosInRow = 0;
            }

            const imageData = await fetchImageAsBase64(vp.photo_url);

            if (imageData) {
                try {
                    doc.addImage(imageData, 'JPEG', xPos, currentY, photoWidth, photoHeight);
                } catch (imgError) {
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(xPos, currentY, photoWidth, photoHeight);
                    doc.setFontSize(8);
                    doc.text('Image unavailable', xPos + 20, currentY + 30);
                }
            } else {
                doc.setDrawColor(200, 200, 200);
                doc.rect(xPos, currentY, photoWidth, photoHeight);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text('Image unavailable', xPos + 20, currentY + 30);
                doc.setTextColor(0, 0, 0);
            }

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            const vpName = vp.viewpoint?.name || getViewpointName(vp.viewpoint_id) || 'Viewpoint';
            doc.text(vpName, xPos, currentY + photoHeight + 5);
            doc.setFont('helvetica', 'normal');

            photosInRow++;
            if (photosInRow >= 2) {
                xPos = margin;
                currentY += photoHeight + 15;
                photosInRow = 0;
            } else {
                xPos += photoWidth + gutter;
            }
        }

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

    return Buffer.from(doc.output('arraybuffer'));
}

export async function generateQuotationPDF(quotation: any, lead: any): Promise<Buffer> {
    const doc = new jsPDF() as any;

    // 0. TOP ACCENT BAR (#f5c518 Amber Gold)
    doc.setFillColor(245, 197, 24);
    doc.rect(14, 10, 182, 2, 'F');

    // 1. TOP HEADER BANNER (Dark Slate Bar matching App Layout #2b2b2b)
    doc.setFillColor(43, 43, 43);
    doc.rect(14, 12, 182, 28, 'F');

    // White Logo Box on Left
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(17, 13.5, 54, 25, 3, 3, 'F');
    
    try {
      doc.addImage(LOGO_BASE64, 'PNG', 18.5, 15, 51, 22);
    } catch (e) {
      console.error('Error rendering embedded logo in PDF:', e);
      doc.setFontSize(15);
      doc.setTextColor(43, 43, 43);
      doc.setFont('helvetica', 'bold');
      doc.text('Apple', 22, 26);
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('INTERIORS', 38, 26);
      doc.setFontSize(6);
      doc.setTextColor(245, 197, 24);
      doc.text('We build your Dream', 24, 32);
    }

    // Right Header Info
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24); // Amber Gold
    doc.text('Kukatpally, Hyderabad', 190, 20, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(190, 190, 190);
    doc.text('+91 9603 9603 37 · +91 91606 77899', 190, 26, { align: 'right' });
    doc.text('www.appleinteriors.in', 190, 32, { align: 'right' });

    // 2. MAIN TITLE
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(43, 43, 43);
    doc.text('INTERIOR DESIGN QUOTATION', 105, 48, { align: 'center' });

    // 3. CLIENT & METADATA GRID
    const printDate = quotation?.created_at 
      ? new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);

    // Column 1 (Left)
    doc.text(`Client Name : `, 14, 57);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`${lead?.client_name || 'Customer'}`, 40, 57);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(`Phone : `, 14, 63);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`${lead?.phone || '-'}`, 40, 63);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(`Site Location : `, 14, 69);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`${lead?.site_project || '-'}`, 40, 69);

    // Column 2 (Right)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(`Date : `, 120, 57);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`${printDate}`, 136, 57);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(`Ref No : `, 120, 63);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`${lead?.ref_no || '-'}`, 136, 63);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(`Version : `, 120, 69);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`v${quotation?.version || 1}`, 136, 69);

    // Amber Divider Line (#f5c518)
    doc.setDrawColor(245, 197, 24);
    doc.setLineWidth(1);
    doc.line(14, 74, 196, 74);

    let currentY = 78;

    // 4. ITEMS TABLE (GROUPED BY SECTION WITH SECTION SUBTOTALS)
    const rawItems: any[] = (quotation?.quotation_items || quotation?.items || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    
    const subtotal = quotation?.subtotal || lead?.quote_value || 0;
    const finalVal = quotation?.final_amount || subtotal;
    const hasDiscountVal = quotation?.discount_value && quotation.discount_value > 0;
    const discountAmount = subtotal - finalVal;

    if (rawItems.length > 0) {
      const sections: Record<string, any[]> = {};
      rawItems.forEach(item => {
        const sec = item.section || 'GENERAL';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(item);
      });

      const tableBody: any[] = [];
      let itemCounter = 1;

      Object.entries(sections).forEach(([secName, secItems]) => {
        // Section Header Row (#f5c518)
        tableBody.push([
          { 
            content: secName.toUpperCase(), 
            colSpan: 7, 
            styles: { 
              fillColor: [245, 197, 24], 
              textColor: [43, 43, 43], 
              fontStyle: 'bold',
              fontSize: 8.5
            } 
          }
        ]);

        let secSubtotal = 0;
        secItems.forEach(item => {
          const amt = Number(item.amount || item.total_amount || 0);
          secSubtotal += amt;

          const lVal = item.length_ft != null && item.length_ft !== '' ? String(item.length_ft) : (item.length ? String(item.length) : '—');
          const wVal = item.width_ft != null && item.width_ft !== '' ? String(item.width_ft) : (item.width || item.height ? String(item.width || item.height) : '—');
          const areaVal = item.is_lumpsum ? 'LSM' : String(item.area_sqft != null ? item.area_sqft : (item.area || 0));

          tableBody.push([
            itemCounter++,
            item.item_name || item.title || 'Item',
            lVal,
            wVal,
            areaVal,
            item.rate ? `Rs. ${Math.round(Number(item.rate)).toLocaleString('en-IN')}` : '—',
            `Rs. ${Math.round(amt).toLocaleString('en-IN')}`
          ]);
        });

        // Section Subtotal Row (#f0ebe0)
        tableBody.push([
          {
            content: `${secName} Subtotal:`,
            colSpan: 6,
            styles: {
              fillColor: [240, 235, 224],
              textColor: [43, 43, 43],
              fontStyle: 'bold',
              halign: 'right',
              fontSize: 8
            }
          },
          {
            content: `Rs. ${Math.round(secSubtotal).toLocaleString('en-IN')}`,
            styles: {
              fillColor: [240, 235, 224],
              textColor: [43, 43, 43],
              fontStyle: 'bold',
              halign: 'right',
              fontSize: 8
            }
          }
        ]);
      });

      // Discount Row if present
      if (hasDiscountVal) {
        tableBody.push([
          {
            content: `Discount ${quotation.discount_type === 'percent' ? `(${quotation.discount_value}%)` : '(Flat)'}:`,
            colSpan: 6,
            styles: {
              fillColor: [254, 242, 242],
              textColor: [220, 38, 38],
              fontStyle: 'italic',
              halign: 'right',
              fontSize: 8
            }
          },
          {
            content: `- Rs. ${Math.round(discountAmount).toLocaleString('en-IN')}`,
            styles: {
              fillColor: [254, 242, 242],
              textColor: [220, 38, 38],
              fontStyle: 'bold',
              halign: 'right',
              fontSize: 8
            }
          }
        ]);
      }

      // Grand Total Row
      tableBody.push([
        {
          content: 'GRAND TOTAL (Exclusive of GST):',
          colSpan: 6,
          styles: {
            fillColor: [43, 43, 43],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'right',
            fontSize: 9.5
          }
        },
        {
          content: `Rs. ${Math.round(Number(finalVal)).toLocaleString('en-IN')}`,
          styles: {
            fillColor: [43, 43, 43],
            textColor: [245, 197, 24],
            fontStyle: 'bold',
            halign: 'right',
            fontSize: 9.5
          }
        }
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Description of Work', 'L (ft)', 'W (ft)', 'Area (sq.ft)', 'Rate (Rs.)', 'Amount (Rs.)']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
          fillColor: [43, 43, 43], 
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 28, halign: 'right' }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Estimated Quotation Amount: Rs. ${Math.round(Number(lead?.quote_value || quotation?.final_amount || 0)).toLocaleString('en-IN')}`, 14, currentY);
      currentY += 15;
    }

    // 6. PAYMENT SCHEDULE TABLE
    if (currentY + 65 > 260) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(43, 43, 43);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('PAYMENT SCHEDULE', 18, currentY + 4.5);
    currentY += 8;

    const milestones = [
      ['Stage 1', 'Token Advance', '10%'],
      ['Stage 2', 'Before Start of Work', '40%'],
      ['Stage 3', 'Completion of Boxes & Inside Laminate', '30%'],
      ['Stage 4', 'Completion of Outside Laminate', '15%'],
      ['Stage 5', 'At Handover', '5%']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Stage', 'Milestone Description', 'Payment %']],
      body: milestones,
      theme: 'grid',
      headStyles: { fillColor: [245, 197, 24], textColor: [43, 43, 43], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 7. MATERIAL SPECIFICATIONS TABLE
    if (currentY + 110 > 260) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(43, 43, 43);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('MATERIAL SPECIFICATIONS', 18, currentY + 4.5);
    currentY += 8;

    const defaultSpecsDict: Record<string, string> = {
      'Plywood': '18mm BWP Ply — DT Platinum',
      'Outer Laminate': '1.0mm thick up to Rs. 1,600/sheet — Glossy or Matt finish',
      'Inner Laminate': '0.8mm Fabric Liner',
      'Edge Finish': '2mm thick PVC edge tape',
      'Hinges': 'Ebco',
      'Channels': 'Ebco',
      'Handles': 'SS finish — small up to Rs. 100, big up to Rs. 250',
      'Glass': 'Modi Guard / Saint Gobain',
      'Drawers': '2 per bedroom wardrobe — Rs. 3,000 extra per drawer',
      'Kitchen Ply': 'Royale Touche (lifetime warranty) for base; 710 Gurjan BWP elsewhere',
      'Kitchen Shutters': '1mm High Glossy Laminate; 0.8mm Fabric Liner inside',
      'Kitchen Accessories': 'Sleek brand tandem baskets',
      'False Ceiling Board': 'Saint Gobain Gyproc 12mm Gypsum',
      'FC Channels': 'Ultra channels 0.4 & 0.6mm',
      'Wiring': 'Finolex or equivalent grade, flexible piping',
    };

    const rawSpecs = quotation?.material_specs || defaultSpecsDict;
    const rawEntries = Array.isArray(rawSpecs)
      ? rawSpecs
      : Object.entries(rawSpecs).map(([label, val]) => [label, String(val)]);

    const specs = rawEntries.map(([label, val]) => [
      String(label).replace(/₹/g, 'Rs. '),
      String(val).replace(/₹/g, 'Rs. ')
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Material / Category', 'Approved Specification / Brand']],
      body: specs,
      theme: 'grid',
      headStyles: { fillColor: [245, 197, 24], textColor: [43, 43, 43], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 132 } },
      styles: { fontSize: 7.5, cellPadding: 1.5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 8. TERMS & CONDITIONS
    if (currentY + 60 > 260) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(43, 43, 43);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('TERMS & CONDITIONS', 18, currentY + 4.5);
    currentY += 8;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const termsList = [
      '1. Main power supply will be under customer scope of work.',
      '2. Any additional works will be charged extra.',
      '3. A maximum of 2 revisions of the 3D design are included in the project scope. Any additional revisions requested beyond this will be charged separately.',
      '4. Material once purchased cannot be cancelled.',
      '5. Final price may vary +-5-10% based on actual site measurements.',
      '6. Changes in design, materials or finishes will result in a corresponding revision of quote.',
      '7. GST will be charged extra as applicable.',
      '8. Validity of this quotation is 30 days from the date of issue.'
    ];
    termsList.forEach(term => {
      const lines = doc.splitTextToSize(term, 180);
      doc.text(lines, 14, currentY);
      currentY += (lines.length * 4.5);
    });

    // 9. FOOTER BAR
    currentY += 4;
    doc.setFillColor(43, 43, 43);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('APPLE INTERIORS', 18, currentY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(187, 187, 187);
    doc.text('· Kukatpally, Hyderabad · +91 9603 9603 37 · +91 91606 77899 · www.appleinteriors.in', 46, currentY + 4.2);

    return Buffer.from(doc.output('arraybuffer'));
}
