-- ============================================
-- EMERGENCY FIX - COMPLETELY OPEN STORAGE POLICIES
-- ============================================
-- This makes storage completely open for testing
-- Run this if the previous script didn't work
-- ============================================

-- Drop ALL existing policies on storage.objects
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- ============================================
-- Create SUPER PERMISSIVE policies for inventory-bills
-- ============================================

-- Allow ANYONE (even anonymous) to upload to inventory-bills
CREATE POLICY "Allow all uploads to inventory-bills"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inventory-bills');

-- Allow ANYONE to read from inventory-bills
CREATE POLICY "Allow all reads from inventory-bills"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-bills');

-- Allow ANYONE to delete from inventory-bills
CREATE POLICY "Allow all deletes from inventory-bills"
ON storage.objects FOR DELETE
USING (bucket_id = 'inventory-bills');

-- Allow ANYONE to update inventory-bills
CREATE POLICY "Allow all updates to inventory-bills"
ON storage.objects FOR UPDATE
USING (bucket_id = 'inventory-bills');

-- ============================================
-- Same for other buckets
-- ============================================

-- Project Update Photos
CREATE POLICY "Allow all uploads to project-update-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-update-photos');

CREATE POLICY "Allow all reads from project-update-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow all deletes from project-update-photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow all updates to project-update-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-update-photos');

-- Design Files
CREATE POLICY "Allow all uploads to design-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Allow all reads from design-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'design-files');

CREATE POLICY "Allow all deletes from design-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'design-files');

CREATE POLICY "Allow all updates to design-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'design-files');

-- Project Files
CREATE POLICY "Allow all uploads to project-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Allow all reads from project-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-files');

CREATE POLICY "Allow all deletes from project-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-files');

CREATE POLICY "Allow all updates to project-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-files');

-- ============================================
-- ✅ DONE! 
-- ============================================
-- This creates the most permissive policies possible
-- If this doesn't work, the issue is not with RLS policies
-- 
-- After running this:
-- 1. Refresh your browser completely (Ctrl+Shift+R)
-- 2. Clear browser cache if needed
-- 3. Try uploading again
-- 
-- If STILL doesn't work, check:
-- - Are you logged in? (Check browser console for auth token)
-- - Is the bucket public? (Should be yes)
-- - Any CORS errors in console?
-- ============================================
