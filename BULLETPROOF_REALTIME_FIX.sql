-- ============================================
-- BULLETPROOF REALTIME FIX
-- Handles existing policies gracefully
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Remove from Realtime publication
-- ============================================
DO $$
BEGIN
  -- Try to remove the table from publication
  ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
  RAISE NOTICE '✅ Removed notifications from supabase_realtime publication';
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE '⚠️ Table was not in publication (this is OK, continuing...)';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not remove from publication: % (continuing...)', SQLERRM;
END $$;

-- ============================================
-- STEP 2: Set REPLICA IDENTITY to FULL
-- ============================================
ALTER TABLE notifications REPLICA IDENTITY FULL;
-- This is CRITICAL for Realtime to work

-- ============================================
-- STEP 3: Grant necessary permissions
-- ============================================
-- Grant SELECT to authenticated users (required for Realtime subscriptions)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON notifications TO authenticated;
GRANT SELECT ON notifications TO anon;

-- ============================================
-- STEP 4: Ensure RLS policies exist (gracefully)
-- ============================================

-- Drop and recreate policies to ensure they're correct
-- This handles the "already exists" error

-- Policy 1: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can update their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Service role can insert notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

-- Policy 4: Users can delete their own notifications (if needed)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Re-add to Realtime publication
-- ============================================
DO $$
BEGIN
  -- Try to add the table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  RAISE NOTICE '✅ Added notifications to supabase_realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ Table already in publication - this is OK!';
    RAISE NOTICE '🔄 Attempting to refresh by removing and re-adding...';
    -- Remove and re-add to force refresh
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
      RAISE NOTICE '✅ Successfully refreshed publication';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Could not refresh: % (table should still work)', SQLERRM;
    END;
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error adding to publication: %', SQLERRM;
END $$;

-- ============================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================

-- Check 1: Verify REPLICA IDENTITY is FULL
SELECT 
  '1. REPLICA IDENTITY CHECK' as check_name,
  relname as table_name,
  CASE relreplident
    WHEN 'd' THEN '❌ DEFAULT (primary key only) - NEEDS FIX'
    WHEN 'f' THEN '✅ FULL (all columns) - CORRECT'
    WHEN 'n' THEN '❌ NOTHING - NEEDS FIX'
    WHEN 'i' THEN '⚠️ INDEX - MAY WORK'
  END as replica_identity_status
FROM pg_class
WHERE relname = 'notifications';

-- Check 2: Verify table is in Realtime publication
SELECT 
  '2. PUBLICATION CHECK' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Table is in supabase_realtime publication'
    ELSE '❌ Table is NOT in publication - NEEDS FIX'
  END as publication_status
FROM pg_publication_tables
WHERE schemaname = 'public' 
  AND tablename = 'notifications'
  AND pubname = 'supabase_realtime';

-- Check 3: Verify RLS policies exist
SELECT 
  '3. RLS POLICIES CHECK' as check_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Policies exist (' || COUNT(*) || ' policies)'
    ELSE '⚠️ Only ' || COUNT(*) || ' policies found (expected at least 3)'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Check 4: List all policies
SELECT 
  '4. POLICY DETAILS' as check_name,
  policyname,
  cmd as command,
  CASE 
    WHEN roles::text LIKE '%authenticated%' THEN '✅ authenticated'
    ELSE '⚠️ ' || roles::text
  END as roles_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'notifications'
ORDER BY policyname;

-- Check 5: Verify permissions
SELECT 
  '5. PERMISSIONS CHECK' as check_name,
  grantee,
  string_agg(privilege_type, ', ') as privileges,
  CASE 
    WHEN grantee = 'authenticated' AND string_agg(privilege_type, ', ') LIKE '%SELECT%' 
      THEN '✅ Has SELECT permission'
    ELSE '⚠️ Check permissions'
  END as permission_status
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND grantee IN ('authenticated', 'anon', 'service_role')
GROUP BY grantee;

-- Check 6: Verify RLS is enabled
SELECT 
  '6. RLS STATUS CHECK' as check_name,
  tablename,
  CASE rowsecurity
    WHEN true THEN '✅ RLS is ENABLED'
    ELSE '❌ RLS is DISABLED - NEEDS FIX'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- ============================================
-- FINAL SUMMARY
-- ============================================
SELECT 
  '=== FINAL SUMMARY ===' as summary,
  CASE 
    WHEN (
      -- Check REPLICA IDENTITY is FULL
      (SELECT relreplident FROM pg_class WHERE relname = 'notifications') = 'f'
      AND
      -- Check table is in publication
      (SELECT COUNT(*) FROM pg_publication_tables 
       WHERE tablename = 'notifications' AND pubname = 'supabase_realtime') > 0
      AND
      -- Check RLS is enabled
      (SELECT rowsecurity FROM pg_tables 
       WHERE tablename = 'notifications') = true
      AND
      -- Check policies exist
      (SELECT COUNT(*) FROM pg_policies 
       WHERE tablename = 'notifications') >= 3
    )
    THEN '✅✅✅ ALL CHECKS PASSED - REALTIME SHOULD WORK! ✅✅✅'
    ELSE '⚠️⚠️⚠️ SOME CHECKS FAILED - REVIEW RESULTS ABOVE ⚠️⚠️⚠️'
  END as status;

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- 1. REPLICA IDENTITY: ✅ FULL (all columns) - CORRECT
-- 2. PUBLICATION: ✅ Table is in supabase_realtime publication
-- 3. RLS POLICIES: ✅ Policies exist (4 policies)
-- 4. PERMISSIONS: ✅ authenticated has SELECT permission
-- 5. RLS STATUS: ✅ RLS is ENABLED
-- 6. FINAL SUMMARY: ✅✅✅ ALL CHECKS PASSED - REALTIME SHOULD WORK! ✅✅✅
-- ============================================

