-- Add audio_url column for project_updates voice notes
ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Create bucket for project update voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-update-voices', 'project-update-voices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-update-voices bucket
CREATE POLICY "Authenticated users can upload update voice notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-update-voices');

CREATE POLICY "Anyone can listen to update voice notes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-update-voices');

CREATE POLICY "Users can delete their own update voice notes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-update-voices' AND auth.uid()::text = (storage.foldername(name))[1]);
