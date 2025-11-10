-- ============================================
-- COMPLETE FIX FOR REALTIME SCHEMA MISMATCH
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Step 1: Remove table from Realtime publication
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
  RAISE NOTICE 'Removed notifications from publication';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Table was not in publication (this is OK)';
END $$;

-- Step 2: Set REPLICA IDENTITY to FULL
-- ============================================
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Step 3: Grant necessary permissions for Realtime
-- ============================================
-- Grant SELECT to authenticated users (required for Realtime)
GRANT SELECT ON notifications TO authenticated;
GRANT SELECT ON notifications TO anon;

-- Step 4: Ensure RLS policies are correct
-- ============================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Enable realtime for users own notifications" ON notifications;

-- Recreate policies with correct permissions
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

-- Special policy for Realtime (allows subscription)
CREATE POLICY "Enable realtime for users own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 5: Re-add table to Realtime publication
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Step 6: Verify everything is set up correctly
-- ============================================
-- Check REPLICA IDENTITY
SELECT 
  relname as table_name,
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT ❌'
    WHEN 'f' THEN 'FULL ✅'
    WHEN 'n' THEN 'NOTHING ❌'
    WHEN 'i' THEN 'INDEX'
  END as replica_identity
FROM pg_class
WHERE relname = 'notifications';

-- Check if table is in Realtime publication
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE tablename = 'notifications';

-- Check RLS policies
SELECT 
  policyname,
  cmd as command,
  roles
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Check table permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'notifications'
  AND grantee IN ('authenticated', 'anon', 'service_role');

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- 1. replica_identity should be 'FULL ✅'
-- 2. pubname should be 'supabase_realtime'
-- 3. Should have 3-4 policies
-- 4. authenticated and anon should have SELECT permission

-- ============================================
-- After running this, refresh your application!
-- ============================================

