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
    const bucket = formData.get('bucket');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!bucket || typeof bucket !== 'string') {
      return NextResponse.json({ error: 'No bucket provided' }, { status: 400 });
    }

    // Validate that the bucket is one of our allowed buckets
    const allowedBuckets = ['project-update-photos', 'inventory-bills', 'design-files', 'project-update-voices'];
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    }

    const originalName = (file as any).name || 'file.bin';
    const extension = originalName.split('.').pop() || 'bin';
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error(`Error uploading to ${bucket} via API:`, uploadError);
      return NextResponse.json({ error: uploadError.message || 'Failed to upload file' }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return NextResponse.json({ url: data.publicUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in upload API:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
