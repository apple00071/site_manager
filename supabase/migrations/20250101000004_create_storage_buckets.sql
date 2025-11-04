-- Create storage buckets for project files

-- Create bucket for project update photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-update-photos', 'project-update-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for inventory bills/invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-bills', 'inventory-bills', true)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for design files
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-files', 'design-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-update-photos bucket
CREATE POLICY "Authenticated users can upload update photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-update-photos');

CREATE POLICY "Anyone can view update photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Users can delete their own update photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-update-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for inventory-bills bucket
CREATE POLICY "Authenticated users can upload inventory bills"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inventory-bills');

CREATE POLICY "Anyone can view inventory bills"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Users can delete their own inventory bills"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'inventory-bills' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for design-files bucket
CREATE POLICY "Authenticated users can upload design files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Anyone can view design files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'design-files');

CREATE POLICY "Users can delete their own design files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'design-files' AND auth.uid()::text = (storage.foldername(name))[1]);

