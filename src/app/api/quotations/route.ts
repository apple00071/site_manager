import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/quotations?lead_id=xxx — fetch quotations for a lead (with items)
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leadId = request.nextUrl.searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const { data: quotations, error } = await supabaseAdmin
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('lead_id', leadId)
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: quotations });
}

// POST /api/quotations — create quotation (or new version if one exists)
export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { lead_id, items, discount_type, discount_value, notes, material_specs } = body;

  if (!lead_id || !Array.isArray(items)) {
    return NextResponse.json({ error: 'lead_id and items required' }, { status: 400 });
  }

  // Get current max version for this lead
  const { data: existing } = await supabaseAdmin
    .from('quotations')
    .select('version')
    .eq('lead_id', lead_id)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

  // Compute totals
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const discType = discount_type || 'none';
  const discVal = Number(discount_value) || 0;
  let finalAmount = subtotal;
  if (discType === 'percent') finalAmount = subtotal - (subtotal * discVal) / 100;
  else if (discType === 'flat') finalAmount = subtotal - discVal;
  finalAmount = Math.max(0, finalAmount);

  // Insert quotation
  const { data: quotation, error: qErr } = await supabaseAdmin
    .from('quotations')
    .insert({
      lead_id,
      version: nextVersion,
      subtotal,
      discount_type: discType,
      discount_value: discVal,
      final_amount: finalAmount,
      notes: notes || '',
      material_specs: material_specs || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // Insert items
  const itemRows = items.map((item: any, idx: number) => ({
    quotation_id: quotation.id,
    section: item.section,
    item_name: item.item_name,
    is_lumpsum: !!item.is_lumpsum,
    length_ft: item.is_lumpsum ? null : (Number(item.length_ft) || null),
    width_ft: item.is_lumpsum ? null : (Number(item.width_ft) || null),
    area_sqft: Number(item.area_sqft) || 0,
    unit: item.unit || 'sqft',
    rate: Number(item.rate) || 0,
    amount: Number(item.amount) || 0,
    sort_order: idx,
  }));

  const { error: itemErr } = await supabaseAdmin.from('quotation_items').insert(itemRows);
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // Update lead: quote_value, latest_quotation_id, quote_version, status → 'Sent'
  await supabaseAdmin
    .from('quotation_leads')
    .update({
      quote_value: finalAmount,
      latest_quotation_id: quotation.id,
      quote_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead_id);

  return NextResponse.json({ data: { ...quotation, quotation_items: itemRows } });
}

// DELETE /api/quotations?id=xxx — delete a specific quotation version
export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('quotations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
