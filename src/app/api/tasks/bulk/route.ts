import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';

// Optimize for bulk operations
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PATCH - Bulk update multiple tasks
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates array is required' }, { status: 400 });
    }

    console.log(`🔄 Bulk updating ${updates.length} tasks for user:`, user.email);

    const results: Array<{ success: true; id: string; task: any }> = [];
    const errors: Array<{ success: false; id: string; error: string }> = [];

    // Process updates in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (update: any) => {
        try {
          const { id, data } = update;
          
          if (!id || !data) {
            throw new Error('Each update must have id and data properties');
          }

          // Update the task
          const { data: updatedTask, error } = await supabase
            .from('tasks')
            .update({
              ...data,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

          if (error) {
            throw error;
          }

          return { success: true as const, id, task: updatedTask };
        } catch (error: any) {
          return { success: false as const, id: update.id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
    }

    console.log(`✅ Bulk update completed: ${results.length} successful, ${errors.length} failed`);

    return NextResponse.json({
      success: true,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in bulk task update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Bulk create multiple tasks
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Tasks array is required' }, { status: 400 });
    }

    console.log(`📝 Bulk creating ${tasks.length} tasks for user:`, user.email);

    // Prepare tasks for insertion
    const tasksToInsert = tasks.map((task: any) => ({
      ...task,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert all tasks at once
    const { data: createdTasks, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    if (error) {
      console.error('Error bulk creating tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Bulk created ${createdTasks?.length || 0} tasks`);

    return NextResponse.json({
      success: true,
      created: createdTasks?.length || 0,
      tasks: createdTasks
    });

  } catch (error) {
    console.error('Error in bulk task creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Bulk delete multiple tasks
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const body = await request.json();
    const { taskIds } = body;

    if (!taskIds || !Array.isArray(taskIds)) {
      return NextResponse.json({ error: 'Task IDs array is required' }, { status: 400 });
    }

    console.log(`🗑️ Bulk deleting ${taskIds.length} tasks for user:`, user.email);

    // Delete all tasks at once
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', taskIds);

    if (error) {
      console.error('Error bulk deleting tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Bulk deleted ${taskIds.length} tasks`);

    return NextResponse.json({
      success: true,
      deleted: taskIds.length
    });

  } catch (error) {
    console.error('Error in bulk task deletion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
