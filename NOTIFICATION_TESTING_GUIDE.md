# Notification System Testing Guide

## 🧪 How to Test the Notification System

### Prerequisites
- Two browser windows/tabs (or two different browsers)
- Admin account and employee account
- Browser console open (F12) to see logs

---

## Test 1: Basic Notification Delivery

### Steps:
1. **Login as Employee** in Browser Window 1
2. **Login as Admin** in Browser Window 2
3. **In Admin window:** Create a new task and assign it to the employee
4. **In Employee window:** Watch for notification

### Expected Results:
✅ Notification appears **instantly** (within 1-2 seconds)  
✅ Notification sound plays  
✅ Unread count badge shows "1"  
✅ Console shows: `🔔 New notification received via realtime`  

### If it fails:
- Check console for errors
- Verify realtime subscription status: `📡 Realtime subscription status: SUBSCRIBED`
- Check if notification permission is granted

---

## Test 2: Token Refresh (Long Session)

### Steps:
1. **Login** and keep browser open
2. **Wait 60+ minutes** (or change token expiry in Supabase settings for faster testing)
3. **Click notification bell** to fetch notifications
4. **Create a new notification** from another session

### Expected Results:
✅ Token refreshes automatically before API call  
✅ Console shows: `🔄 Token expires in X seconds`  
✅ Console shows: `✅ Session refreshed successfully`  
✅ Notifications still load correctly  
✅ No 401 errors  

### If it fails:
- Check console for: `❌ Refresh failed`
- Look for: `Invalid Refresh Token` errors
- Verify `.env.local` has correct Supabase keys

---

## Test 3: Error Handling & Recovery

### Steps:
1. **Login** and open notification bell
2. **Disconnect internet** (turn off WiFi or use browser DevTools → Network → Offline)
3. **Wait 10 seconds**
4. **Reconnect internet**

### Expected Results:
✅ Error message appears in notification dropdown  
✅ Shows: "Network error. Please check your connection and try again."  
✅ "Try again" button appears  
✅ Clicking "Try again" reloads notifications  
✅ System recovers automatically  

### If it fails:
- Check if error message is displayed
- Verify retry logic in console
- Look for: `🔄 Retrying in Xms...`

---

## Test 4: Real-time vs Polling

### Steps:
1. **Login** and open browser console
2. **Watch console logs** for 2 minutes
3. **Create a notification** from another session immediately
4. **Wait 60 seconds** without creating notifications

### Expected Results:
✅ New notification arrives **instantly** via realtime  
✅ Console shows: `🔔 New notification received via realtime`  
✅ After 60 seconds, see: `🔄 Polling for notifications (fallback)...`  
✅ Polling happens every 60 seconds as backup  

### If it fails:
- Check if realtime is enabled in Supabase
- Verify WebSocket connection in Network tab
- Look for subscription errors

---

## Test 5: Notification Sound

### Steps:
1. **Login** and ensure notification permission is granted
2. **Create a new notification** from another session
3. **Listen for sound**

### Expected Results:
✅ Two-tone beep plays immediately  
✅ Console shows: `🔊 Attempting to play notification sound...`  
✅ Console shows: `✅ Notification sound played successfully`  
✅ Sound only plays once per notification  

### If it fails:
- Check browser notification permission (should be "granted")
- Try clicking on the page first (browser autoplay policy)
- Check console for: `❌ Error playing notification sound`
- Verify notification is less than 5 minutes old

---

## Test 6: Mark as Read

### Steps:
1. **Login** with unread notifications
2. **Click on a notification**
3. **Observe changes**

### Expected Results:
✅ Notification background changes from yellow to white  
✅ Unread count decreases by 1  
✅ Change persists after page refresh  

### If it fails:
- Check console for API errors
- Verify `/api/notifications` PATCH request succeeds
- Check if token is valid

---

## Test 7: Mark All as Read

### Steps:
1. **Login** with multiple unread notifications
2. **Click "Mark all read"** button
3. **Observe changes**

### Expected Results:
✅ All notifications turn white (no yellow background)  
✅ Unread count badge disappears  
✅ "Mark all read" button disappears  
✅ Changes persist after page refresh  

### If it fails:
- Check console for API errors
- Verify PATCH request to `/api/notifications`
- Check loading state

---

## Test 8: Delete Notification

### Steps:
1. **Login** with notifications
2. **Click the X button** on a notification
3. **Observe changes**

### Expected Results:
✅ Notification disappears from list  
✅ Unread count updates if it was unread  
✅ Deletion persists after page refresh  

### If it fails:
- Check console for DELETE request errors
- Verify `/api/notifications?id=X` DELETE succeeds

---

## Test 9: Multiple Notifications

### Steps:
1. **Login as Employee**
2. **From Admin account:** Create 5 tasks quickly
3. **Watch Employee window**

### Expected Results:
✅ All 5 notifications appear instantly  
✅ Sound plays only once (for the first new notification)  
✅ Unread count shows "5"  
✅ All notifications are in correct order (newest first)  

### If it fails:
- Check if all notifications arrived
- Verify sound only played once
- Check sessionStorage for `last_notification_sound_id`

---

## Test 10: Browser Refresh

### Steps:
1. **Login** with unread notifications
2. **Refresh the page** (F5)
3. **Observe notification state**

### Expected Results:
✅ Unread count persists  
✅ Notifications reload correctly  
✅ Real-time subscription reconnects  
✅ Console shows: `📡 Setting up real-time subscription...`  

### If it fails:
- Check if session persists
- Verify notifications reload
- Look for subscription errors

---

## 🔍 Debugging Tips

### Check Console Logs

Look for these emoji prefixes:
- `🔔` - Notification events
- `🔄` - Token refresh / polling
- `✅` - Success messages
- `❌` - Errors
- `📡` - Realtime subscription
- `⏰` - Token expiration warnings
- `🔊` - Sound playback
- `🧹` - Cleanup operations

### Check Network Tab

1. **Open DevTools → Network**
2. **Filter by "notifications"**
3. **Look for:**
   - GET `/api/notifications` - Should return 200
   - PATCH `/api/notifications` - Should return 200
   - DELETE `/api/notifications?id=X` - Should return 200
   - WebSocket connection to Supabase Realtime

### Check Application Tab

1. **Open DevTools → Application**
2. **Check Local Storage:**
   - Look for `sb:apple-interior-manager:auth-token`
   - Should contain valid session data
3. **Check Session Storage:**
   - Look for `last_notification_sound_id`
   - Should contain UUID of last notification that played sound

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| No notifications appear | Realtime not enabled | Enable in Supabase Dashboard |
| 401 errors | Token expired | Check token refresh logs |
| No sound | Permission denied | Grant notification permission |
| Delayed notifications | Realtime failed | Check WebSocket connection |
| Duplicate sounds | sessionStorage cleared | Normal after refresh |

---

## 📊 Performance Metrics

### Before Fix:
- Notification delay: **30 seconds** (polling interval)
- API calls per hour: **120** (every 30 seconds)
- Token refresh: **Manual** (often failed)
- Error recovery: **None**

### After Fix:
- Notification delay: **< 2 seconds** (realtime)
- API calls per hour: **60** (every 60 seconds fallback)
- Token refresh: **Automatic** (every 50 minutes)
- Error recovery: **Automatic** (3 retries with backoff)

---

## ✅ Success Criteria

The notification system is working correctly if:

1. ✅ Notifications arrive within 2 seconds
2. ✅ Sound plays for new notifications
3. ✅ System works for 2+ hours continuously
4. ✅ No 401 errors in console
5. ✅ Token refreshes automatically
6. ✅ Errors are displayed to users
7. ✅ System recovers from network issues
8. ✅ Real-time subscription stays connected
9. ✅ Fallback polling works if realtime fails
10. ✅ All CRUD operations work (read, mark read, delete)

---

## 🚨 Report Issues

If you find issues during testing, please report:

1. **What you were doing** (which test)
2. **What happened** (actual behavior)
3. **What should have happened** (expected behavior)
4. **Console logs** (copy relevant errors)
5. **Network tab** (screenshot of failed requests)
6. **Browser and version** (Chrome 120, Firefox 121, etc.)

---

**Happy Testing! 🎉**

