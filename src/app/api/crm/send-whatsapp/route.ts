import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { 
  sendCRMQuotationWhatsAppNotification, 
  sendCRMFollowUpWhatsAppNotification,
  sendCustomWhatsAppNotification
} from '@/lib/whatsapp';
import { generateQuotationPDF } from '@/lib/reports/pdfGenerator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissionResult = await verifyPermission(user.id, 'crm.manage');
    if (!permissionResult.allowed) {
      return NextResponse.json({ error: permissionResult.message }, { status: permissionResult.status });
    }

    const body = await request.json();
    const { leadId, actionType, customMessage, quotationUrl } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Fetch lead details
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('quotation_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: 'Client phone number missing for this lead' }, { status: 400 });
    }

    let sent = false;

    if (customMessage) {
      sent = await sendCustomWhatsAppNotification(lead.phone, customMessage);
    } else if (actionType === 'quotation') {
      let finalQuotationUrl = quotationUrl;
      
      if (!finalQuotationUrl) {
        try {
          // Always fetch highest version quotation record for this lead
          let { data: quotation } = await supabaseAdmin
            .from('quotations')
            .select('*, quotation_items(*)')
            .eq('lead_id', leadId)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!quotation && lead.latest_quotation_id) {
            const { data: qData } = await supabaseAdmin
              .from('quotations')
              .select('*, quotation_items(*)')
              .eq('id', lead.latest_quotation_id)
              .maybeSingle();
            quotation = qData;
          }

          // Generate PDF buffer
          const pdfBuffer = await generateQuotationPDF(quotation, lead);
          const cleanName = (lead.client_name || 'Client').trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
          const versionTag = quotation?.version ? `_v${quotation.version}` : '';
          const fileName = `quotations/${lead.id}/Apple_Interior_Quotation_${cleanName}${versionTag}.pdf`;

          // Upload to Supabase Storage
          const { error: uploadErr } = await supabaseAdmin.storage
            .from('project-documents')
            .upload(fileName, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (!uploadErr) {
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('project-documents')
              .getPublicUrl(fileName);
            finalQuotationUrl = publicUrl;
          } else {
            console.error('Storage Upload Error for Quotation PDF:', uploadErr);
          }
        } catch (pdfErr) {
          console.error('Failed to generate/upload quotation PDF:', pdfErr);
        }
      }

      sent = await sendCRMQuotationWhatsAppNotification(
        lead.phone,
        lead.client_name || 'Client',
        lead.ref_no,
        Number(lead.quote_value) || 0,
        lead.site_project,
        finalQuotationUrl
      );
    } else {
      // Default to follow-up
      sent = await sendCRMFollowUpWhatsAppNotification(
        lead.phone,
        lead.client_name || 'Client',
        lead.ref_no,
        lead.remarks,
        lead.site_project
      );
    }

    if (!sent) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send WhatsApp message. Check API credentials or phone number.' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: true, leadId });
  } catch (err: any) {
    console.error('CRM WhatsApp API Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
