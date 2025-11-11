-- ============================================
-- VERIFY STORAGE POLICIES
-- ============================================
-- Run this to see if policies exist
-- ============================================

-- Check all policies on storage.objects
SELECT 
    policyname,
    cmd,
    roles::text,
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- Count policies per bucket
SELECT 
    CASE 
        WHEN qual::text LIKE '%inventory-bills%' THEN 'inventory-bills'
        WHEN qual::text LIKE '%project-update-photos%' THEN 'project-update-photos'
        WHEN qual::text LIKE '%design-files%' THEN 'design-files'
        WHEN qual::text LIKE '%project-files%' THEN 'project-files'
        ELSE 'other'
    END as bucket,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
GROUP BY bucket;
