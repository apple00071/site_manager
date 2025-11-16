import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationService';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache project steps
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch project steps
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch project steps
    const { data: steps, error } = await supabaseAdmin
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching project steps:', error);
      return NextResponse.json({ error: 'Failed to fetch project steps' }, { status: 500 });
    }

    return NextResponse.json({ steps: steps || [] });
  } catch (error) {
    console.error('Error in project steps API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new project step
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, title, start_date, end_date, description } = body;

    if (!project_id || !title) {
      return NextResponse.json(
        { error: 'project_id and title are required' },
        { status: 400 }
      );
    }

    // Insert the new step using only known-safe columns
    const { data: step, error } = await supabaseAdmin
      .from('project_steps')
      .insert({
        project_id,
        title,
        description: description || null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating project step:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(step);
  } catch (error: any) {
    console.error('Error in POST /api/project-steps:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update a project step
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Update the step
    const { data: step, error } = await supabaseAdmin
      .from('project_steps')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating project step:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(step);
  } catch (error: any) {
    console.error('Error in PATCH /api/project-steps:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a project step
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Delete the step
    const { error } = await supabaseAdmin
      .from('project_steps')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project step:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/project-steps:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

