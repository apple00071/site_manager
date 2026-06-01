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

CREATE TRIGGER update_employee_documents_modtime
    BEFORE UPDATE ON public.employee_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_documents_modtime();

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Policies for employee_documents table
CREATE POLICY "Admins can do everything on employee documents"
    ON public.employee_documents
    FOR ALL
    USING (
        (SELECT (raw_user_meta_data->>'role') FROM auth.users WHERE id = auth.uid()) = 'admin'
    );

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
CREATE POLICY "Admins can manage employee-documents bucket"
    ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'employee-documents' 
        AND (SELECT (raw_user_meta_data->>'role') FROM auth.users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can view their own employee-documents"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'employee-documents'
        AND (auth.uid())::text = (string_to_array(name, '/'))[1] -- Assumes folder structure like employee_id/filename
    );
