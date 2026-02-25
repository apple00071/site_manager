-- 1. Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies if they were created
DROP POLICY IF EXISTS "Authenticated users can upload handover photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view handover photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete handover photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update handover photos" ON storage.objects;

-- 3. Create simple, bulletproof policies for the entire project-documents bucket
CREATE POLICY "Authenticated users can upload project documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "Anyone can view project documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-documents');

CREATE POLICY "Authenticated users can update project documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-documents');

CREATE POLICY "Authenticated users can delete project documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-documents');
