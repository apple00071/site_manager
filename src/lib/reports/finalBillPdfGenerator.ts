import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from './logoBase64';
import { formatDateIST } from '@/lib/dateUtils';

export interface FinalBillItem {
  id?: string;
  section?: string | null;
  item_name: string;
  is_lumpsum?: boolean;
  length_ft?: number | null;
  width_ft?: number | null;
  area_sqft?: number;
  unit?: string;
  rate?: number;
  amount: number;
}

export interface FinalBillData {
  projectTitle: string;
  customerName?: string | null;
  projectAddress?: string | null;
  billNumber?: string;
  billDate?: string;
  items: FinalBillItem[];
  subtotal: number;
  discountType?: 'none' | 'percent' | 'flat';
  discountValue?: number;
  discountAmount?: number;
  taxableAmount: number;
  gstRate?: number;
  gstAmount?: number;
  grandTotal: number;
  totalCollected: number;
  netBalanceDue: number;
  notes?: string;
}

export function generateFinalBillPDF(data: FinalBillData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const year = new Date().getFullYear();
  const billNo = data.billNumber || `AI/FB-${year}-${String(Math.floor(100 + Math.random() * 900))}`;
  const formattedDate = data.billDate ? formatDateIST(data.billDate) : formatDateIST(new Date().toISOString());

  // 1. TOP GOLD ACCENT BAR
  doc.setFillColor(245, 197, 24); // #f5c518
  doc.rect(0, 0, 210, 4, 'F');

  // 2. HEADER: BRANDING & DETAILS
  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 10, 40, 18);
  } catch {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 197, 24);
    doc.text('APPLE INTERIORS', 14, 20);
  }

  // Company contact on right
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('APPLE INTERIORS', 196, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('H.No 1-55/4, First Floor, Above SBI Bank,', 196, 17.5, { align: 'right' });
  doc.text('Opp. Pillar No. C1730, Kukatpally, Hyderabad - 500072', 196, 21.5, { align: 'right' });
  doc.text('+91 9603 9603 37 · +91 91606 77899', 196, 25.5, { align: 'right' });
  doc.text('www.appleinteriors.in', 196, 29.5, { align: 'right' });

  // Title: FINAL BILL & SETTLEMENT
  let y = 38;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('FINAL BILL & SETTLEMENT', 14, y);

  // Status Badge
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.setDrawColor(245, 197, 24);
  doc.roundedRect(144, y - 5, 52, 7, 1.5, 1.5, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('FINAL SETTLEMENT BILL', 170, y - 0.5, { align: 'center' });

  y += 4;
  doc.setDrawColor(229, 231, 235);
  doc.line(14, y, 196, y);

  // 3. PROJECT & CLIENT INFO BOX
  y += 5;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, y, 182, 28, 1.5, 1.5, 'FD');

  const col1X = 18;
  const col2X = 120;

  // Left column: Project & Client
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Project / Site:', col1X, y + 6);
  doc.text('Client Name:', col1X, y + 13);
  doc.text('Site Address:', col1X, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(doc.splitTextToSize(data.projectTitle, 75)[0], col1X + 26, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName || 'N/A', col1X + 26, y + 13);
  doc.text(doc.splitTextToSize(data.projectAddress || 'Hyderabad, Telangana', 75)[0], col1X + 26, y + 20);

  // Right column: Bill No & Date
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Bill Number:', col2X, y + 6);
  doc.text('Bill Date:', col2X, y + 13);
  doc.text('Document:', col2X, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(billNo, col2X + 25, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(formattedDate, col2X + 25, y + 13);
  doc.text('Final Invoice Statement', col2X + 25, y + 20);

  y += 34;

  // 4. ITEMS TABLE
  const tableRows = data.items.map((it, idx) => {
    let dimStr = '-';
    if (!it.is_lumpsum && it.length_ft && it.width_ft) {
      dimStr = `${it.length_ft} × ${it.width_ft}`;
    }
    const areaStr = it.is_lumpsum ? 'L.S' : `${Number(it.area_sqft || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${it.unit || 'sft'}`;
    const rateStr = it.rate ? `₹${Number(it.rate).toLocaleString('en-IN')}` : '-';
    const amtStr = `₹${Number(it.amount || 0).toLocaleString('en-IN')}`;

    const desc = it.section ? `[${it.section}] ${it.item_name}` : it.item_name;
    return [String(idx + 1), desc, dimStr, areaStr, rateStr, amtStr];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description of Work / Item', 'Dimensions', 'Area / Qty', 'Rate', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [43, 43, 43],
      textColor: [245, 197, 24],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      textColor: [31, 41, 55],
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 82 },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY + 6;
  y = finalTableY;

  // If table went too close to bottom, add new page
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  // 5. TOTALS & SUMMARY SECTION (Split Left & Right)
  const boxWidth = 88;
  const leftX = 14;
  const rightX = 108;

  // Left Card: Payment & Balance Settlement
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(leftX, y, boxWidth, 42, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('PAYMENT SETTLEMENT SUMMARY', leftX + 4, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Grand Total Final Bill:', leftX + 4, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`₹${Number(data.grandTotal).toLocaleString('en-IN')}`, leftX + boxWidth - 4, y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Total Payments Received:', leftX + 4, y + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`(-) ₹${Number(data.totalCollected).toLocaleString('en-IN')}`, leftX + boxWidth - 4, y + 21, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(leftX + 4, y + 26, leftX + boxWidth - 4, y + 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text('NET BALANCE DUE:', leftX + 4, y + 34);
  doc.setFontSize(10);
  doc.text(`₹${Math.max(0, Number(data.netBalanceDue)).toLocaleString('en-IN')}`, leftX + boxWidth - 4, y + 34, { align: 'right' });

  // Right Card: Bill Calculations (Subtotal, Discount, GST, Grand Total)
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(rightX, y, boxWidth, 42, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);

  // Subtotal
  doc.text('Items Subtotal:', rightX + 4, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`₹${Number(data.subtotal).toLocaleString('en-IN')}`, rightX + boxWidth - 4, y + 8, { align: 'right' });

  // Discount (if any)
  const disc = Number(data.discountAmount) || 0;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Discount / Adjustment:', rightX + 4, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(disc > 0 ? `(-) ₹${disc.toLocaleString('en-IN')}` : '₹0', rightX + boxWidth - 4, y + 15, { align: 'right' });

  // GST
  const gst = Number(data.gstAmount) || 0;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`GST (${data.gstRate || 0}%):`, rightX + 4, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(gst > 0 ? `(+) ₹${gst.toLocaleString('en-IN')}` : '₹0', rightX + boxWidth - 4, y + 22, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(rightX + 4, y + 27, rightX + boxWidth - 4, y + 27);

  // Grand Total
  doc.setFillColor(43, 43, 43);
  doc.roundedRect(rightX + 2, y + 29, boxWidth - 4, 10, 1, 1, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('FINAL BILL TOTAL:', rightX + 5, y + 35.5);
  doc.setFontSize(9.5);
  doc.setTextColor(245, 197, 24);
  doc.text(`₹${Number(data.grandTotal).toLocaleString('en-IN')}`, rightX + boxWidth - 6, y + 35.5, { align: 'right' });

  // 6. FOOTER NOTICE
  const footerY = y + 48;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, footerY, 182, 9, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('This is a digitally generated final bill. No signature required', 105, footerY + 5.5, { align: 'center' });

  // Bottom Gold Bar
  doc.setFillColor(245, 197, 24);
  doc.rect(14, footerY + 12, 182, 1.5, 'F');

  return doc;
}

export function downloadFinalBillPDF(data: FinalBillData, filename?: string): void {
  const doc = generateFinalBillPDF(data);
  const cleanTitle = (data.projectTitle || 'Project').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
  const name = filename || `Final_Bill_${cleanTitle}.pdf`;
  doc.save(name);
}
