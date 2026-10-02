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

    return NextResponse.json({
      notes: notes || [],
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
