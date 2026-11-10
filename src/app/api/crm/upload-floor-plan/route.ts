import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export interface AttachmentItem {
  url: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permManage = await verifyPermission(user.id, 'crm.manage');
    const permCreateLead = await verifyPermission(user.id, 'leads.create');
    if (!permManage.allowed && !permCreateLead.allowed) {
      return NextResponse.json({ error: 'Permission denied: crm.manage or leads.create required' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    let leadId: string | null = null;
    let uploadedList: AttachmentItem[] = [];

    // Support JSON payload with pre-uploaded files (bypasses Vercel payload limits)
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      leadId = body.lead_id || null;
      const rawFiles = body.files || body.new_files || (body.url ? [{ url: body.url, name: body.name || 'document' }] : []);
      if (Array.isArray(rawFiles)) {
        uploadedList = rawFiles
          .filter((f: any) => f && f.url)
          .map((f: any) => ({
            url: String(f.url),
            name: String(f.name || 'document'),
          }));
      }
    } else {
      // Support multipart/form-data
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;
      const allFiles: File[] = files.length > 0 ? files : (singleFile ? [singleFile] : []);
      leadId = formData.get('lead_id') as string | null;

      for (const file of allFiles) {
        if (!file || typeof file === 'string') continue;
        const originalName = file.name || 'document.pdf';
        const extension = originalName.split('.').pop() || 'bin';
        const safeBaseName = originalName
          .replace(/\.[^/.]+$/, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 50);

        const uniqueId = Math.random().toString(36).substring(2, 8);
        const fileName = `crm-floor-plans/${leadId ? leadId : user.id}_${Date.now()}_${uniqueId}_${safeBaseName}.${extension}`;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const { error: uploadErr } = await supabaseAdmin.storage
          .from('design-files')
          .upload(fileName, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });

        if (uploadErr) {
          console.error('Storage Upload Error for file:', originalName, uploadErr);
          throw new Error(`Storage upload failed for "${originalName}": ${uploadErr.message}`);
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('design-files')
          .getPublicUrl(fileName);

        uploadedList.push({
          url: publicUrl,
          name: originalName,
        });
      }
    }

    if (uploadedList.length === 0) {
      return NextResponse.json({ error: 'No files provided or uploaded' }, { status: 400 });
    }

    let combinedAttachments: AttachmentItem[] = [...uploadedList];

    // If leadId is provided, merge with existing attachments and update lead
    if (leadId) {
      const { data: leadData, error: fetchErr } = await supabaseAdmin
        .from('quotation_leads')
        .select('id, remarks, floor_plan_url, floor_plan_name, attachments')
        .eq('id', leadId)
        .single();

      if (fetchErr || !leadData) {
        return NextResponse.json({ error: `Lead not found: ${fetchErr?.message || leadId}` }, { status: 404 });
      }

      const currentRemarks = leadData.remarks || '';
      let existingAttachments: AttachmentItem[] = [];

      // 1. Direct attachments JSONB column
      if (Array.isArray(leadData.attachments) && leadData.attachments.length > 0) {
        existingAttachments = leadData.attachments;
      } else {
        // 2. Check for [Files: [...]]
        const filesMatch = currentRemarks.match(/\[Files:\s*(\[.*?\])\]/);
        if (filesMatch) {
          try {
            existingAttachments = JSON.parse(filesMatch[1]);
          } catch (_) {}
        } else if (leadData.floor_plan_url) {
          existingAttachments = [{
            url: leadData.floor_plan_url,
            name: leadData.floor_plan_name || 'Floor Plan'
          }];
        }
      }

      // Merge new files avoiding duplicate URLs
      const existingUrls = new Set(existingAttachments.map(a => a.url));
      const freshUploads = uploadedList.filter(u => !existingUrls.has(u.url));
      combinedAttachments = [...existingAttachments, ...freshUploads];

      // Clean old tags from remarks
      const cleanedRemarks = currentRemarks
        .replace(/\[Files:\s*\[.*?\]\]\s*/g, '')
        .replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '')
        .trim();

      const filesTag = `[Files: ${JSON.stringify(combinedAttachments)}]`;
      const newRemarks = `${cleanedRemarks ? cleanedRemarks + ' ' : ''}${filesTag}`.trim();

      // Update lead
      const updatePayload: any = {
        floor_plan_url: combinedAttachments[0]?.url || null,
        floor_plan_name: combinedAttachments[0]?.name || null,
        attachments: combinedAttachments,
        remarks: newRemarks,
        updated_at: new Date().toISOString(),
      };

      const { error: uploadUpdateError } = await supabaseAdmin
        .from('quotation_leads')
        .update(updatePayload)
        .eq('id', leadId);

      if (uploadUpdateError) {
        if (uploadUpdateError.code === '42703') {
          delete updatePayload.attachments;
          const { error: retryErr } = await supabaseAdmin
            .from('quotation_leads')
            .update(updatePayload)
            .eq('id', leadId);
          if (retryErr) {
            throw new Error(`Database update failed: ${retryErr.message}`);
          }
        } else {
          throw new Error(`Database update failed: ${uploadUpdateError.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadedList,
      attachments: combinedAttachments,
      url: combinedAttachments[0]?.url || uploadedList[0]?.url,
      name: combinedAttachments[0]?.name || uploadedList[0]?.name,
    });
  } catch (error: any) {
    console.error('Unexpected error uploading files:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perm = await verifyPermission(user.id, 'crm.manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied: crm.manage required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    const fileUrl = searchParams.get('file_url');

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const { data: leadData, error: fetchErr } = await supabaseAdmin
      .from('quotation_leads')
      .select('id, remarks, floor_plan_url, floor_plan_name, attachments')
      .eq('id', leadId)
      .single();

    if (fetchErr || !leadData) {
      return NextResponse.json({ error: `Lead not found: ${fetchErr?.message || leadId}` }, { status: 404 });
    }

    const currentRemarks = leadData.remarks || '';
    let existingAttachments: AttachmentItem[] = [];

    if (Array.isArray(leadData.attachments) && leadData.attachments.length > 0) {
      existingAttachments = leadData.attachments;
    } else {
      const filesMatch = currentRemarks.match(/\[Files:\s*(\[.*?\])\]/);
      if (filesMatch) {
        try {
          existingAttachments = JSON.parse(filesMatch[1]);
        } catch (_) {}
      } else if (leadData.floor_plan_url) {
        existingAttachments = [{
          url: leadData.floor_plan_url,
          name: leadData.floor_plan_name || 'Floor Plan'
        }];
      }
    }

    let remainingAttachments: AttachmentItem[] = [];

    if (fileUrl) {
      // Remove only this specific file
      remainingAttachments = existingAttachments.filter(a => a.url !== fileUrl);
    } else {
      // Remove all files
      remainingAttachments = [];
    }

    // Clean old tags from remarks
    const cleanedRemarks = currentRemarks
      .replace(/\[Files:\s*\[.*?\]\]\s*/g, '')
      .replace(/\[FloorPlan:\s*\{.*?\}\]\s*/g, '')
      .trim();

    let newRemarks = cleanedRemarks;
    if (remainingAttachments.length > 0) {
      newRemarks = `${cleanedRemarks ? cleanedRemarks + ' ' : ''}[Files: ${JSON.stringify(remainingAttachments)}]`.trim();
    }

    const deletePayload: any = {
      floor_plan_url: remainingAttachments[0]?.url || null,
      floor_plan_name: remainingAttachments[0]?.name || null,
      attachments: remainingAttachments,
      remarks: newRemarks,
      updated_at: new Date().toISOString(),
    };

    const { error: deleteUpdateError } = await supabaseAdmin
      .from('quotation_leads')
      .update(deletePayload)
      .eq('id', leadId);

    if (deleteUpdateError) {
      if (deleteUpdateError.code === '42703') {
        delete deletePayload.attachments;
        const { error: retryErr } = await supabaseAdmin
          .from('quotation_leads')
          .update(deletePayload)
          .eq('id', leadId);
        if (retryErr) throw new Error(`Database update failed: ${retryErr.message}`);
      } else {
        throw new Error(`Database update failed: ${deleteUpdateError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      attachments: remainingAttachments,
      url: remainingAttachments[0]?.url || null,
      name: remainingAttachments[0]?.name || null,
    });
  } catch (error: any) {
    console.error('Error removing file:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
