import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// Seed sample data in case the SQL table is not yet created in the database
import fallbackLeads from './fallback_leads.json';

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
      return NextResponse.json({ success: true, data: fallbackLeads, warning: 'Database client not initialized. Serving sample data.' });
    }

    // Try fetching from the database
    const { data, error } = await supabaseAdmin
      .from('quotation_leads')
      .select('*')
      .order('created_date', { ascending: false })
      .order('ref_no', { ascending: false });

    if (error) {
      console.warn('Could not fetch from quotation_leads table (it might not be created yet):', error.message);
      // Fail-safe: Serve mock data so the app won't break locally
      return NextResponse.json({ 
        success: true, 
        data: fallbackLeads, 
        warning: 'quotation_leads table not found. Serving sample data.',
        db_error: error.message
      });
    }

    return NextResponse.json({ success: true, data });
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

    const { data, error } = await supabaseAdmin
      .from('quotation_leads')
      .update({
        ...updateFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

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

    const { error } = await supabaseAdmin
      .from('quotation_leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err: any) {
    console.error('CRM DELETE API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
