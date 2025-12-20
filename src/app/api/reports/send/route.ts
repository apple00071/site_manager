import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateDPR } from '@/lib/reports/pdfGenerator';
import { sendDPRWhatsAppNotification } from '@/lib/whatsapp';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const { report_id } = await request.json();

        if (!report_id) {
            return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
        }

        // 1. Fetch Report and Project Details
        const { data: report, error: rError } = await supabaseAdmin
            .from('progress_reports')
            .select('*, project:projects(*)')
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
                // WhatsApp
                if (sub.phone_number) {
                    await sendDPRWhatsAppNotification(
                        sub.phone_number,
                        publicUrl,
                        report.project.title,
                        dateStr
                    );
                }

                // Email (Placeholder logic - requires SMTP env vars)
                if (sub.email && process.env.SMTP_USER) {
                    try {
                        const transporter = nodemailer.createTransport({
                            host: process.env.SMTP_HOST,
                            port: Number(process.env.SMTP_PORT),
                            secure: true,
                            auth: {
                                user: process.env.SMTP_USER,
                                pass: process.env.SMTP_PASS,
                            },
                        });

                        await transporter.sendMail({
                            from: `"Apple Interiors" <${process.env.SMTP_USER}>`,
                            to: sub.email,
                            subject: `Daily Progress Report - ${report.project.title} - ${dateStr}`,
                            text: `A new Progress Report has been generated for ${report.project.title}.\n\nView full report: ${publicUrl}`,
                            html: `<p>A new Progress Report has been generated for <b>${report.project.title}</b>.</p><p><a href="${publicUrl}">Click here to view the full PDF report.</a></p>`,
                        });
                    } catch (e) {
                        console.error('Email failed for', sub.email, e);
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
