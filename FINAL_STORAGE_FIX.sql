-- ============================================
-- FINAL STORAGE FIX - MOST PERMISSIVE POLICIES
-- ============================================
-- Run this in Supabase SQL Editor
-- This creates the most permissive policies possible
-- ============================================

-- First, let's make sure buckets exist and are PUBLIC
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('project-update-photos', 'inventory-bills', 'design-files');

-- Drop ALL existing policies on storage.objects
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- ============================================
-- Create SUPER PERMISSIVE policies
-- ============================================
-- These allow ANYONE (even anonymous) to do anything
-- We'll restrict later if needed, but first let's get it working

-- Allow ANYONE to upload to project-update-photos
CREATE POLICY "Public upload to project-update-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-update-photos');

CREATE POLICY "Public read from project-update-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Public delete from project-update-photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Public update to project-update-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-update-photos');

-- Allow ANYONE to upload to inventory-bills
CREATE POLICY "Public upload to inventory-bills"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inventory-bills');

CREATE POLICY "Public read from inventory-bills"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Public delete from inventory-bills"
ON storage.objects FOR DELETE
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Public update to inventory-bills"
ON storage.objects FOR UPDATE
USING (bucket_id = 'inventory-bills');

-- Allow ANYONE to upload to design-files
CREATE POLICY "Public upload to design-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Public read from design-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'design-files');

CREATE POLICY "Public delete from design-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'design-files');

CREATE POLICY "Public update to design-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'design-files');

-- ============================================
-- ✅ DONE! 
-- ============================================
-- These are VERY permissive policies (anyone can upload)
-- But they should work immediately
-- After confirming uploads work, we can add authentication checks
-- ============================================

