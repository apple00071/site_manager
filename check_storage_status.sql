-- ============================================
-- DIAGNOSTIC - Check Storage Configuration
-- ============================================
-- Run this to see what's configured
-- ============================================

-- Check if buckets exist and their settings
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id IN ('inventory-bills', 'project-update-photos', 'design-files', 'project-files')
ORDER BY id;

-- Check existing policies on storage.objects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- Check if RLS is enabled on storage.objects
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' 
AND tablename = 'objects';
