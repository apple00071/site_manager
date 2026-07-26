import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const leadId = formData.get('lead_id') as string | null;
    const refNo = formData.get('ref_no') as string | null;

    if (!file || !leadId) {
      return NextResponse.json({ error: 'file and lead_id are required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const clientName = (formData.get('client_name') as string | null) || 'Client';
    const versionStr = (formData.get('version') as string | null) || '';
    const versionTag = versionStr ? `_v${versionStr}` : '';
    const cleanName = clientName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const fileName = `quotations/${leadId}/Apple_Interior_Quotation_${cleanName}${versionTag}.pdf`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('project-documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr) {
      console.error('Storage Upload Error:', uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('project-documents')
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Error uploading quotation PDF:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
