import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const extension = (file as any).name?.split('.').pop() || 'webm';
    const fileName = `${user.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('project-update-voices')
      .upload(fileName, file, {
        contentType: (file as any).type || 'audio/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading voice note via API:', uploadError);
      return NextResponse.json({ error: 'Failed to upload voice note' }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage
      .from('project-update-voices')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: data.publicUrl }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in upload-voice API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
