import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    const projectId = request.nextUrl.searchParams.get('project_id');
    const { data } = await supabaseAdmin.from('report_subscribers').select('*').eq('project_id', projectId);
    return NextResponse.json({ subscribers: data || [] });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { data, error } = await supabaseAdmin.from('report_subscribers').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriber: data });
}

export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    await supabaseAdmin.from('report_subscribers').delete().eq('id', id);
    return NextResponse.json({ success: true });
}
