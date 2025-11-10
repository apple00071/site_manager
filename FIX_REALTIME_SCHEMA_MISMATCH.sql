-- ============================================
-- FIX: Realtime Schema Mismatch Error
-- Error: "mismatch between server and client bindings for postgres changes"
-- ============================================

-- This error means Realtime is enabled but there's a schema mismatch.
-- Run these commands in order to fix it.

-- Step 1: Remove notifications from Realtime publication (if it exists)
-- ============================================
-- Note: This will error if table is not in publication - that's OK, just continue
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Table not in publication or already removed';
END $$;

-- Step 2: Verify the table structure is correct
-- ============================================
-- Check current table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Expected columns:
-- id, user_id, title, message, type, related_id, related_type, is_read, created_at, updated_at

-- Step 3: Ensure RLS policies are correct
-- ============================================
-- Check existing policies
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Step 4: Re-add notifications to Realtime with REPLICA IDENTITY
-- ============================================
-- Set replica identity to FULL (required for Realtime to work properly)
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Step 5: Re-enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Step 6: Verify it's enabled
-- ============================================
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Should return: notifications | supabase_realtime

-- Step 7: Check replica identity
-- ============================================
SELECT 
  relname,
  relreplident
FROM pg_class
WHERE relname = 'notifications';

-- relreplident should be 'f' (FULL)
-- 'd' = DEFAULT (only primary key)
-- 'f' = FULL (all columns) - REQUIRED for Realtime

-- ============================================
-- COMPLETE FIX (Run all at once)
-- ============================================
-- Uncomment and run this block to fix everything:

/*
-- Remove from publication (ignore errors if not in publication)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Table not in publication or already removed';
END $$;

-- Set replica identity to FULL
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Re-add to publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Verify
SELECT
  pt.schemaname,
  pt.tablename,
  pt.pubname,
  pc.relreplident
FROM pg_publication_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
WHERE pt.schemaname = 'public'
  AND pt.tablename = 'notifications';
*/

-- Expected result:
-- schemaname | tablename     | pubname            | relreplident
-- public     | notifications | supabase_realtime  | f

-- ============================================
-- After running this, refresh your application!
-- ============================================

