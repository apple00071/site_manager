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

    const body = await request.json().catch(() => ({}));
    const { bucket, folder, filename } = body;

    if (!bucket || typeof bucket !== 'string') {
      return NextResponse.json({ error: 'Bucket is required' }, { status: 400 });
    }

    const allowedBuckets = [
      'design-files',
      'project-update-photos',
      'inventory-bills',
      'project-update-voices',
      'worker-documents',
      'employee-documents',
      'project-requirements',
      'project-documents',
    ];

    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: `Bucket '${bucket}' not allowed` }, { status: 403 });
    }

    const originalName = typeof filename === 'string' && filename ? filename : 'file.bin';
    const extension = originalName.split('.').pop() || 'bin';
    const safeFolder = folder ? String(folder).replace(/^\/+|\/+$/g, '') : user.id;
    const filePath = `${safeFolder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;

    // Generate signed upload URL from Supabase Admin (bypasses RLS and serverless body size limits)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (signError || !signedData?.signedUrl) {
      console.error('Error generating signed upload URL:', signError);
      return NextResponse.json(
        { error: signError?.message || 'Failed to create signed upload URL' },
        { status: 500 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      path: filePath,
      publicUrl: publicData.publicUrl,
    });
  } catch (error: any) {
    console.error('Unexpected error in signed upload API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
