import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';



export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissionResult = await verifyPermission(user.id, 'crm.view');
    if (!permissionResult.allowed) {
      return NextResponse.json({ error: permissionResult.message }, { status: permissionResult.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Try fetching from the database
    const { data: leads, error } = await supabaseAdmin
      .from('quotation_leads')
      .select('*')
      .order('created_date', { ascending: true })
      .order('ref_no', { ascending: true });

    if (error) {
      console.error('Error fetching quotation_leads:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reconcile latest_quotation_id, quote_version, and quote_value directly from quotations table
    if (leads && leads.length > 0) {
      const allLeadIds = leads.map((l: any) => l.id);
      try {
        const { data: allQuotes } = await supabaseAdmin
          .from('quotations')
          .select('id, lead_id, version, final_amount')
          .in('lead_id', allLeadIds)
          .order('version', { ascending: false });

        if (allQuotes && allQuotes.length > 0) {
          const latestQuoteByLead: Record<string, { id: string; version: number; final_amount: number }> = {};
          for (const q of allQuotes) {
            // Keep the latest version per lead
            if (!latestQuoteByLead[q.lead_id]) {
              latestQuoteByLead[q.lead_id] = {
                id: q.id,
                version: q.version,
                final_amount: Number(q.final_amount) || 0,
              };
            }
          }

          const leadsToBackfill: { id: string; quote_value: number; latest_quotation_id: string; quote_version: number }[] = [];

          for (const l of leads) {
            const q = latestQuoteByLead[l.id];
            if (q) {
              const prevVal = Number(l.quote_value) || 0;
              const hasDiff =
                !l.latest_quotation_id ||
                l.latest_quotation_id !== q.id ||
                l.quote_version !== q.version ||
                (q.final_amount > 0 && (prevVal === 0 || prevVal !== q.final_amount));

              l.latest_quotation_id = q.id;
              l.quote_version = q.version;
              if (q.final_amount > 0) {
                l.quote_value = q.final_amount;
              }

              if (hasDiff) {
                leadsToBackfill.push({
                  id: l.id,
                  quote_value: l.quote_value,
                  latest_quotation_id: q.id,
                  quote_version: q.version,
                });
              }
            }
          }

          if (leadsToBackfill.length > 0) {
            Promise.all(
              leadsToBackfill.map(bf =>
                supabaseAdmin
                  .from('quotation_leads')
                  .update({
                    quote_value: bf.quote_value,
                    latest_quotation_id: bf.latest_quotation_id,
                    quote_version: bf.quote_version,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', bf.id)
              )
            ).catch(err => console.warn('Background backfill error:', err));
          }
        }
      } catch (reconcileErr) {
        console.warn('Error reconciling quotations for CRM leads:', reconcileErr);
      }
    }

    return NextResponse.json({ success: true, data: leads });
  } catch (err: any) {
    console.error('CRM GET API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Generate ref_no automatically if not provided
    let ref_no = body.ref_no;
    if (!ref_no) {
      const year = new Date().getFullYear();
      const refPrefix = `AI/QTN/${year}/`;
      
      const { data: latestLeads } = await supabaseAdmin
        .from('quotation_leads')
        .select('ref_no')
        .like('ref_no', `${refPrefix}%`)
        .order('ref_no', { ascending: false })
        .limit(1);

      let nextSeq = 1;
      if (latestLeads && latestLeads.length > 0) {
        const parts = latestLeads[0].ref_no.split('/');
        const lastPart = parts[parts.length - 1];
        const parsedSeq = parseInt(lastPart, 10);
        if (!isNaN(parsedSeq)) {
          nextSeq = parsedSeq + 1;
        }
      }
      ref_no = `${refPrefix}${String(nextSeq).padStart(3, '0')}`;
    }

    const newLead = {
      ref_no,
      created_date: body.created_date || new Date().toISOString().split('T')[0],
      client_name: body.client_name || 'New Client',
      phone: body.phone || '',
      site_project: body.site_project || '',
      area_sqft: Number(body.area_sqft) || 0,
      quote_value: Number(body.quote_value) || 0,
      status: body.status || 'Draft',
      approved_value: Number(body.approved_value) || 0,
      assigned_by: body.assigned_by || '',
      follow_up_1: body.follow_up_1 || '',
      follow_up_2: body.follow_up_2 || '',
      follow_up_3: body.follow_up_3 || '',
      remarks: body.remarks || ''
    };

    const { data, error } = await supabaseAdmin
      .from('quotation_leads')
      .insert(newLead)
      .select()
      .single();

    if (error) {
      console.error('Error inserting quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('CRM POST API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const ids = Array.isArray(id) ? id : typeof id === 'string' && id.includes(',') ? id.split(',') : [id];

    // Guard against modifying Approved leads without crm.edit_approved permission
    const { data: currentLeads } = await supabaseAdmin
      .from('quotation_leads')
      .select('id, status')
      .in('id', ids);

    const hasApprovedLead = currentLeads?.some((l: any) => l.status === 'Approved');
    if (hasApprovedLead) {
      const editApprovedCheck = await verifyPermission(user.id, 'crm.edit_approved');
      if (!editApprovedCheck.allowed) {
        return NextResponse.json({
          error: 'This lead is approved. Only administrators or users with the "crm.edit_approved" permission can modify approved leads.'
        }, { status: 403 });
      }
    }

    let query = supabaseAdmin
      .from('quotation_leads')
      .update({
        ...updateFields,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    const { data, error } = ids.length === 1 ? await query.single() : await query;

    if (error) {
      console.error('Error updating quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('CRM PUT API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissionResult = await verifyPermission(user.id, 'crm.manage');
    if (!permissionResult.allowed) {
      return NextResponse.json({ error: permissionResult.message }, { status: permissionResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const ids = id.split(',');

    // Guard against deleting Approved leads without crm.edit_approved permission
    const { data: currentLeads } = await supabaseAdmin
      .from('quotation_leads')
      .select('id, status')
      .in('id', ids);

    const hasApprovedLead = currentLeads?.some((l: any) => l.status === 'Approved');
    if (hasApprovedLead) {
      const editApprovedCheck = await verifyPermission(user.id, 'crm.edit_approved');
      if (!editApprovedCheck.allowed) {
        return NextResponse.json({
          error: 'Cannot delete an approved lead. Only administrators or users with the "crm.edit_approved" permission can delete approved leads.'
        }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from('quotation_leads')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Leads deleted successfully' });
  } catch (err: any) {
    console.error('CRM DELETE API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
