import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('holidays')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching holidays:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { user, role, error: authError } = await getAuthUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('holidays')
            .insert(rows);

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'One or more dates already have a holiday entry.' }, { status: 409 });
            }
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error adding holidays:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { user, role, error: authError } = await getAuthUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('holidays')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting holiday:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
