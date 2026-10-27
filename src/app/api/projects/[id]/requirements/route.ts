import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { checkPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/requirements
 * Returns the project's requirement notes
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check permissions
    const permView = await checkPermission(user, 'requirements.view', projectId);
    const permProjView = await checkPermission(user, 'projects.view', projectId);
    if (!permView.allowed && !permProjView.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Fetch requirement notes
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('project_requirement_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching requirement notes:', notesError);
      return NextResponse.json({ error: notesError.message }, { status: 500 });
    }

    // Fetch project details for CRM matching and PDF generation
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select(`
        id, 
        title, 
        customer_name, 
        phone_number, 
        address, 
        project_notes, 
        requirements_pdf_url,
        site_supervisor:site_supervisor_id(id, full_name, phone_number)
      `)
      .eq('id', projectId)
      .single();

    let matchedLead: any = null;

    if (project) {
      // 1. Try matching by explicit query parameter or project_notes ref e.g. "Ref #188" or "AI/QTN/2026/188"
      const forcedLeadId = request.nextUrl.searchParams.get('lead_id');
      if (forcedLeadId) {
        const { data: leadById } = await supabaseAdmin
          .from('quotation_leads')
          .select('id, ref_no, client_name, site_project, phone, status')
          .eq('id', forcedLeadId)
          .maybeSingle();
        if (leadById) matchedLead = leadById;
      }

      if (!matchedLead) {
        const refMatch = project.project_notes?.match(/Ref\s*#?([0-9]+)/i) || 
                         project.project_notes?.match(/AI\/QTN\/\d+\/(\d+)/i);
        if (refMatch && refMatch[1]) {
          const refNum = parseInt(refMatch[1], 10);
          if (!isNaN(refNum)) {
            const { data: leadByRef } = await supabaseAdmin
              .from('quotation_leads')
              .select('id, ref_no, client_name, site_project, phone, status')
              .or(`ref_no.eq.${refNum},ref_no.ilike.%${refNum}%`)
              .maybeSingle();
            if (leadByRef) matchedLead = leadByRef;
          }
        }
      }

      // 2. Match by customer phone if available
      if (!matchedLead && project.phone_number) {
        const cleanPhone = project.phone_number.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length >= 8) {
          const { data: leadByPhone } = await supabaseAdmin
            .from('quotation_leads')
            .select('id, ref_no, client_name, site_project, phone, status')
            .ilike('phone', `%${cleanPhone}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (leadByPhone) matchedLead = leadByPhone;
        }
      }

      // 3. Match by customer name or site project name
      if (!matchedLead) {
        const cName = (project.customer_name || '').trim().toLowerCase();
        const pTitle = (project.title || '').trim().toLowerCase();

        const { data: candidateLeads } = await supabaseAdmin
          .from('quotation_leads')
          .select('id, ref_no, client_name, site_project, phone, status')
          .order('created_at', { ascending: false });

        if (candidateLeads && candidateLeads.length > 0) {
          matchedLead = candidateLeads.find((l: any) => {
            const lClient = (l.client_name || '').toLowerCase().trim();
            const lSite = (l.site_project || '').toLowerCase().trim();
            const titlePrefix = (pTitle.split('_')[0] || pTitle.split('-')[0] || '').trim();

            return (
              (lClient && (
                (cName && (lClient === cName || cName.includes(lClient) || lClient.includes(cName))) ||
                (pTitle && (pTitle.includes(lClient) || lClient.includes(pTitle))) ||
                (titlePrefix && (titlePrefix === lClient || titlePrefix.includes(lClient) || lClient.includes(titlePrefix)))
              )) ||
              (lSite && (
                (pTitle && (lSite === pTitle || pTitle.includes(lSite) || lSite.includes(pTitle))) ||
                (cName && (lSite === cName || cName.includes(lSite) || lSite.includes(cName)))
              ))
            );
          });
        }
      }
    }

    // 4. Fetch Approved Quotation & Scope Items (ONLY approved quotation data, strictly without prices)
    let crmQuotation: any = null;

    if (matchedLead && String(matchedLead.status || '').toLowerCase() === 'approved') {
      const { data: quotes } = await supabaseAdmin
        .from('quotations')
        .select(`
          id,
          lead_id,
          version,
          subtotal,
          final_amount,
          notes,
          material_specs,
          created_at,
          quotation_items (
            id,
            section,
            item_name,
            is_lumpsum,
            length_ft,
            width_ft,
            area_sqft,
            unit,
            sort_order
          )
        `)
        .eq('lead_id', matchedLead.id)
        .order('version', { ascending: false });

      if (quotes && quotes.length > 0) {
        const targetApprovedVal = Number(matchedLead.approved_value) || Number(matchedLead.quote_value) || 0;

        // 1. Try matching the exact quotation whose amount matches the approved value and has items
        let approvedQuote = quotes.find((q: any) => {
          const itemsCount = q.quotation_items?.length || 0;
          return itemsCount > 0 && Math.abs(Number(q.final_amount) - targetApprovedVal) < 2;
        });

        // 2. Otherwise pick the highest version that actually has items and amount > 0
        if (!approvedQuote) {
          approvedQuote = quotes.find((q: any) => {
            const itemsCount = q.quotation_items?.length || 0;
            return itemsCount > 0 && Number(q.final_amount) > 0;
          });
        }

        // 3. Fallback to any quotation that has items
        if (!approvedQuote) {
          approvedQuote = quotes.find((q: any) => (q.quotation_items?.length || 0) > 0) || quotes[0];
        }

        if (approvedQuote) {
          const rawItems = approvedQuote.quotation_items || [];
          const sortedItems = [...rawItems].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          crmQuotation = {
            id: approvedQuote.id,
            lead_id: approvedQuote.lead_id,
            notes: approvedQuote.notes || '',
            material_specs: approvedQuote.material_specs || null,
            created_at: approvedQuote.created_at,
            lead: {
              id: matchedLead.id,
              ref_no: matchedLead.ref_no,
              client_name: matchedLead.client_name,
              site_project: matchedLead.site_project,
              phone: matchedLead.phone,
              status: matchedLead.status
            },
            items: sortedItems
          };
        }
      }
    }

    // 5. Fetch available leads for quick manual linking if needed (only Approved leads)
    const { data: allCandidateLeads } = await supabaseAdmin
      .from('quotation_leads')
      .select('id, ref_no, client_name, site_project, status')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
      .limit(60);

    return NextResponse.json({
      notes: notes || [],
      crmQuotation,
      requirementsPdfUrl: project?.requirements_pdf_url || null,
      availableLeads: allCandidateLeads || [],
      projectInfo: project ? {
        title: project.title,
        customer_name: project.customer_name,
        phone_number: project.phone_number,
        address: project.address,
        site_engineer_name: (project as any).site_supervisor?.full_name || 'Not Assigned',
        site_engineer_phone: (project as any).site_supervisor?.phone_number || '',
      } : null,
    });
  } catch (err: any) {
    console.error('Error in requirements GET:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/requirements
 * Updates requirement notes
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const permEdit = await checkPermission(user, 'requirements.edit', projectId);
    const permProjEdit = await checkPermission(user, 'projects.edit', projectId);
    if (!permEdit.allowed && !permProjEdit.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();

    // Support manually linking a CRM quotation lead to the project
    if (body.link_lead_id) {
      const { data: leadToLink } = await supabaseAdmin
        .from('quotation_leads')
        .select('ref_no')
        .eq('id', body.link_lead_id)
        .single();

      if (leadToLink?.ref_no) {
        const { data: curProj } = await supabaseAdmin
          .from('projects')
          .select('project_notes')
          .eq('id', projectId)
          .single();
        const existingNotes = curProj?.project_notes || '';
        const cleanNotes = existingNotes.replace(/Ref\s*#?[0-9]+/gi, '').replace(/\s*•\s*$/, '').trim();
        const updatedNotes = cleanNotes ? `${cleanNotes} • Ref #${leadToLink.ref_no}` : `Ref #${leadToLink.ref_no}`;
        await supabaseAdmin
          .from('projects')
          .update({ project_notes: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return NextResponse.json({ success: true, linkedRef: leadToLink.ref_no });
      }
    }

    const { content, title } = body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim() || 'Site Notes';
    if (content !== undefined) updates.content = content;

    const { data: existingNote } = await supabaseAdmin
      .from('project_requirement_notes')
      .select('id')
      .eq('project_id', projectId)
      .limit(1)
      .maybeSingle();

    if (existingNote) {
      const { data: note, error: noteError } = await supabaseAdmin
        .from('project_requirement_notes')
        .update(updates)
        .eq('id', existingNote.id)
        .select()
        .single();
      if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
      return NextResponse.json({ note });
    } else {
      const { data: note, error: noteError } = await supabaseAdmin
        .from('project_requirement_notes')
        .insert({
          project_id: projectId,
          title: updates.title || 'Site Notes',
          content: updates.content || '',
          created_by: user.id,
        })
        .select()
        .single();
      if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
      return NextResponse.json({ note });
    }
  } catch (err: any) {
    console.error('Error in requirements PATCH:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}
