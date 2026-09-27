import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const contractWorkerSchema = z.object({
  vendor_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  secondary_phone: z.string().optional().nullable(),
  trade: z.string().min(1, 'Trade / Skill category is required'),
  skill_level: z.enum(['Helper', 'Semi-Skilled', 'Skilled', 'Master / Foreman']).default('Skilled'),
  wage_type: z.string().min(1).default('Daily Basis'),
  daily_wage: z.coerce.number().min(0).default(0),
  aadhaar_number: z.string().optional().nullable(),
  id_proof_url: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_ifsc: z.string().optional().nullable(),
  upi_id: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  assigned_project_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string(),
  })).optional().nullable(),
});

function parseWorkerMeta(row: any) {
  if (!row) return row;
  let id_proof_url = row.id_proof_url ?? null;
  let documents: Array<{ name: string; url: string }> = [];
  let notes = row.notes ?? '';

  if (notes && notes.includes('<!--doc_list:')) {
    const docListMatch = notes.match(/<!--doc_list:(.*?)-->/);
    if (docListMatch && docListMatch[1]) {
      try {
        documents = JSON.parse(docListMatch[1]);
      } catch (_) {}
      notes = notes.replace(/<!--doc_list:.*?-->/, '').trim();
    }
  }

  if (documents.length === 0 && id_proof_url) {
    documents = [{ name: 'ID Proof Document', url: id_proof_url }];
  } else if (documents.length > 0 && !id_proof_url) {
    id_proof_url = documents[0].url;
  }

  return {
    ...row,
    id_proof_url: id_proof_url || '',
    documents,
    notes,
  };
}

// GET /api/contract-workers - List contract workers
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyPermission } = await import('@/lib/rbac');
    const permView = await verifyPermission(user.id, 'workers.view');
    const permVendorsView = await verifyPermission(user.id, 'vendors.view');
    if (!permView.allowed && !permVendorsView.allowed) {
      return NextResponse.json({ error: 'Permission denied: workers.view required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const vendorId = searchParams.get('vendor_id');
    const projectId = searchParams.get('project_id');
    const trade = searchParams.get('trade');
    const activeOnly = searchParams.get('active');

    let query = supabaseAdmin
      .from('contract_workers')
      .select(`
        *,
        vendor:suppliers(id, name, contact_phone, trade_category, vendor_type),
        assigned_project:projects(id, title, status)
      `)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,aadhaar_number.ilike.%${search}%,emergency_contact_name.ilike.%${search}%`);
    }

    if (vendorId) {
      if (vendorId === 'independent') {
        query = query.is('vendor_id', null);
      } else {
        query = query.eq('vendor_id', vendorId);
      }
    }

    if (projectId) {
      query = query.eq('assigned_project_id', projectId);
    }

    if (trade && trade !== 'all') {
      query = query.eq('trade', trade);
    }

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    } else if (activeOnly === 'false') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching contract workers:', error);
      return NextResponse.json({ error: 'Failed to fetch contract workers', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ workers: (data || []).map(parseWorkerMeta) });
  } catch (error: any) {
    console.error('Unexpected error in contract-workers GET:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

// POST /api/contract-workers - Register a contract worker
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyPermission } = await import('@/lib/rbac');
    const permCreate = await verifyPermission(user.id, 'workers.create');
    const permVendorsCreate = await verifyPermission(user.id, 'vendors.create');
    if (!permCreate.allowed && !permVendorsCreate.allowed) {
      return NextResponse.json({ error: 'Permission denied: workers.create required' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = contractWorkerSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { documents, ...rawInsert } = validationResult.data;
    let initialNotes = rawInsert.notes || '';
    if (documents !== undefined) {
      initialNotes = (initialNotes || '').replace(/<!--doc_list:.*?-->/, '').trim();
      if (documents && documents.length > 0) {
        initialNotes = `${initialNotes ? initialNotes + '\n' : ''}<!--doc_list:${JSON.stringify(documents)}-->`.trim();
      }
    }
    const insertData: any = {
      ...rawInsert,
      notes: initialNotes,
      created_by: user.id,
    };
    if (documents && documents.length > 0 && !insertData.id_proof_url) {
      insertData.id_proof_url = documents[0].url;
    }

    const { data, error } = await supabaseAdmin
      .from('contract_workers')
      .insert(insertData)
      .select(`
        *,
        vendor:suppliers(id, name, contact_phone, trade_category, vendor_type),
        assigned_project:projects(id, title, status)
      `)
      .single();

    if (error) {
      console.error('Error registering contract worker:', error);
      return NextResponse.json({ error: 'Failed to register contract worker', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ worker: parseWorkerMeta(data) }, { status: 201 });
  } catch (error: any) {
    console.error('Unexpected error in contract-workers POST:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

// PATCH /api/contract-workers - Update a contract worker
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyPermission } = await import('@/lib/rbac');
    const permEdit = await verifyPermission(user.id, 'workers.edit');
    const permVendorsEdit = await verifyPermission(user.id, 'vendors.edit');
    if (!permEdit.allowed && !permVendorsEdit.allowed) {
      return NextResponse.json({ error: 'Permission denied: workers.edit required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    const validationResult = contractWorkerSchema.partial().safeParse(updates);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { documents, ...rawUpdates } = validationResult.data;
    const updateData: any = {
      ...rawUpdates,
      updated_at: new Date().toISOString(),
    };

    if (documents !== undefined) {
      let baseNotes = updateData.notes;
      if (baseNotes === undefined) {
        const { data: existingRow } = await supabaseAdmin.from('contract_workers').select('notes').eq('id', id).single();
        baseNotes = existingRow?.notes || '';
      }
      let cleanNotes = (baseNotes || '').replace(/<!--doc_list:.*?-->/, '').trim();
      if (documents && documents.length > 0) {
        cleanNotes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--doc_list:${JSON.stringify(documents)}-->`.trim();
        if (!updateData.id_proof_url) {
          updateData.id_proof_url = documents[0].url;
        }
      } else {
        updateData.id_proof_url = null;
      }
      updateData.notes = cleanNotes;
    }

    const { data, error } = await supabaseAdmin
      .from('contract_workers')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        vendor:suppliers(id, name, contact_phone, trade_category, vendor_type),
        assigned_project:projects(id, title, status)
      `)
      .single();

    if (error) {
      console.error('Error updating contract worker:', error);
      return NextResponse.json({ error: 'Failed to update contract worker', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ worker: parseWorkerMeta(data) });
  } catch (error: any) {
    console.error('Unexpected error in contract-workers PATCH:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

// DELETE /api/contract-workers?id=xxx - Delete a contract worker
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyPermission } = await import('@/lib/rbac');
    const permDelete = await verifyPermission(user.id, 'workers.delete');
    const permVendorsDelete = await verifyPermission(user.id, 'vendors.delete');
    if (!permDelete.allowed && !permVendorsDelete.allowed) {
      return NextResponse.json({ error: 'Permission denied: workers.delete required' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('contract_workers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting contract worker:', error);
      return NextResponse.json({ error: 'Failed to delete contract worker', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error in contract-workers DELETE:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
