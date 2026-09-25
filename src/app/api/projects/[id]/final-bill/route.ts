import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/projects/[id]/final-bill — fetch quotation data, items, and financial stats for final bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // 1. Fetch project details
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, title, customer_name, project_budget, status, project_notes, address, area_sqft')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch payments received for this project
    const { data: payments } = await supabaseAdmin
      .from('client_payments')
      .select('id, amount, payment_date, payment_mode, reference_number, milestone_name')
      .eq('project_id', projectId);

    const totalCollected = (payments || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0),
      0
    );
    const currentBudget = Number(project.project_budget) || 0;
    const currentPending = currentBudget > 0 ? Math.max(0, currentBudget - totalCollected) : 0;

    // 3. Search for CRM quotation lead
    // a) Check if project_notes references a quotation ref number e.g. "Ref #123"
    let matchedLead: any = null;
    const refMatch = project.project_notes?.match(/Ref\s*#?([0-9]+)/i);
    if (refMatch && refMatch[1]) {
      const refNo = parseInt(refMatch[1], 10);
      if (!isNaN(refNo)) {
        const { data: leadByRef } = await supabaseAdmin
          .from('quotation_leads')
          .select('id, ref_no, client_name, site_project, quote_value, approved_value, status')
          .eq('ref_no', refNo)
          .maybeSingle();
        if (leadByRef) matchedLead = leadByRef;
      }
    }

    // b) If not found by ref, match by customer_name or site_project
    if (!matchedLead) {
      const cName = (project.customer_name || '').trim();
      const pTitle = (project.title || '').trim();

      const { data: candidateLeads } = await supabaseAdmin
        .from('quotation_leads')
        .select('id, ref_no, client_name, site_project, quote_value, approved_value, status')
        .order('created_at', { ascending: false });

      if (candidateLeads && candidateLeads.length > 0) {
        matchedLead = candidateLeads.find((l: any) => {
          const lClient = (l.client_name || '').toLowerCase().trim();
          const lSite = (l.site_project || '').toLowerCase().trim();
          const targetName = cName.toLowerCase();
          const targetTitle = pTitle.toLowerCase();
          const titlePrefix = (pTitle.split('_')[0] || pTitle.split('-')[0] || '').toLowerCase().trim();

          return (
            (lClient && (
              (targetName && (lClient === targetName || targetName.includes(lClient) || lClient.includes(targetName))) ||
              (targetTitle && (targetTitle.includes(lClient) || lClient.includes(targetTitle))) ||
              (titlePrefix && (titlePrefix === lClient || titlePrefix.includes(lClient) || lClient.includes(titlePrefix)))
            )) ||
            (lSite && (
              (targetTitle && (lSite === targetTitle || targetTitle.includes(lSite) || lSite.includes(targetTitle))) ||
              (targetName && (lSite === targetName || targetName.includes(lSite) || lSite.includes(targetName)))
            ))
          );
        });
      }
    }

    // 4. If lead found, fetch latest quotation and items
    let quotation: any = null;
    let items: any[] = [];

    if (matchedLead) {
      const { data: quotes } = await supabaseAdmin
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('lead_id', matchedLead.id)
        .order('version', { ascending: false })
        .limit(1);

      if (quotes && quotes.length > 0) {
        quotation = quotes[0];
        const rawItems = quotation.quotation_items || [];
        // Sort items by sort_order
        items = rawItems.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      }
    }

    // 5. If project budget is 0, auto-populate from quotation or lead
    let finalBudget = currentBudget;
    if (finalBudget === 0) {
      if (quotation && Number(quotation.final_amount) > 0) {
        finalBudget = Number(quotation.final_amount);
      } else if (matchedLead && Number(matchedLead.approved_value) > 0) {
        finalBudget = Number(matchedLead.approved_value);
      } else if (matchedLead && Number(matchedLead.quote_value) > 0) {
        finalBudget = Number(matchedLead.quote_value);
      }
      if (finalBudget > 0) {
        supabaseAdmin.from('projects').update({ project_budget: finalBudget }).eq('id', projectId).then();
      }
    }
    const finalPending = finalBudget > 0 ? Math.max(0, finalBudget - totalCollected) : 0;

    return NextResponse.json({
      project,
      lead: matchedLead || null,
      quotation: quotation || null,
      items: items.map((it: any) => ({
        id: it.id,
        section: it.section || '',
        item_name: it.item_name || '',
        is_lumpsum: !!it.is_lumpsum,
        length_ft: it.length_ft != null ? Number(it.length_ft) : null,
        width_ft: it.width_ft != null ? Number(it.width_ft) : null,
        area_sqft: Number(it.area_sqft) || 0,
        unit: it.unit || 'sqft',
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || 0,
        sort_order: it.sort_order ?? 0,
      })),
      financials: {
        budget: finalBudget,
        collected: totalCollected,
        pending: finalPending,
      },
      payments: payments || [],
    });
  } catch (err: any) {
    console.error('Error fetching final bill data:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/final-bill — save edited final bill and update project contract budget
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      items = [],
      discount_type = 'none',
      discount_value = 0,
      gst_rate = 0,
      gst_amount = 0,
      final_amount,
      notes = '',
      lead_id = null,
      update_project_budget = true,
    } = body;

    const numFinalAmount = Number(final_amount) || 0;

    // 1. If lead_id exists, save or update a quotation version
    let savedQuotationId: string | null = null;
    if (lead_id) {
      const { data: existingQuotes } = await supabaseAdmin
        .from('quotations')
        .select('version')
        .eq('lead_id', lead_id)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = existingQuotes && existingQuotes.length > 0 ? existingQuotes[0].version + 1 : 1;

      const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);

      const { data: newQuote, error: qErr } = await supabaseAdmin
        .from('quotations')
        .insert({
          lead_id,
          version: nextVersion,
          subtotal,
          discount_type,
          discount_value: Number(discount_value) || 0,
          gst_rate: Number(gst_rate) || 0,
          gst_amount: Number(gst_amount) || 0,
          final_amount: numFinalAmount,
          notes: notes || 'Final Bill & Settlement',
          created_by: user.id,
        })
        .select()
        .single();

      if (!qErr && newQuote) {
        savedQuotationId = newQuote.id;
        const itemRows = items.map((it: any, idx: number) => ({
          quotation_id: newQuote.id,
          section: it.section || '',
          item_name: it.item_name || 'Item',
          is_lumpsum: !!it.is_lumpsum,
          length_ft: it.is_lumpsum ? null : (Number(it.length_ft) || null),
          width_ft: it.is_lumpsum ? null : (Number(it.width_ft) || null),
          area_sqft: Number(it.area_sqft) || 0,
          unit: it.unit || 'sqft',
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || 0,
          sort_order: idx,
        }));

        if (itemRows.length > 0) {
          await supabaseAdmin.from('quotation_items').insert(itemRows);
        }

        // Update lead with final amount and status
        await supabaseAdmin
          .from('quotation_leads')
          .update({
            approved_value: numFinalAmount,
            quote_value: numFinalAmount,
            latest_quotation_id: newQuote.id,
            quote_version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead_id);
      }
    }

    // 2. Update project budget to the final bill amount
    if (update_project_budget && numFinalAmount > 0) {
      const { error: projUpdateErr } = await supabaseAdmin
        .from('projects')
        .update({
          project_budget: numFinalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (projUpdateErr) {
        console.error('Error updating project budget with final bill:', projUpdateErr);
      }
    }

    return NextResponse.json({
      success: true,
      quotation_id: savedQuotationId,
      final_amount: numFinalAmount,
      message: 'Final bill saved and project budget successfully updated',
    });
  } catch (err: any) {
    console.error('Error saving final bill:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
