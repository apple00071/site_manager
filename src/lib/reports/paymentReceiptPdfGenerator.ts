import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from './logoBase64';
import { formatDateIST } from '@/lib/dateUtils';

export interface PaymentReceiptData {
  id?: string;
  receipt_number?: string | null;
  seq_number?: number | null;
  project_id?: string;
  amount: number;
  payment_date: string;
  milestone_name: string;
  payment_mode: string;
  reference_number?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
  project?: {
    title?: string;
    customer_name?: string | null;
    client?: {
      name?: string;
      phone?: string;
      email?: string;
    } | null;
    site_project?: string | null;
  } | null;
}

export function numberToIndianWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    } else {
      str += a[n];
    }
    return str;
  };

  let n = Math.floor(Math.abs(num));
  let str = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  const rest = n;

  if (crore > 0) {
    str += inWords(crore) + 'Crore ';
  }
  if (lakh > 0) {
    str += inWords(lakh) + 'Lakh ';
  }
  if (thousand > 0) {
    str += inWords(thousand) + 'Thousand ';
  }
  if (hundred > 0) {
    str += inWords(hundred) + 'Hundred ';
  }
  if (rest > 0) {
    str += (str ? 'and ' : '') + inWords(rest);
  }

  const trimmed = str.trim();
  return trimmed ? `${trimmed} Rupees Only` : 'Zero Rupees Only';
}

// Helper to split text by whitespace, underscores, or hyphens so long names
// like "Vidhyulatha_GothicPentagon_B608_3BHK_Bachupally" wrap naturally without clipping through dividers
function splitPdfText(doc: any, text: string, maxWidth: number): string[] {
  if (!text) return [];

  const segments = text.split(/([_ \-]+)/);
  const lines: string[] = [];
  let currentLine = '';

  for (const seg of segments) {
    if (!seg) continue;
    const candidate = currentLine + seg;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine.trim()) {
        lines.push(currentLine.replace(/[_\s\-]+$/, ''));
        currentLine = '';
      }
      if (doc.getTextWidth(seg) > maxWidth) {
        let chunk = '';
        for (const ch of seg) {
          if (doc.getTextWidth(chunk + ch) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = seg.replace(/^[_\s\-]+/, '');
      }
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.replace(/[_\s\-]+$/, ''));
  }

  return lines.length > 0 ? lines : [text];
}

export function generatePaymentReceiptPDF(payment: PaymentReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as any;

  const dateObj = payment.payment_date ? new Date(payment.payment_date) : new Date();
  const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const seq = payment.seq_number ? String(payment.seq_number).padStart(3, '0') : '001';
  const receiptNo = payment.receipt_number || `AI/REC-${year}-${seq}`;
  const formattedDate = payment.payment_date ? formatDateIST(payment.payment_date) : formatDateIST(new Date().toISOString());

  // 0. TOP ACCENT BAR (#f5c518 Amber Gold)
  doc.setFillColor(245, 197, 24);
  doc.rect(14, 10, 182, 2.5, 'F');

  // 1. TOP HEADER BANNER (Dark Slate Bar matching App Branding #2b2b2b)
  doc.setFillColor(43, 43, 43);
  doc.rect(14, 12.5, 182, 28, 'F');

  // White Logo Box on Left
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(17, 14, 54, 25, 2, 2, 'F');

  try {
    doc.addImage(LOGO_BASE64, 'PNG', 18.5, 15.5, 51, 22);
  } catch (e) {
    console.error('Error rendering embedded logo in receipt PDF:', e);
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
  doc.text('Apple Interiors', 190, 20, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(210, 210, 210);
  doc.text('Kukatpally, Hyderabad - 500072', 190, 25.5, { align: 'right' });
  doc.text('+91 9603 9603 37 · +91 91606 77899', 190, 30.5, { align: 'right' });
  doc.text('www.appleinteriors.in', 190, 35.5, { align: 'right' });

  // 2. RECEIPT TITLE
  let y = 49;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55); // Gray 800
  doc.text('PAYMENT RECEIPT', 14, y);

  // Thin separator line
  y += 5;
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.setLineWidth(0.4);
  doc.line(14, y, 196, y);

  // 3. TWO-COLUMN METADATA GRID (Client & Payment Information)
  y += 6;
  const boxTop = y;
  const boxHeight = 42;

  // Background card for metadata
  doc.setFillColor(249, 250, 251); // Gray-50
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, boxTop, 182, boxHeight, 2, 2, 'FD');

  const clientName = payment.project?.customer_name || payment.project?.client?.name || 'Valued Client';
  const projectTitle = payment.project?.title || 'Interior Project';
  const clientPhone = payment.project?.client?.phone || '-';

  // Left Column: Received From
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175); // Gray-400
  doc.text('RECEIVED WITH THANKS FROM:', 20, boxTop + 7);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // Gray-900
  const clientLines = splitPdfText(doc, clientName, 80);
  doc.text(clientLines[0] || clientName, 20, boxTop + 13.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.text('Project:', 20, boxTop + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  // Available width between x=35 and divider at x=105 (with safety margin) is 65mm
  const projectLines = splitPdfText(doc, projectTitle, 65);
  const displayProjectLines = projectLines.slice(0, 2);
  displayProjectLines.forEach((line, idx) => {
    doc.text(line, 35, boxTop + 20 + idx * 4.5);
  });

  if (clientPhone && clientPhone !== '-') {
    const phoneY = displayProjectLines.length > 1 ? boxTop + 31 : boxTop + 27;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Phone:', 20, phoneY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    doc.text(clientPhone, 35, phoneY);
  }

  // Vertical divider between columns
  doc.setDrawColor(229, 231, 235);
  doc.line(105, boxTop + 4, 105, boxTop + boxHeight - 4);

  // Right Column: Receipt & Transaction Identifiers
  doc.setFontSize(8.5);
  const rightX = 112;
  const valX = 145;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Receipt No:', rightX, boxTop + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(receiptNo, valX, boxTop + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Receipt Date:', rightX, boxTop + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text(formattedDate, valX, boxTop + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Payment Mode:', rightX, boxTop + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text(payment.payment_mode || 'Bank Transfer', valX, boxTop + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Ref / UTR No:', rightX, boxTop + 27.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text(payment.reference_number || 'N/A', valX, boxTop + 27.5);

  if (payment.invoice_number) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Invoice Ref:', rightX, boxTop + 34);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    doc.text(payment.invoice_number, valX, boxTop + 34);
  }

  y = boxTop + boxHeight + 8;

  // 4. PAYMENT ITEMS TABLE (autoTable)
  const numAmount = Number(payment.amount) || 0;
  const formattedAmount = `INR ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const refLabel = payment.payment_mode === 'Bank Transfer' ? 'UTR' : payment.payment_mode === 'Cheque' ? 'Cheque #' : 'Ref';
  const tableBody = [
    [
      '1',
      payment.milestone_name || 'Client Payment',
      payment.payment_mode + (payment.reference_number ? ` (${refLabel}: ${payment.reference_number})` : ''),
      formattedAmount
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Particulars / Description', 'Payment Details', 'Amount']],
    body: tableBody,
    foot: [['', 'TOTAL RECEIVED', '', formattedAmount]],
    theme: 'grid',
    headStyles: {
      fillColor: [43, 43, 43],
      textColor: [245, 197, 24],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 52 },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] },
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'right',
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [229, 231, 235],
      lineWidth: 0.3,
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // 5. AMOUNT IN WORDS BOX
  doc.setFillColor(254, 252, 232); // Amber-50
  doc.setDrawColor(254, 240, 138); // Amber-200
  doc.roundedRect(14, y, 182, 11, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(133, 77, 14); // Amber-800
  doc.text('Amount in Words:', 18, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  const words = numberToIndianWords(numAmount);
  const splitWords = doc.splitTextToSize(words, 142);
  doc.text(splitWords, 48, y + 5);

  y += 15;

  // 6. NOTES / REMARKS (if provided)
  if (payment.notes) {
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(14, y, 182, 12, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Notes / Remarks:', 18, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    const splitNotes = doc.splitTextToSize(payment.notes, 140);
    doc.text(splitNotes, 48, y + 4.5);

    y += 16;
  }

  // 7. FOOTER NOTE (Digitally Generated - No Signature Required)
  const footerY = Math.max(y + 12, 175);

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, footerY, 182, 13, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('This is a digitally generated receipt. No signature required', 105, footerY + 8, { align: 'center' });

  // Bottom Amber Gold Bar
  doc.setFillColor(245, 197, 24);
  doc.rect(14, footerY + 18, 182, 1.5, 'F');

  return doc;
}

export function downloadPaymentReceiptPDF(payment: PaymentReceiptData, filename?: string): void {
  const doc = generatePaymentReceiptPDF(payment);
  const dateObj = payment.payment_date ? new Date(payment.payment_date) : new Date();
  const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const seq = payment.seq_number ? String(payment.seq_number).padStart(3, '0') : '001';
  const receiptNo = payment.receipt_number || `AI/REC-${year}-${seq}`;
  const cleanReceiptNo = receiptNo.replace(/[\/\\?%*:|"<>]/g, '_');
  const name = filename || `Receipt_${cleanReceiptNo}.pdf`;
  doc.save(name);
}
