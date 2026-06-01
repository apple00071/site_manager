import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

export async function GET(request: Request, context: any) {
  try {
    const { id } = await context.params;
    
    // 1. Verify user is authenticated
    const { user, role: userRole, error: authError } = await getAuthUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins, the employee themselves, or users with manage_documents permission can view documents
    let canView = userRole === 'admin' || user.id === id;
    if (!canView) {
        const permCheck = await verifyPermission(user.id, PERMISSION_NODES.USERS_MANAGE_DOCUMENTS);
        canView = permCheck.allowed;
    }
    
    if (!canView) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch documents
    const { data: documents, error } = await supabaseAdmin
      .from('employee_documents')
      .select('*')
      .eq('employee_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each document
    const documentsWithUrls = await Promise.all(
        (documents || []).map(async (doc: any) => {
            const { data: urlData, error: urlError } = await supabaseAdmin
                .storage
                .from('employee-documents')
                .createSignedUrl(doc.file_url, 60 * 60); // 1 hour expiry

            return {
                ...doc,
                signed_url: urlError ? null : urlData.signedUrl
            };
        })
    );

    return NextResponse.json({ documents: documentsWithUrls });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: any) {
    try {
        const { id } = await context.params;
        
        // 1. Verify user is an admin
        const { user, role: userRole, error: authError } = await getAuthUser();
        
        if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    
        let hasPermission = userRole === 'admin';
        if (!hasPermission) {
            const permCheck = await verifyPermission(user.id, PERMISSION_NODES.USERS_MANAGE_DOCUMENTS);
            hasPermission = permCheck.allowed;
        }
        
        if (!hasPermission) {
            return NextResponse.json({ error: 'Forbidden. You do not have permission to upload documents.' }, { status: 403 });
        }

        const body = await request.json();
        const { document_name, file_url } = body;

        if (!document_name || !file_url) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('employee_documents')
            .insert({
                employee_id: id,
                document_name,
                file_url,
                uploaded_by: user.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error inserting document record:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ document: data });
    } catch (error: any) {
        console.error('Unexpected error in document POST:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
