import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perm = await verifyPermission(user.id, 'crm.manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied: crm.manage required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const leadId = formData.get('lead_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const originalName = file.name || 'floor_plan.pdf';
    const extension = originalName.split('.').pop() || 'bin';
    const safeBaseName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);

    const fileName = `crm-floor-plans/${leadId ? leadId : user.id}_${Date.now()}_${safeBaseName}.${extension}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('design-files')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadErr) {
      console.error('Storage Upload Error for Floor Plan:', uploadErr);
      return NextResponse.json({ error: uploadErr.message || 'Storage upload failed' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('design-files')
      .getPublicUrl(fileName);

    // If leadId is provided, update the lead directly
    if (leadId) {
      // First try updating dedicated columns
      const { error: updateErr } = await supabaseAdmin
        .from('quotation_leads')
        .update({
          floor_plan_url: publicUrl,
          floor_plan_name: originalName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      // If column does not exist yet (pending migration), gracefully save in remarks tag
      if (updateErr && updateErr.code === '42703') {
        const { data: leadData } = await supabaseAdmin
          .from('quotation_leads')
          .select('remarks')
          .eq('id', leadId)
          .single();

        const currentRemarks = leadData?.remarks || '';
        const cleanedRemarks = currentRemarks.replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '').trim();
        const floorPlanMeta = JSON.stringify({ url: publicUrl, name: originalName });
        const newRemarks = `${cleanedRemarks ? cleanedRemarks + ' ' : ''}[FloorPlan: ${floorPlanMeta}]`.trim();

        await supabaseAdmin
          .from('quotation_leads')
          .update({
            remarks: newRemarks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      name: originalName,
    });
  } catch (error: any) {
    console.error('Unexpected error uploading floor plan:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perm = await verifyPermission(user.id, 'crm.manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied: crm.manage required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    // Try setting dedicated columns to null
    const { error: updateErr } = await supabaseAdmin
      .from('quotation_leads')
      .update({
        floor_plan_url: null,
        floor_plan_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // If columns do not exist yet, strip the tag from remarks
    if (updateErr && updateErr.code === '42703') {
      const { data: leadData } = await supabaseAdmin
        .from('quotation_leads')
        .select('remarks')
        .eq('id', leadId)
        .single();

      const currentRemarks = leadData?.remarks || '';
      const cleanedRemarks = currentRemarks.replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '').trim();

      await supabaseAdmin
        .from('quotation_leads')
        .update({
          remarks: cleanedRemarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing floor plan:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
