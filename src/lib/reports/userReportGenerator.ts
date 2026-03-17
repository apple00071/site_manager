import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDateIST } from '../dateUtils';

// Update type definition for jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => jsPDF;
}

export interface UserActivity {
    id: string;
    type: 'update' | 'log';
    project_title: string;
    description: string;
    photos: string[];
    timestamp: string;
    status?: string;
    labor_count?: number;
}

export async function generateUserDailyReport(
    userName: string,
    designation: string,
    date: string,
    activities: UserActivity[]
) {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;

    // 1. Header with Logo
    try {
        const logoPath = '/New-logo.png';
        const response = await fetch(logoPath);
        const blob = await response.blob();
        const base64Logo = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        
        // Center the logo
        const logoWidth = 50; 
        const logoHeight = 15;
        doc.addImage(base64Logo, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
    } catch (e) {
        console.warn('Could not load logo in PDF:', e);
        // Fallback to text header
        doc.setFontSize(22);
        doc.setTextColor(202, 160, 45); // Brand Gold
        doc.text('APPLE INTERIORS', pageWidth / 2, 20, { align: 'center' });
    }

    // 2. Report Title & Info
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY ACTIVITY RECAP', pageWidth / 2, 35, { align: 'center' });

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, 40, pageWidth - margin, 40);

    // Meta Grid
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    doc.text('Employee:', margin, 50);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`${userName} (${designation || 'Site Engineer'})`, margin + 25, 50);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Report Date:', margin, 57);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(formatDateIST(date).split(',')[0], margin + 25, 57);

    // IST Generation Time
    const now = new Date();
    const istTime = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated at: ${istTime} IST`, pageWidth - margin, 57, { align: 'right' });

    // 3. Activities Table
    const tableBody = activities.map((act) => [
        new Date(act.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        act.project_title,
        act.type === 'update' ? 'Timeline Update' : 'Work Entry',
        act.description
    ]);

    doc.autoTable({
        startY: 65,
        head: [['Time', 'Project', 'Type', 'Description']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [202, 160, 45], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 'auto' }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    // 4. Footer
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('This is a computer generated activity report.', pageWidth / 2, finalY + 20, { align: 'center' });

    doc.save(`Activity_Recap_${userName.replace(/\s+/g, '_')}_${date}.pdf`);
}
