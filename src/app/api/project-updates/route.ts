import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

// Validation schemas
const createUpdateSchema = z.object({
  project_id: z.string().uuid(),
  update_date: z.string(), // ISO date string
  description: z.string().min(1),
  photos: z.array(z.string()).optional().default([]),
});

const updateUpdateSchema = z.object({
  id: z.string().uuid(),
  update_date: z.string().optional(),
  description: z.string().min(1).optional(),
  photos: z.array(z.string()).optional(),
});

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
      return { user: null, error: error?.message || 'No session found' };
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return { user: null, error: userError?.message || 'User not found' };
    }

    console.log('User authenticated:', user.email);
    return { user, error: null };
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return { user: null, error: error.message };
  }
}

// GET - Fetch project updates
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch updates with user information
    const { data: updates, error } = await supabaseAdmin
      .from('project_updates')
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .eq('project_id', project_id)
      .order('update_date', { ascending: false });

    if (error) {
      console.error('Error fetching project updates:', error);
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new project update
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, update_date, description, photos } = parsed.data;

    const { data: update, error } = await supabaseAdmin
      .from('project_updates')
      .insert({
        project_id,
        user_id: user.id,
        update_date,
        description,
        photos,
      })
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating project update:', error);
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update existing project update
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    const { data: update, error } = await supabaseAdmin
      .from('project_updates')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        user:users!project_updates_user_id_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating project update:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ update });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete project update
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('project_updates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project update:', error);
      return NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

