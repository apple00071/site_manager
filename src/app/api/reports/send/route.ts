import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateDPR } from '@/lib/reports/pdfGenerator';
import { sendDPRWhatsAppNotification } from '@/lib/whatsapp';
import { NotificationService } from '@/lib/notificationService';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const { report_id } = await request.json();

        if (!report_id) {
            return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
        }

        // 1. Fetch Report and Project Details with viewpoint photos
        const { data: report, error: rError } = await supabaseAdmin
            .from('progress_reports')
            .select(`
                *,
                project:projects(*),
                viewpoint_photos:report_viewpoint_photos(*)
            `)
            .eq('id', report_id)
            .single();

        if (rError || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

        // 2. Generate PDF
        const pdfBuffer = await generateDPR(report, report.project);

        // 3. Upload to Supabase Storage
        const fileName = `${report.project_id}/DPR_${report.report_date}_${Date.now()}.pdf`;
        const { data: uploadData, error: uError } = await supabaseAdmin.storage
            .from('project-documents')
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uError) {
            console.error('Storage Upload Error:', uError);
            // Fallback: Continue with link if storage fails? No, need the link.
            return NextResponse.json({ error: 'Failed to upload report' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('project-documents')
            .getPublicUrl(fileName);

        // 4. Update Report with PDF URL
        await supabaseAdmin
            .from('progress_reports')
            .update({ pdf_url: publicUrl, status: 'submitted' })
            .eq('id', report_id);

        // 5. Broadcast to Subscribers
        const { data: subscribers } = await supabaseAdmin
            .from('report_subscribers')
            .select('*')
            .eq('project_id', report.project_id);

        if (subscribers && subscribers.length > 0) {
            const dateStr = new Date(report.report_date).toLocaleDateString();

            for (const sub of subscribers) {
                // Unified Notification via NotificationService (Push + WhatsApp)
                if (sub.user_id) {
                    try {
                        await NotificationService.notifyReportGenerated(
                            sub.user_id,
                            report.project.title,
                            dateStr,
                            publicUrl
                        );
                    } catch (notifErr) {
                        console.error('Unified notification failed for report:', sub.user_id, notifErr);
                    }
                } else if (sub.phone_number) {
                    // Fallback for subscribers without user_id but with phone
                    try {
                        const waMessage = `🔔 *DPR Generated*\n\nA new Progress Report (DPR) for "${report.project.title}" (${dateStr}) has been generated.\n\nView PDF: ${publicUrl}`;
                        await sendDPRWhatsAppNotification(sub.phone_number, publicUrl, report.project.title, dateStr);
                    } catch (waErr) {
                        console.error('WhatsApp fallback failed for report:', sub.phone_number, waErr);
                    }
                }
            }
        }

        return NextResponse.json({ success: true, pdf_url: publicUrl });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
