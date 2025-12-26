-- Diagnostic queries to check OneSignal setup

-- 1. Check if onesignal_player_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'onesignal_player_id';

-- 2. Check if any users have OneSignal Player IDs
SELECT id, email, onesignal_player_id, created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 3. Count users with Player IDs
SELECT 
  COUNT(*) as total_users,
  COUNT(onesignal_player_id) as users_with_player_id,
  COUNT(*) - COUNT(onesignal_player_id) as users_without_player_id
FROM users;

-- 4. Check recent notifications created
SELECT id, user_id, title, message, type, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
