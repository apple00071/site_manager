import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { checkPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper to find matched CRM quotation for a project
 */
async function findProjectQuotation(projectId: string) {
  // 1. Fetch project details
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, title, customer_name, project_notes')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return null;

  let matchedLead: any = null;

  // Check if project_notes references a quotation ref number e.g. "Ref #123"
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

  // If not found by ref, match by customer_name or site_project
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

  if (!matchedLead) return null;

  // Fetch latest quotation and items
  const { data: quotes } = await supabaseAdmin
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('lead_id', matchedLead.id)
    .order('version', { ascending: false })
    .limit(1);

  if (!quotes || quotes.length === 0) return null;

  const quote = quotes[0];
  const items = (quote.quotation_items || []).sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return {
    lead: matchedLead,
    quotation: {
      id: quote.id,
      version: quote.version,
      final_amount: quote.final_amount,
      material_specs: quote.material_specs,
      items,
    },
  };
}

/**
 * GET /api/projects/[id]/requirements
 * Returns the project's requirement items (and matched CRM quotation info)
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

    // 1. Fetch requirements items from database
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('project_requirements')
      .select(`
        *,
        creator:created_by(id, full_name, email),
        verifier:verified_by(id, full_name, email)
      `)
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    // 2. Fetch matched CRM quotation info
    const crmData = await findProjectQuotation(projectId);

    // Normalize items if legacy columns exist
    const normalizedItems = (items || []).map((it: any) => ({
      id: it.id,
      project_id: it.project_id,
      room_section: it.room_section || it.category || 'General',
      item_name: it.item_name || it.title || 'Untitled Item',
      dimensions: it.dimensions || null,
      designer_specs: it.designer_specs || it.description || '',
      status: it.status || (it.is_completed ? 'verified' : 'pending'),
      supervisor_notes: it.supervisor_notes || '',
      verified_at: it.verified_at || it.completed_at || null,
      verified_by: it.verified_by || it.completed_by || null,
      verifier: it.verifier || it.completer || null,
      creator: it.creator || null,
      quotation_item_id: it.quotation_item_id || null,
      order_index: it.order_index ?? 0,
      created_at: it.created_at,
      updated_at: it.updated_at,
    }));

    // 3. Fetch notes
    const { data: notes } = await supabaseAdmin
      .from('project_requirement_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    return NextResponse.json({
      items: normalizedItems,
      notes: notes || [],
      tableMissing: itemsError?.code === '42P01',
      crmQuotation: crmData
        ? {
            lead_id: crmData.lead.id,
            ref_no: crmData.lead.ref_no,
            client_name: crmData.lead.client_name,
            site_project: crmData.lead.site_project,
            quotation_id: crmData.quotation.id,
            version: crmData.quotation.version,
            final_amount: crmData.quotation.final_amount,
            total_items: crmData.quotation.items.length,
            material_specs: crmData.quotation.material_specs,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error fetching project requirements:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/requirements
 * Handles:
 * 1. 'sync_crm': Pulls items from CRM quotation and saves to project_requirements
 * 2. 'add_item': Adds a custom requirement item
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
    const action = body.action || (body.type === 'sync_crm' ? 'sync_crm' : 'add_item');

    // 1. SYNC FROM CRM QUOTATION
    if (action === 'sync_crm') {
      const crmData = await findProjectQuotation(projectId);
      if (!crmData || !crmData.quotation || crmData.quotation.items.length === 0) {
        return NextResponse.json(
          { error: 'No CRM quotation found matching this project customer or title.' },
          { status: 404 }
        );
      }

      // Check existing requirement items to avoid duplicating
      const { data: existingItems } = await supabaseAdmin
        .from('project_requirements')
        .select('id, quotation_item_id, item_name, room_section')
        .eq('project_id', projectId);

      const existingItemIds = new Set((existingItems || []).map((e: any) => e.quotation_item_id).filter(Boolean));
      const existingNames = new Set(
        (existingItems || []).map((e: any) => `${(e.room_section || '').toLowerCase()}::${(e.item_name || '').toLowerCase()}`)
      );

      const newRowsToInsert: any[] = [];
      const crmItems = crmData.quotation.items;

      crmItems.forEach((qItem: any, idx: number) => {
        const itemKey = `${(qItem.section || 'General').toLowerCase()}::${(qItem.item_name || '').toLowerCase()}`;
        if (!existingItemIds.has(qItem.id) && !existingNames.has(itemKey)) {
          // Format dimensions cleanly: e.g. "8.0ft × 7.0ft • 56 sqft" or "Lump sum"
          let dimString = '';
          if (qItem.is_lumpsum) {
            dimString = 'Lump sum';
          } else if (qItem.length_ft && qItem.width_ft) {
            dimString = `${qItem.length_ft}ft × ${qItem.width_ft}ft`;
            if (qItem.area_sqft) dimString += ` • ${qItem.area_sqft} ${qItem.unit || 'sqft'}`;
          } else if (qItem.area_sqft) {
            dimString = `${qItem.area_sqft} ${qItem.unit || 'sqft'}`;
          }

          const itemName = (qItem.item_name || 'Quoted Item').trim();
          const roomSec = (qItem.section || 'General').trim();

          newRowsToInsert.push({
            project_id: projectId,
            quotation_item_id: qItem.id,
            title: itemName,
            item_name: itemName,
            category: roomSec,
            room_section: roomSec,
            dimensions: dimString || null,
            description: '',
            designer_specs: '',
            status: 'pending',
            order_index: (existingItems?.length || 0) + idx,
            created_by: user.id,
          });
        }
      });

      if (newRowsToInsert.length === 0) {
        return NextResponse.json({
          message: 'All items from CRM quotation are already present in requirements.',
          syncedCount: 0,
        });
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('project_requirements')
        .insert(newRowsToInsert)
        .select(`*, creator:created_by(id, full_name, email)`);

      if (insertError) {
        console.error('Error inserting CRM quotation items:', insertError);
        return NextResponse.json({ error: 'Failed to import quotation items', details: insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        message: `Successfully imported ${inserted?.length || 0} items from CRM quotation.`,
        syncedCount: inserted?.length || 0,
        items: inserted,
      });
    }

    // 2. ADD CUSTOM ITEM
    const { room_section, item_name, dimensions, designer_specs } = body;
    if (!item_name || !item_name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    const { data: lastItem } = await supabaseAdmin
      .from('project_requirements')
      .select('order_index')
      .eq('project_id', projectId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastItem?.order_index ?? -1) + 1;
    const customItemName = item_name.trim();
    const customRoom = (room_section || 'General').trim();
    const customSpecs = designer_specs ? designer_specs.trim() : '';

    const { data: newItem, error: itemError } = await supabaseAdmin
      .from('project_requirements')
      .insert({
        project_id: projectId,
        title: customItemName,
        item_name: customItemName,
        category: customRoom,
        room_section: customRoom,
        dimensions: dimensions ? dimensions.trim() : null,
        description: customSpecs,
        designer_specs: customSpecs,
        status: 'pending',
        order_index: nextOrder,
        created_by: user.id,
      })
      .select(`*, creator:created_by(id, full_name, email)`)
      .single();

    if (itemError) {
      return NextResponse.json({ error: 'Failed to create item', details: itemError.message }, { status: 500 });
    }

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error('Error in requirements POST:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/requirements
 * Updates designer specs, supervisor site verification, OR notes
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

    // NOTE UPDATE
    if (body.type === 'note') {
      const { noteId, content, title } = body;
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
    }

    // BATCH UPDATE (e.g., auto-filling specs for multiple items)
    if (Array.isArray(body.items)) {
      const updatesPromises = body.items.map(async (it: any) => {
        if (!it.id) return null;
        const itUpdates: any = { updated_at: new Date().toISOString() };
        if (it.designer_specs !== undefined) {
          itUpdates.designer_specs = it.designer_specs;
          itUpdates.description = it.designer_specs;
        }
        if (it.status !== undefined) itUpdates.status = it.status;
        return supabaseAdmin
          .from('project_requirements')
          .update(itUpdates)
          .eq('id', it.id);
      });
      await Promise.all(updatesPromises);
      return NextResponse.json({ success: true, count: body.items.length });
    }

    const { itemId, room_section, item_name, dimensions, designer_specs, status, supervisor_notes } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (room_section !== undefined) {
      updates.room_section = room_section.trim();
      updates.category = room_section.trim();
    }
    if (item_name !== undefined) {
      updates.item_name = item_name.trim();
      updates.title = item_name.trim();
    }
    if (dimensions !== undefined) updates.dimensions = dimensions ? dimensions.trim() : null;
    if (designer_specs !== undefined) {
      updates.designer_specs = designer_specs;
      updates.description = designer_specs;
    }
    if (supervisor_notes !== undefined) updates.supervisor_notes = supervisor_notes;

    if (status !== undefined) {
      updates.status = status; // 'pending' | 'verified' | 'issue'
      if (status === 'verified') {
        updates.verified_at = new Date().toISOString();
        updates.verified_by = user.id;
      } else {
        updates.verified_at = null;
        updates.verified_by = null;
      }
    }

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('project_requirements')
      .update(updates)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select(`
        *,
        creator:created_by(id, full_name, email),
        verifier:verified_by(id, full_name, email)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update requirement item', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ item: updatedItem });
  } catch (err: any) {
    console.error('Error in requirements PATCH:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/requirements
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;
    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const { error: delError } = await supabaseAdmin
      .from('project_requirements')
      .delete()
      .eq('id', itemId)
      .eq('project_id', projectId);

    if (delError) {
      return NextResponse.json({ error: 'Failed to delete item', details: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: itemId });
  } catch (err: any) {
    console.error('Error in requirements DELETE:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}
