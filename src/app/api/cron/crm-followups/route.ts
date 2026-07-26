import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendCRMFollowUpWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Validate Cron Secret if configured
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('⏰ Starting CRM Follow-up Automation Cron Job');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch active leads with follow-up dates matching today
    const { data: leads, error: fetchError } = await supabaseAdmin
      .from('quotation_leads')
      .select('*')
      .not('status', 'in', '("Approved","Rejected")')
      .or(`follow_up_1.like.${todayStr}%,follow_up_2.like.${todayStr}%,follow_up_3.like.${todayStr}%`);

    if (fetchError) {
      console.error('Error fetching leads for follow-up cron:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let sentCount = 0;
    const results = [];

    if (leads && leads.length > 0) {
      for (const lead of leads) {
        if (lead.phone) {
          const sent = await sendCRMFollowUpWhatsAppNotification(
            lead.phone,
            lead.client_name || 'Client',
            lead.ref_no,
            lead.remarks,
            lead.site_project
          );
          if (sent) sentCount++;
          results.push({ leadId: lead.id, ref_no: lead.ref_no, sent });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: leads?.length || 0,
      sent_count: sentCount,
      details: results
    });
  } catch (err: any) {
    console.error('CRM Follow-up Cron Failed:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
