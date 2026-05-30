import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache notepad notes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - Fetch all notes for the logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: notes, error } = await supabaseAdmin
      .from('notepad_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching notepad notes:', error);
      
      // Handle the case where the table doesn't exist yet
      if (error.code === '42P01') {
        return NextResponse.json({
          error: 'database_table_missing',
          message: 'The notepad_notes database table does not exist yet. Please run the SQL migration script in your Supabase SQL Editor.'
        }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    // If user has zero notes, automatically insert a default note and return it
    if (notes.length === 0) {
      const defaultNote = {
        user_id: user.id,
        title: 'Quick Scratchpad',
        content: 'Welcome to your cloud-synced Notepad!\n\nUse this space to note site details, material measurements, customer requests, or quick reminders without navigating away. Your changes will sync automatically across all your devices!',
      };

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('notepad_notes')
        .insert(defaultNote)
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating default note:', insertError);
        return NextResponse.json({ error: 'Failed to initialize default note' }, { status: 500 });
      }

      return NextResponse.json({ notes: [inserted] });
    }

    return NextResponse.json({ notes });
  } catch (err) {
    console.error('Unexpected error in GET /api/notepad:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new note
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title = 'New Note', content = '' } = body;

    const { data: note, error } = await supabaseAdmin
      .from('notepad_notes')
      .insert({
        user_id: user.id,
        title,
        content
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/notepad:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update an existing note (title and/or content)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;

    const { data: note, error } = await supabaseAdmin
      .from('notepad_notes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure security boundary
      .select('*')
      .single();

    if (error) {
      console.error('Error updating note:', error);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (err) {
    console.error('Unexpected error in PATCH /api/notepad:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove a note
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('notepad_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure security boundary

    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in DELETE /api/notepad:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
