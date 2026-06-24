-- Create employee_documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_employee_documents_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employee_documents_modtime ON public.employee_documents;
CREATE TRIGGER update_employee_documents_modtime
    BEFORE UPDATE ON public.employee_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_documents_modtime();

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Create robust helper function for document management authorization
CREATE OR REPLACE FUNCTION public.check_user_can_manage_documents(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_authorized BOOLEAN := FALSE;
BEGIN
    -- 1. Check JWT first (fast in-memory path)
    BEGIN
        IF coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' THEN
            RETURN TRUE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fall through if auth.jwt() fails or doesn't exist
    END;

    -- 2. Check public.users table (direct role check)
    BEGIN
        IF EXISTS (
            SELECT 1 FROM public.users
            WHERE id = user_id AND role = 'admin'
        ) THEN
            RETURN TRUE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fall through
    END;

    -- 3. Check granular permissions
    BEGIN
        IF EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.role_permissions rp ON u.role_id = rp.role_id
            JOIN public.permissions p ON rp.permission_id = p.id
            WHERE u.id = user_id 
            AND p.code = 'users.manage_documents'
        ) THEN
            RETURN TRUE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fall through
    END;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly grant execute privileges to database roles
GRANT EXECUTE ON FUNCTION public.check_user_can_manage_documents(UUID) TO public;
GRANT EXECUTE ON FUNCTION public.check_user_can_manage_documents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_can_manage_documents(UUID) TO service_role;

-- Policies for employee_documents table
DROP POLICY IF EXISTS "Admins can do everything on employee documents" ON public.employee_documents;
CREATE POLICY "Admins can do everything on employee documents"
    ON public.employee_documents
    FOR ALL
    TO authenticated
    USING (
        public.check_user_can_manage_documents(auth.uid())
    );

DROP POLICY IF EXISTS "Users can view their own documents" ON public.employee_documents;
CREATE POLICY "Users can view their own documents"
    ON public.employee_documents
    FOR SELECT
    USING (
        employee_id = auth.uid()
    );

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage bucket
DROP POLICY IF EXISTS "Admins can manage employee-documents bucket" ON storage.objects;
CREATE POLICY "Admins can manage employee-documents bucket"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'employee-documents'
        AND public.check_user_can_manage_documents(auth.uid())
    )
    WITH CHECK (
        bucket_id = 'employee-documents'
        AND public.check_user_can_manage_documents(auth.uid())
    );

DROP POLICY IF EXISTS "Authenticated users can upload employee-documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload employee-documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'employee-documents'
        AND (
            (auth.uid())::text = (string_to_array(name, '/'))[1]
            OR public.check_user_can_manage_documents(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can view their own employee-documents" ON storage.objects;
CREATE POLICY "Users can view their own employee-documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'employee-documents'
        AND (
            (auth.uid())::text = (string_to_array(name, '/'))[1]
            OR owner = auth.uid()
            OR public.check_user_can_manage_documents(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Owners can delete their own employee-documents" ON storage.objects;
CREATE POLICY "Owners can delete their own employee-documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'employee-documents'
        AND (
            owner = auth.uid()
            OR public.check_user_can_manage_documents(auth.uid())
        )
    );
