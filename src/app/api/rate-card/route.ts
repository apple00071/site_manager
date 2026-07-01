import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/rate-card — list all items grouped by section
export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('rate_card')
    .select('*')
    .eq('is_active', true)
    .order('section')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/rate-card — admin: add item
export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { section, item_name, unit, default_rate, is_lumpsum, sort_order } = body;

  if (!section || !item_name) return NextResponse.json({ error: 'section and item_name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('rate_card')
    .insert({ section, item_name, unit: unit || 'sqft', default_rate: Number(default_rate) || 0, is_lumpsum: !!is_lumpsum, sort_order: sort_order || 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PUT /api/rate-card — admin: update item
export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('rate_card')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/rate-card?id=xxx — admin: deactivate item
export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('rate_card')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
