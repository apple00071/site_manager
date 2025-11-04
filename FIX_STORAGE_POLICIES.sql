-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR TO FIX STORAGE UPLOAD ERRORS
-- ============================================
-- This script:
-- 1. Creates storage buckets if they don't exist
-- 2. Drops all old storage policies
-- 3. Creates new simplified policies that allow authenticated users to upload
-- ============================================

-- ============================================
-- Step 1: Create Storage Buckets
-- ============================================

-- Create bucket for project update photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-update-photos',
  'project-update-photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Create bucket for inventory bills/invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-bills',
  'inventory-bills',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Create bucket for design files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-files',
  'design-files',
  true,
  104857600, -- 100MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/dwg', 'application/dxf', 'image/vnd.dwg', 'image/vnd.dxf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/dwg', 'application/dxf', 'image/vnd.dwg', 'image/vnd.dxf'];

-- ============================================
-- Step 2: Drop All Existing Storage Policies
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

-- ============================================
-- Step 3: Create New Simplified Storage Policies
-- ============================================
-- These policies allow ANY authenticated user to upload/manage files
-- This is simpler and avoids the folder ownership issues

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

-- ============================================
-- ✅ DONE! Storage buckets and policies created.
-- ============================================
-- You should now be able to:
-- 1. Upload photos in Updates tab
-- 2. Upload bills in Inventory tab
-- 3. Upload design files in Designs tab
--
-- If you still get errors, check:
-- - You are logged in (authenticated)
-- - Your session hasn't expired
-- - The file type is allowed (JPEG, PNG, GIF, WebP, PDF)
-- ============================================

