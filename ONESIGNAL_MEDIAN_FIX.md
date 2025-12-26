# OneSignal Not Working - Solution Guide

## Problem Identified
All users have `onesignal_player_id` = NULL in the database, which means OneSignal SDK is not initializing in the Android app.

## Root Cause
The web-based OneSignal SDK we added doesn't work properly in Median's native wrapper. Median requires using their **native OneSignal plugin** instead.

## Solution Steps

### Step 1: Verify Median OneSignal Configuration

1. Go to **Median Dashboard** → **Plugins** → **Push Notifications**
2. Ensure these settings are correct:
   - ✅ OneSignal is **enabled**
   - ✅ App ID: `d080d582-0b88-431c-bb19-59a08f7f5379`
   - ✅ `google-services.json` is uploaded

### Step 2: Use OneSignal External User ID

Instead of relying on Player IDs in the database, use **External User ID** mapping:

**How it works:**
- When a user logs into the app, set their OneSignal External User ID to their database user ID
- When sending notifications, target by External User ID instead of Player ID
- This is more reliable for Median apps

### Step 3: Update Backend Code

Modify the OneSignal backend to send notifications using External User ID:

```typescript
// Instead of:
include_player_ids: [playerId1, playerId2]

// Use:
include_external_user_ids: [userId1, userId2]
```

### Step 4: Test the Setup

1. **Rebuild APK** in Median with correct OneSignal settings
2. **Install new APK** on Android device
3. **Log in** to the app
4. **Check OneSignal Dashboard**:
   - Go to OneSignal → **Audience** → **All Users**
   - You should see subscribed devices with External User IDs

5. **Send test notification** from OneSignal dashboard
6. **If that works**, the backend notification code should work too

### Step 5: Verify Logs

When a user opens the app, you should see in console:
```
✅ OneSignal SDK detected
🔔 Setting up OneSignal for user: [user-id]
✅ OneSignal External User ID set: [user-id]
📲 OneSignal Player ID: [player-id]
✅ OneSignal Player ID saved to database
```

## Important Notes

1. **External User ID** is the key - this maps devices to database users
2. **Player ID** is still useful for backup, but External User ID is more reliable
3. **Median's native plugin** handles all the heavy lifting
4. **Web SDK won't work** - remove the `<Script>` tag from layout.tsx if it causes issues

## Next Steps

I'm updating the code to use External User ID instead of Player ID. This should work better with Median's native OneSignal integration.
