# How to Clear Cache After Deployment

## For End Users

After the new version is deployed, users should clear their cache to get the latest updates.

### Method 1: Hard Refresh (Recommended)

**Windows/Linux:**
- Chrome/Edge: `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: `Ctrl + Shift + R` or `Ctrl + F5`

**Mac:**
- Chrome/Edge/Safari: `Cmd + Shift + R`
- Firefox: `Cmd + Shift + R`

### Method 2: Clear Browser Cache

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Select "All time" from the time range
4. Click "Clear data"
5. Refresh the page

**Firefox:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cache"
3. Select "Everything" from the time range
4. Click "Clear Now"
5. Refresh the page

**Safari:**
1. Go to Safari → Preferences → Advanced
2. Check "Show Develop menu in menu bar"
3. Go to Develop → Empty Caches
4. Refresh the page

### Method 3: Unregister Service Worker (If Issues Persist)

1. Open the website
2. Press `F12` to open Developer Tools
3. Go to the "Console" tab
4. Paste this code and press Enter:

```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => {
    registration.unregister();
    console.log('Service Worker unregistered');
  });
});
caches.keys().then(keys => {
  keys.forEach(key => {
    caches.delete(key);
    console.log('Cache deleted:', key);
  });
});
console.log('Cache cleared! Please refresh the page.');
```

5. Close Developer Tools
6. Refresh the page with `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

## For Developers/Admins

### Verify the Fix is Working

1. **Check Service Worker Version:**
   - Open DevTools (F12)
   - Go to Application → Service Workers
   - Verify the version shows `v3`
   - Status should be "activated and is running"

2. **Check API Headers:**
   - Open DevTools (F12)
   - Go to Network tab
   - Make an API call (e.g., load notifications)
   - Click on the request
   - Check Response Headers should include:
     ```
     Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
     Pragma: no-cache
     Expires: 0
     ```

3. **Verify Network Requests:**
   - Open DevTools (F12)
   - Go to Network tab
   - Filter by "Fetch/XHR"
   - API calls should show "from network" not "from ServiceWorker"
   - Size column should show actual size, not "(from ServiceWorker)"

4. **Test Data Freshness:**
   - Make a change (e.g., create a notification)
   - Refresh the page
   - Verify the change appears immediately
   - No need to clear cache manually

### Force Update for All Users

If you need to force all users to update immediately:

1. **Increment Cache Version:**
   - Edit `public/sw.js`
   - Change `CACHE_NAME` from `v3` to `v4`
   - Deploy

2. **Add Update Notification:**
   - The app will automatically detect the new version
   - Users will see a prompt to reload
   - They can click "OK" to get the latest version

### Monitoring

Check these metrics after deployment:

1. **Service Worker Logs:**
   ```javascript
   // In browser console
   navigator.serviceWorker.getRegistrations().then(registrations => {
     console.log('Active Service Workers:', registrations.length);
     registrations.forEach(reg => {
       console.log('SW Scope:', reg.scope);
       console.log('SW State:', reg.active?.state);
     });
   });
   ```

2. **Cache Contents:**
   ```javascript
   // In browser console
   caches.keys().then(keys => {
     console.log('Cache Names:', keys);
     keys.forEach(key => {
       caches.open(key).then(cache => {
         cache.keys().then(requests => {
           console.log(`Cache ${key} has ${requests.length} entries`);
         });
       });
     });
   });
   ```

3. **Network Activity:**
   - Monitor DevTools Network tab
   - API calls should always hit the network
   - Static assets can come from cache
   - HTML pages should be network-first

## Troubleshooting

### Issue: Data Still Not Updating

**Solution:**
1. Clear cache using Method 3 above
2. Close all tabs of the website
3. Reopen the website in a new tab
4. If still not working, try in Incognito/Private mode

### Issue: Service Worker Not Updating

**Solution:**
1. Open DevTools → Application → Service Workers
2. Check "Update on reload"
3. Click "Unregister" next to the old service worker
4. Refresh the page
5. Uncheck "Update on reload"

### Issue: Getting 503 Errors

**Solution:**
- This is expected when offline
- The Service Worker returns 503 for API calls when network is unavailable
- Check your internet connection
- Try refreshing the page

### Issue: Old Version Still Showing

**Solution:**
1. Check if Service Worker is in "waiting" state
2. Close all tabs of the website
3. Reopen in a new tab
4. The new version should activate

## Support

If users continue to experience caching issues after following these steps:

1. Ask them to try in Incognito/Private mode
2. If it works in Incognito, it's a cache issue - follow Method 3
3. If it doesn't work in Incognito, it might be a server-side issue
4. Check server logs and deployment status

---

**Note:** The new caching system is designed to prevent these issues in the future. Once users update to v3, they should not need to manually clear cache again.

