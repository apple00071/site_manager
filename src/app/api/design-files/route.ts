import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

// Validation schemas
const createDesignFileSchema = z.object({
  project_id: z.string().uuid(),
  file_name: z.string().min(1),
  file_url: z.string().min(1),
  file_type: z.string().min(1),
  version_number: z.number().int().positive().optional().default(1),
});

const updateApprovalSchema = z.object({
  id: z.string().uuid(),
  approval_status: z.enum(['pending', 'approved', 'rejected', 'needs_changes']),
  admin_comments: z.string().optional(),
});

const addCommentSchema = z.object({
  design_file_id: z.string().uuid(),
  comment: z.string().min(1),
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

// GET - Fetch design files
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

    // Fetch design files with user information and comments
    const { data: designs, error } = await supabaseAdmin
      .from('design_files')
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email),
        comments:design_comments(
          id,
          comment,
          created_at,
          user:users(id, full_name, email)
        )
      `)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching design files:', error);
      return NextResponse.json({ error: 'Failed to fetch design files' }, { status: 500 });
    }

    return NextResponse.json({ designs });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new design file
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createDesignFileSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { project_id, file_name, file_url, file_type, version_number } = parsed.data;

    const { data: design, error } = await supabaseAdmin
      .from('design_files')
      .insert({
        project_id,
        file_name,
        file_url,
        file_type,
        version_number,
        uploaded_by: user.id,
        approval_status: 'pending',
      })
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating design file:', error);
      return NextResponse.json({ error: 'Failed to create design file' }, { status: 500 });
    }

    return NextResponse.json({ design }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update design approval status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getCurrentUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can approve designs' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateApprovalSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, approval_status, admin_comments } = parsed.data;

    // If approving, unset any previously approved design for this project
    if (approval_status === 'approved') {
      // Get the project_id for this design
      const { data: currentDesign } = await supabaseAdmin
        .from('design_files')
        .select('project_id')
        .eq('id', id)
        .single();

      if (currentDesign) {
        // Unset is_current_approved for all other designs in this project
        await supabaseAdmin
          .from('design_files')
          .update({ is_current_approved: false })
          .eq('project_id', currentDesign.project_id);
      }
    }

    const { data: design, error } = await supabaseAdmin
      .from('design_files')
      .update({
        approval_status,
        admin_comments,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        is_current_approved: approval_status === 'approved',
      })
      .eq('id', id)
      .select(`
        *,
        uploaded_by_user:users!design_files_uploaded_by_fkey(id, full_name, email),
        approved_by_user:users!design_files_approved_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating design approval:', error);
      return NextResponse.json({ error: 'Failed to update design approval' }, { status: 500 });
    }

    return NextResponse.json({ design });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete design file
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
      .from('design_files')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting design file:', error);
      return NextResponse.json({ error: 'Failed to delete design file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

