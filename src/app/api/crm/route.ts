import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { getActiveBranch } from '@/lib/branch-helper';
import { isSuperAdminUser } from '@/lib/branch-constants';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';



function parseLeadFloorPlan(lead: any) {
  if (!lead) return lead;
  if (!lead.floor_plan_url && lead.remarks) {
    const match = lead.remarks.match(/\[FloorPlan:\s*(\{.*?\})\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        lead.floor_plan_url = parsed.url;
        lead.floor_plan_name = parsed.name || 'Floor Plan';
        lead.remarks = lead.remarks.replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '').trim();
      } catch (_) {}
    }
  }
  return lead;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permCrmView = await verifyPermission(user.id, 'crm.view');
    const permCreateLead = await verifyPermission(user.id, 'leads.create');
    if (!permCrmView.allowed && !permCreateLead.allowed) {
      return NextResponse.json({ error: 'Permission denied. Required: crm.view or leads.create' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Try fetching from the database (latest dates first)
    const { data: rawLeads, error } = await supabaseAdmin
      .from('quotation_leads')
      .select('*')
      .order('created_date', { ascending: false })
      .order('ref_no', { ascending: false });

    if (error) {
      console.error('Error fetching quotation_leads:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leads = (rawLeads || []).map(parseLeadFloorPlan);

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

    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');

    let outputLeads = leads;
    const isMarketingOnly = !permCrmView.allowed && permCreateLead.allowed;

    // Filter to user's own leads if marketing executive or scope=mine requested
    if (isMarketingOnly || scope === 'mine') {
      const userEmail = (user.email || '').toLowerCase();
      const userPrefix = userEmail ? userEmail.split('@')[0] : '';
      const fullName = (user.user_metadata?.full_name || '').toLowerCase();

      outputLeads = leads.filter((l: any) => {
        if (l.created_by && l.created_by === user.id) return true;
        const remarks = (l.remarks || '').toLowerCase();
        if (remarks.includes(user.id.toLowerCase())) return true;
        if (userEmail && remarks.includes(userEmail)) return true;
        const assigned = (l.assigned_by || '').toLowerCase();
        if (userPrefix && assigned.includes(userPrefix)) return true;
        if (fullName && assigned.includes(fullName)) return true;
        return false;
      });

      if (isMarketingOnly) {
        outputLeads.forEach((l: any) => {
          l.quote_value = 0;
          l.approved_value = 0;
        });
      }
    }

    // Branch segregation: filter leads by active/assigned branch
    const activeBranch = getActiveBranch(request, user);
    if (activeBranch !== 'all') {
      outputLeads = outputLeads.filter((l: any) => {
        if (l.branch) return l.branch === activeBranch;
        const remarks = l.remarks || '';
        if (remarks.includes(`[Branch: ${activeBranch}]`)) return true;
        // Default historical records belong to Kukatpally branch
        if (activeBranch === 'Kukatpally') {
          return !l.branch && !remarks.includes('[Branch: AS Rao Nagar]');
        }
        return false;
      });
    }

    return NextResponse.json({ success: true, data: outputLeads });
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

    const permManage = await verifyPermission(user.id, 'crm.manage');
    const permCreateLead = await verifyPermission(user.id, 'leads.create');
    if (!permManage.allowed && !permCreateLead.allowed) {
      return NextResponse.json({ error: 'Permission denied. Required: crm.manage or leads.create' }, { status: 403 });
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

    const newLead: any = {
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
      remarks: body.remarks || '',
      floor_plan_url: body.floor_plan_url || null,
      floor_plan_name: body.floor_plan_name || null,
      created_by: user.id,
    };

    const activeBranch = getActiveBranch(request, user);
    const isSuper = isSuperAdminUser(user);
    const branchToSave = isSuper
      ? (body.branch || (activeBranch !== 'all' ? activeBranch : (user.branch || 'Kukatpally')))
      : (user.branch || 'Kukatpally');
    newLead.branch = branchToSave;

    if (newLead.status === 'Approved' && newLead.quote_value <= 0 && newLead.approved_value <= 0) {
      return NextResponse.json({
        error: 'Cannot create an approved lead with total quotation value of ₹0. Please build a valid quotation first.'
      }, { status: 400 });
    }

    let { data, error } = await supabaseAdmin
      .from('quotation_leads')
      .insert(newLead)
      .select()
      .single();

    // Fallback if floor_plan, created_by, or branch columns are not migrated yet
    if (error && error.code === '42703') {
      delete newLead.created_by;
      delete newLead.branch;
      delete newLead.floor_plan_url;
      delete newLead.floor_plan_name;
      if (body.floor_plan_url) {
        const meta = JSON.stringify({ url: body.floor_plan_url, name: body.floor_plan_name || 'Floor Plan' });
        newLead.remarks = `${newLead.remarks ? newLead.remarks + ' ' : ''}[FloorPlan: ${meta}]`.trim();
      }
      const retry = await supabaseAdmin
        .from('quotation_leads')
        .insert(newLead)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error inserting quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify Admins & CRM managers about the new lead
    try {
      const creatorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'A member';
      const adminIds = await NotificationService.getAdminAndHrUserIds(data.branch || (user as any).branch);
      const recipients = adminIds.filter(id => id !== user.id);

      for (const recipientId of recipients) {
        await NotificationService.createNotification({
          userId: recipientId,
          title: 'New Lead Created',
          message: `${creatorName} registered a new lead: "${data.client_name}" (${data.site_project || 'General Project'}).`,
          type: 'general',
          relatedId: data.id,
          relatedType: 'crm',
          metadata: { leadId: data.id }
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send new lead notification:', notifErr);
    }

    return NextResponse.json({ success: true, data: parseLeadFloorPlan(data) });
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
      .select('id, status, remarks, quote_value, approved_value, branch')
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

    // Guard against approving a lead with zero total value
    if (updateFields.status === 'Approved') {
      const currentLead = currentLeads?.[0];
      const targetQuoteVal = updateFields.quote_value !== undefined ? Number(updateFields.quote_value) : Number(currentLead?.quote_value || 0);
      const targetApprovedVal = updateFields.approved_value !== undefined ? Number(updateFields.approved_value) : Number(currentLead?.approved_value || 0);

      if (targetQuoteVal <= 0 && targetApprovedVal <= 0) {
        return NextResponse.json({
          error: 'Cannot approve quotation: Total quotation value must be greater than ₹0. Please build and save a valid quotation first.'
        }, { status: 400 });
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

    let { data, error } = ids.length === 1 ? await query.single() : await query;

    // Fallback if floor_plan columns are not yet in the DB
    if (error && error.code === '42703' && (updateFields.floor_plan_url !== undefined || updateFields.floor_plan_name !== undefined)) {
      const safeFields = { ...updateFields };
      delete safeFields.floor_plan_url;
      delete safeFields.floor_plan_name;

      const currentRemarks = safeFields.remarks !== undefined ? safeFields.remarks : (currentLeads?.[0]?.remarks || '');
      let newRemarks = currentRemarks.replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '').trim();

      if (updateFields.floor_plan_url) {
        const meta = JSON.stringify({ url: updateFields.floor_plan_url, name: updateFields.floor_plan_name || 'Floor Plan' });
        newRemarks = `${newRemarks ? newRemarks + ' ' : ''}[FloorPlan: ${meta}]`.trim();
      }
      safeFields.remarks = newRemarks;

      const retryQuery = supabaseAdmin
        .from('quotation_leads')
        .update({
          ...safeFields,
          updated_at: new Date().toISOString()
        })
        .in('id', ids)
        .select();

      const retryRes = ids.length === 1 ? await retryQuery.single() : await retryQuery;
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('Error updating quotation lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-sync approved budget to matching project in Finance if budget is unassigned
    try {
      const updatedList = Array.isArray(data) ? data : [data];
      for (const updatedLead of updatedList) {
        const approvedVal = Number(updatedLead.approved_value) || Number(updatedLead.quote_value) || 0;
        if (updatedLead.status === 'Approved' && approvedVal > 0 && updatedLead.client_name) {
          const clientName = updatedLead.client_name.trim();
          const { data: matchedProjs } = await supabaseAdmin
            .from('projects')
            .select('id, project_budget, customer_name, title')
            .or(`customer_name.ilike.%${clientName}%,title.ilike.%${clientName}%`);

          if (matchedProjs && matchedProjs.length > 0) {
            for (const proj of matchedProjs) {
              if (!proj.project_budget || proj.project_budget === 0) {
                await supabaseAdmin
                  .from('projects')
                  .update({ project_budget: approvedVal, updated_at: new Date().toISOString() })
                  .eq('id', proj.id);
              }
            }
          }
        }
      }
    } catch (syncErr) {
      console.error('Error auto-syncing approved quote to project budget:', syncErr);
    }

    // Notify creator & admins when quotation lead is approved
    try {
      if (updateFields.status === 'Approved') {
        const leadBranch = currentLeads?.[0]?.branch || (user as any).branch;
        const adminIds = await NotificationService.getAdminAndHrUserIds(leadBranch);
        const notifyTargetIds = new Set<string>(adminIds);
        if (currentLeads?.[0]?.created_by) {
          notifyTargetIds.add(currentLeads[0].created_by);
        }
        notifyTargetIds.delete(user.id);

        for (const recipientId of Array.from(notifyTargetIds)) {
          await NotificationService.createNotification({
            userId: recipientId,
            title: 'Quotation Approved',
            message: `Quotation for "${currentLeads?.[0]?.client_name || 'Client'}" has been approved.`,
            type: 'general',
            relatedId: currentLeads?.[0]?.id,
            relatedType: 'crm_quotation',
            metadata: { leadId: currentLeads?.[0]?.id }
          });
        }
      }
    } catch (notifErr) {
      console.warn('Failed to send quotation approved notification:', notifErr);
    }

    const result = Array.isArray(data) ? data.map(parseLeadFloorPlan) : parseLeadFloorPlan(data);
    return NextResponse.json({ success: true, data: result });
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
