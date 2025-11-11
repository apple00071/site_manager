-- ============================================
-- DISABLE RLS ON STORAGE (TEMPORARY FIX)
-- ============================================
-- This completely disables RLS on storage.objects
-- Use this ONLY for testing to confirm RLS is the issue
-- WARNING: This makes storage completely open!
-- ============================================

-- Disable RLS on storage.objects table
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ============================================
-- ✅ DONE! RLS is now DISABLED on storage
-- ============================================
-- This is a TEMPORARY solution for testing
-- 
-- After running this:
-- 1. Refresh browser
-- 2. Try uploading - should work now
-- 3. If it works, RLS was definitely the issue
-- 
-- To re-enable RLS later (after fixing policies):
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- ============================================
