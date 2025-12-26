-- Add OneSignal Player ID column to users table
-- This stores the OneSignal device/player ID for each user to enable push notifications

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_onesignal_player_id 
ON users(onesignal_player_id);

-- Add comment for documentation
COMMENT ON COLUMN users.onesignal_player_id IS 'OneSignal Player ID for push notifications';
