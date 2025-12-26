-- Update Player IDs for existing OneSignal users
-- Run this in Supabase SQL Editor after users log into the app

-- First, check which users need Player IDs updated
SELECT 
  id,
  email,
  onesignal_player_id,
  CASE 
    WHEN onesignal_player_id IS NULL THEN 'Missing Player ID'
    ELSE 'Has Player ID'
  END as status
FROM users
ORDER BY created_at DESC;

-- Manual update if needed (replace with actual values from OneSignal dashboard)
-- UPDATE users SET one signal_player_id = '8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca' WHERE email = 'admin@appleinteriors.in';
-- UPDATE users SET onesignal_player_id = '18231428-aee6-4cce-a8b4-9399ca96741b' WHERE email = '[user-email]';
-- UPDATE users SET onesignal_player_id = 'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee' WHERE email = '[user-email]';
