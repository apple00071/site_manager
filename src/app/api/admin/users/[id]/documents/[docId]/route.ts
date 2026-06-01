import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export async function DELETE(request: Request, context: any) {
    try {
        const { id, docId } = await context.params;
        
        // 1. Verify user is an admin
        const { user, role: userRole, error: authError } = await getAuthUser();
        
        if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    
        if (userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden. Only admins can delete documents.' }, { status: 403 });
        }

        // 2. Get document to find the file_url
        const { data: document, error: fetchError } = await supabaseAdmin
            .from('employee_documents')
            .select('file_url')
            .eq('id', docId)
            .eq('employee_id', id)
            .single();

        if (fetchError || !document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 3. Delete from storage
        const { error: storageError } = await supabaseAdmin
            .storage
            .from('employee-documents')
            .remove([document.file_url]);

        if (storageError) {
            console.error('Error deleting file from storage:', storageError);
            // We'll proceed to delete the record even if storage deletion fails, 
            // or we could return an error. Let's proceed to delete the DB record.
        }

        // 4. Delete from database
        const { error: deleteError } = await supabaseAdmin
            .from('employee_documents')
            .delete()
            .eq('id', docId);

        if (deleteError) {
            console.error('Error deleting document record:', deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error in document DELETE:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
