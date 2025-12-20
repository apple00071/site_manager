import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { startOfDay, endOfDay, format } from 'date-fns';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('project_id');
        const dateParam = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const dayStart = startOfDay(new Date(dateParam)).toISOString();
        const dayEnd = endOfDay(new Date(dateParam)).toISOString();

        // 1. Fetch Today's Tasks
        const { data: tasks } = await supabaseAdmin
            .from('project_step_tasks')
            .select('id, title, status, updated_at')
            .filter('updated_at', 'gte', dayStart)
            .filter('updated_at', 'lte', dayEnd)
            .eq('status', 'done');

        // 2. Fetch Today's BOQ Updates (Scope)
        const { data: boqItems } = await supabaseAdmin
            .from('boq_items')
            .select('id, item_name, category, status, updated_at')
            .filter('updated_at', 'gte', dayStart)
            .filter('updated_at', 'lte', dayEnd)
            .eq('status', 'completed');

        // 3. Fetch Today's Materials (Inventory)
        const { data: inventory } = await supabaseAdmin
            .from('inventory_items')
            .select('id, item_name, quantity, total_cost, created_at')
            .filter('created_at', 'gte', dayStart)
            .filter('created_at', 'lte', dayEnd);

        // 4. Fetch Recent Site Logs (for initial description)
        const { data: logs } = await supabaseAdmin
            .from('site_logs')
            .select('*')
            .eq('project_id', projectId)
            .eq('log_date', dateParam);

        return NextResponse.json({
            date: dateParam,
            tasks: tasks || [],
            boq: boqItems || [],
            inventory: inventory || [],
            site_logs: logs || []
        });

    } catch (error: any) {
        console.error('Aggregation Error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
