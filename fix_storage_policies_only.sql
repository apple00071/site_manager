-- ============================================
-- FIX STORAGE POLICIES ONLY (Buckets already exist)
-- ============================================
-- Run this in Supabase SQL Editor to fix upload errors
-- This only updates the RLS policies, not the buckets
-- ============================================

-- ============================================
-- Step 1: Drop All Existing Storage Policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can upload update photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload design files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own design files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to project-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from project-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from project-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to project-files" ON storage.objects;

-- ============================================
-- Step 2: Create New Simplified Storage Policies
-- ============================================
-- These policies allow ANY authenticated user to upload/manage files

-- Project Update Photos - Allow all authenticated users
CREATE POLICY "Allow authenticated uploads to project-update-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-update-photos');

CREATE POLICY "Allow public read from project-update-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow authenticated delete from project-update-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow authenticated update to project-update-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-update-photos');

-- Inventory Bills - Allow all authenticated users
CREATE POLICY "Allow authenticated uploads to inventory-bills"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inventory-bills');

CREATE POLICY "Allow public read from inventory-bills"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Allow authenticated delete from inventory-bills"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Allow authenticated update to inventory-bills"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'inventory-bills');

-- Design Files - Allow all authenticated users
CREATE POLICY "Allow authenticated uploads to design-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Allow public read from design-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'design-files');

CREATE POLICY "Allow authenticated delete from design-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'design-files');

CREATE POLICY "Allow authenticated update to design-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'design-files');

-- Project Files (Requirements PDFs) - Allow all authenticated users
CREATE POLICY "Allow authenticated uploads to project-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Allow public read from project-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-files');

CREATE POLICY "Allow authenticated delete from project-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');

CREATE POLICY "Allow authenticated update to project-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-files');

-- ============================================
-- ✅ DONE! Storage policies updated.
-- ============================================
-- You should now be able to:
-- 1. Upload photos in Updates tab
-- 2. Upload bills in Inventory tab ✅
-- 3. Upload design files in Designs tab
-- 4. Upload requirements PDFs in new project form
--
-- If you still get errors:
-- - Make sure you're logged in
-- - Refresh your browser
-- - Check browser console for specific errors
-- ============================================
