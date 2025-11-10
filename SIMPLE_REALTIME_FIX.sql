-- ============================================
-- SIMPLE FIX: Run this in Supabase SQL Editor
-- ============================================

-- This fixes the "mismatch between server and client bindings" error
-- by completely resetting the Realtime configuration

-- 1. Remove from publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Set REPLICA IDENTITY to FULL
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 3. Grant SELECT permission (required for Realtime)
GRANT SELECT ON notifications TO authenticated;

-- 4. Re-add to publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 5. Verify (should show 'f' for FULL)
SELECT relname, relreplident FROM pg_class WHERE relname = 'notifications';

