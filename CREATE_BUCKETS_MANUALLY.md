# Create Storage Buckets Manually in Supabase

If the SQL scripts aren't working, create the buckets manually through the Supabase UI:

## Steps:

### 1. Go to Storage Section
1. Open your Supabase project: https://app.supabase.com
2. Click **Storage** in the left sidebar
3. Click **New bucket** button

### 2. Create Bucket: project-update-photos
1. Click **New bucket**
2. Fill in:
   - **Name**: `project-update-photos`
   - **Public bucket**: ✅ **CHECK THIS BOX** (very important!)
   - **File size limit**: `50` MB
   - **Allowed MIME types**: Leave empty or add: `image/jpeg, image/png, image/gif, image/webp`
3. Click **Create bucket**

### 3. Create Bucket: inventory-bills
1. Click **New bucket**
2. Fill in:
   - **Name**: `inventory-bills`
   - **Public bucket**: ✅ **CHECK THIS BOX** (very important!)
   - **File size limit**: `50` MB
   - **Allowed MIME types**: Leave empty or add: `image/jpeg, image/png, image/gif, image/webp, application/pdf`
3. Click **Create bucket**

### 4. Create Bucket: design-files
1. Click **New bucket**
2. Fill in:
   - **Name**: `design-files`
   - **Public bucket**: ✅ **CHECK THIS BOX** (very important!)
   - **File size limit**: `100` MB
   - **Allowed MIME types**: Leave empty or add: `image/jpeg, image/png, image/gif, image/webp, application/pdf`
3. Click **Create bucket**

### 5. Configure Policies for Each Bucket

For **EACH** of the 3 buckets you just created:

1. Click on the bucket name
2. Click **Policies** tab
3. Click **New Policy**
4. Click **For full customization** (at the bottom)
5. Create 4 policies:

#### Policy 1: Allow Upload
- **Policy name**: `Allow all uploads`
- **Allowed operation**: `INSERT`
- **Target roles**: `public` (or `authenticated` if you want only logged-in users)
- **USING expression**: Leave empty
- **WITH CHECK expression**: `true`
- Click **Review** → **Save policy**

#### Policy 2: Allow Read
- **Policy name**: `Allow all reads`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **USING expression**: `true`
- **WITH CHECK expression**: Leave empty
- Click **Review** → **Save policy**

#### Policy 3: Allow Update
- **Policy name**: `Allow all updates`
- **Allowed operation**: `UPDATE`
- **Target roles**: `public` (or `authenticated`)
- **USING expression**: `true`
- **WITH CHECK expression**: `true`
- Click **Review** → **Save policy**

#### Policy 4: Allow Delete
- **Policy name**: `Allow all deletes`
- **Allowed operation**: `DELETE`
- **Target roles**: `public` (or `authenticated`)
- **USING expression**: `true`
- **WITH CHECK expression**: Leave empty
- Click **Review** → **Save policy**

### 6. Verify

After creating all buckets and policies:

1. Go back to **Storage** main page
2. You should see 3 buckets:
   - ✅ project-update-photos (Public)
   - ✅ inventory-bills (Public)
   - ✅ design-files (Public)

3. Each bucket should have 4 policies (12 total policies across all buckets)

### 7. Test Upload

Now try uploading files in your app:
- Updates tab → Add update with photos
- Inventory tab → Add item with bill
- Designs tab → Upload design file

## If Still Not Working

If you still get RLS errors after creating buckets manually:

1. **Check Authentication**: Make sure you're logged in
2. **Check Browser Console**: Look for the exact error message
3. **Check Supabase Logs**: Go to Supabase → Logs → check for errors
4. **Try Incognito**: Sometimes browser cache causes issues

## Alternative: Disable RLS Temporarily

If you want to test without RLS (NOT recommended for production):

1. Go to each bucket
2. Click **Policies** tab
3. Toggle **Enable RLS** to OFF

This will allow all operations without any checks. Use only for testing!

