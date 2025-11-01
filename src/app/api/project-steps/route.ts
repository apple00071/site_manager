import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper function to get current user from session
async function getCurrentUser(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('Session error:', error);
      return null;
    }

    // Get user details from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// GET - Fetch project steps
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
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
      .order('stage')
      .order('sort_order');

    if (error) {
      console.error('Error fetching project steps:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(steps);
  } catch (error: any) {
    console.error('Error in GET /api/project-steps:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new project step
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, title, stage, sort_order } = body;

    if (!project_id || !title || !stage) {
      return NextResponse.json(
        { error: 'project_id, title, and stage are required' },
        { status: 400 }
      );
    }

    // Get the next sort_order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxData } = await supabaseAdmin
        .from('project_steps')
        .select('sort_order')
        .eq('project_id', project_id)
        .eq('stage', stage)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      finalSortOrder = (maxData?.[0]?.sort_order ?? -1) + 1;
    }

    // Insert the new step
    const { data: step, error } = await supabaseAdmin
      .from('project_steps')
      .insert({
        project_id,
        title,
        stage,
        sort_order: finalSortOrder,
        status: 'todo',
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
    const user = await getCurrentUser(request);
    if (!user) {
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
    const user = await getCurrentUser(request);
    if (!user) {
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

