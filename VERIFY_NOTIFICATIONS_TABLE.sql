-- ============================================
-- VERIFICATION SCRIPT FOR NOTIFICATIONS TABLE
-- Run this in Supabase SQL Editor to verify everything is set up correctly
-- ============================================

-- Step 1: Check if notifications table exists
-- ============================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'notifications';

-- Expected: Should return 1 row with table_name = 'notifications'
-- If no rows: Table doesn't exist - run NOTIFICATIONS_SCHEMA.sql first


-- Step 2: Check table structure
-- ============================================
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
-- id (uuid)
-- user_id (uuid)
-- title (text)
-- message (text)
-- type (text)
-- related_id (uuid)
-- related_type (text)
-- is_read (boolean)
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)


-- Step 3: Check RLS is enabled
-- ============================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Expected: rowsecurity = true
-- If false: RLS is not enabled - run: ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;


-- Step 4: Check RLS policies
-- ============================================
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Expected policies:
-- 1. "Users can view their own notifications" (SELECT)
-- 2. "Users can update their own notifications" (UPDATE)
-- 3. "Service role can insert notifications" (INSERT)


-- Step 5: Check indexes
-- ============================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Expected indexes:
-- idx_notifications_user_id
-- idx_notifications_is_read
-- idx_notifications_created_at


-- Step 6: Check if Realtime is enabled
-- ============================================
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- Expected: Should return row(s) with pubname = 'supabase_realtime'
-- If no rows: Realtime is NOT enabled
-- To enable: ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- Step 7: Test notification creation (as service role)
-- ============================================
-- This will create a test notification
-- Replace 'YOUR_USER_ID' with an actual user ID from auth.users

-- First, get a user ID:
SELECT id, email FROM auth.users LIMIT 1;

-- Then create a test notification (replace the UUID):
-- INSERT INTO notifications (user_id, title, message, type)
-- VALUES (
--   'YOUR_USER_ID',
--   'Test Notification',
--   'This is a test notification to verify the system works',
--   'general'
-- )
-- RETURNING *;


-- Step 8: Test RLS policies
-- ============================================
-- This checks if users can see their own notifications
-- Run this as a regular user (not service role)

-- SELECT * FROM notifications WHERE user_id = auth.uid();

-- Expected: Should return only notifications for the current user
-- If error: RLS policies are not set up correctly


-- Step 9: Count notifications
-- ============================================
SELECT 
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
  COUNT(*) FILTER (WHERE is_read = true) as read_notifications
FROM notifications;

-- This shows how many notifications exist in the system


-- Step 10: Check recent notifications
-- ============================================
SELECT 
  id,
  user_id,
  title,
  type,
  is_read,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Shows the 10 most recent notifications


-- ============================================
-- TROUBLESHOOTING QUERIES
-- ============================================

-- If table doesn't exist, create it:
-- Run the entire NOTIFICATIONS_SCHEMA.sql file

-- If RLS is not enabled:
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- If Realtime is not enabled:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- If policies are missing, create them:
/*
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
*/

-- If indexes are missing:
/*
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
*/


-- ============================================
-- QUICK FIX: Run everything at once
-- ============================================
-- If you want to ensure everything is set up correctly, uncomment and run:

/*
-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Create policies (will skip if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notifications' 
      AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notifications' 
      AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notifications' 
      AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications"
      ON notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
*/

