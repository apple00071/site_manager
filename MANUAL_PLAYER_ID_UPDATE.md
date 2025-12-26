# Quick Fix: Manually Update Player IDs in Database

Since the OneSignal SDK in Median isn't automatically saving Player IDs to the database, you need to manually update them.

## Step 1: Get Player IDs from OneSignal Dashboard

From your screenshot, the Player IDs are:
- `8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca`
- `18231428-aee6-4cce-a8b4-9399ca96741b`
- `f6da229d-5aa5-4c1e-8f84-fedbb408c5ee`

## Step 2: Match to Users

You need to figure out which Player ID belongs to which user. The easiest way:

1. In OneSignal dashboard, click on each Player ID
2. Look at the "Last Session" timestamp
3. Match it to when each user logged into your app

OR look at IP addresses/device info to identify users.

## Step 3: Run SQL in Supabase

Once you know the mapping, run these SQL commands in Supabase:

```sql
-- Replace [user-email] with actual emails from your users table
UPDATE users SET onesignal_player_id = '8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca' WHERE email = 'admin@appleinteriors.in';
UPDATE users SET onesignal_player_id = '18231428-aee6-4cce-a8b4-9399ca96741b' WHERE email = '[second-user-email]';
UPDATE users SET onesignal_player_id = 'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee' WHERE email = '[third-user-email]';
```

## Step 4: Verify

```sql
SELECT id, email, onesignal_player_id FROM users WHERE onesignal_player_id IS NOT NULL;
```

You should see Player IDs populated!

## Step 5: Test Backend Notifications

Once Player IDs are in the database, your backend will automatically send push notifications when:
- Tasks are assigned
- Calendar events are created
- Project updates are posted
- Etc.

The backend code now looks up Player IDs from the database and sends to those devices!

## Alternative: Wait for Automatic Update

When users open the app, the `OneSignalInit.tsx` component will run and save their Player ID automatically. But for immediate testing, manual update is faster.
