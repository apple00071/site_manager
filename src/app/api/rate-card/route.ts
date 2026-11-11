import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/rate-card — list all items grouped by section for the active branch
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { getActiveBranch } = await import('@/lib/branch-helper');
  const activeBranch = getActiveBranch(request, user);
  const targetBranch = activeBranch !== 'all' ? activeBranch : 'Kukatpally';

  let hasBranchCol = true;
  let { data, error } = await supabaseAdmin
    .from('rate_card')
    .select('*')
    .eq('is_active', true)
    .eq('branch', targetBranch)
    .order('section')
    .order('sort_order');

  // Fallback if branch column is not migrated yet in public.rate_card
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    hasBranchCol = false;
    const fallback = await supabaseAdmin
      .from('rate_card')
      .select('*')
      .eq('is_active', true)
      .order('section')
      .order('sort_order');
    data = fallback.data;
    error = fallback.error;
  }

  // If targetBranch (e.g. 'AS Rao Nagar') is empty and branch column exists,
  // automatically pre-seed it with a copy of Kukatpally items
  if (hasBranchCol && targetBranch !== 'Kukatpally' && (!data || data.length === 0)) {
    try {
      const { data: baseItems } = await supabaseAdmin
        .from('rate_card')
        .select('*')
        .eq('is_active', true)
        .or('branch.eq.Kukatpally,branch.is.null')
        .order('section')
        .order('sort_order');

      if (baseItems && baseItems.length > 0) {
        const itemsToSeed = baseItems.map((item: any) => ({
          section: item.section,
          item_name: item.item_name,
          unit: item.unit,
          default_rate: item.default_rate,
          is_lumpsum: item.is_lumpsum,
          sort_order: item.sort_order,
          is_active: true,
          branch: targetBranch,
        }));

        const { data: seeded } = await supabaseAdmin
          .from('rate_card')
          .insert(itemsToSeed)
          .select();

        if (seeded && seeded.length > 0) {
          data = seeded;
        }
      }
    } catch (seedErr) {
      console.error('Error pre-seeding branch rate card:', seedErr);
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate items per section and default Quartz Top -> Granite Top
  const seenMap = new Map<string, any>();
  const cleanedData: any[] = [];

  (data || []).forEach((item: any) => {
    let itemName = item.item_name ? item.item_name.trim() : '';
    let section = item.section ? item.section.trim() : '';

    if (itemName.toLowerCase() === 'quartz top' || itemName.toLowerCase() === 'quartz') {
      itemName = 'Granite Top';
      supabaseAdmin.from('rate_card').update({ item_name: 'Granite Top' }).eq('id', item.id).then();
    }

    const baseSection = section.toLowerCase();
    const baseName = itemName
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/[-—–]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const baseKey = `${baseSection}::${baseName}`;

    if (!seenMap.has(baseKey)) {
      const normalizedItem = { ...item, section, item_name: itemName, branch: item.branch || targetBranch };
      seenMap.set(baseKey, normalizedItem);
      cleanedData.push(normalizedItem);
    } else {
      // Deactivate duplicate entry in background database
      supabaseAdmin.from('rate_card').update({ is_active: false }).eq('id', item.id).then();
    }
  });

  return NextResponse.json({ data: cleanedData, branch: targetBranch });
}

// POST /api/rate-card — admin: add item for the specific branch
export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { verifyPermission } = await import('@/lib/rbac');
  const perm = await verifyPermission(user.id, 'rate_card.manage');
  const permCrm = await verifyPermission(user.id, 'crm.manage');
  if (!perm.allowed && !permCrm.allowed) return NextResponse.json({ error: 'Permission denied: rate_card.manage or crm.manage required' }, { status: 403 });

  const body = await request.json();
  const { section, item_name, unit, default_rate, is_lumpsum, sort_order } = body;

  if (!section || !item_name) return NextResponse.json({ error: 'section and item_name required' }, { status: 400 });

  const { getActiveBranch } = await import('@/lib/branch-helper');
  const { isSuperAdminUser } = await import('@/lib/branch-constants');
  const activeBranch = getActiveBranch(request, user);
  const branchToSave = (body.branch && isSuperAdminUser(user))
    ? body.branch
    : (activeBranch !== 'all' ? activeBranch : 'Kukatpally');

  const insertPayload: any = {
    section,
    item_name,
    unit: unit || 'sqft',
    default_rate: Number(default_rate) || 0,
    is_lumpsum: !!is_lumpsum,
    sort_order: sort_order || 0,
    branch: branchToSave,
  };

  let { data, error } = await supabaseAdmin
    .from('rate_card')
    .insert(insertPayload)
    .select()
    .single();

  // Fallback if branch column is not migrated yet
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    delete insertPayload.branch;
    const retry = await supabaseAdmin
      .from('rate_card')
      .insert(insertPayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PUT /api/rate-card — admin: update item
export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { verifyPermission: verifyPermPut } = await import('@/lib/rbac');
  const permPut = await verifyPermPut(user.id, 'rate_card.manage');
  const permCrmPut = await verifyPermPut(user.id, 'crm.manage');
  if (!permPut.allowed && !permCrmPut.allowed) return NextResponse.json({ error: 'Permission denied: rate_card.manage or crm.manage required' }, { status: 403 });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let { data, error } = await supabaseAdmin
    .from('rate_card')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  // Fallback if branch column is not migrated yet
  if (error && (error.code === '42703' || error.code === 'PGRST204') && fields.branch) {
    delete fields.branch;
    const retry = await supabaseAdmin
      .from('rate_card')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/rate-card?id=xxx — admin: deactivate item
export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { verifyPermission: verifyPermDel } = await import('@/lib/rbac');
  const permDel = await verifyPermDel(user.id, 'rate_card.manage');
  const permCrmDel = await verifyPermDel(user.id, 'crm.manage');
  if (!permDel.allowed && !permCrmDel.allowed) return NextResponse.json({ error: 'Permission denied: rate_card.manage or crm.manage required' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('rate_card')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
