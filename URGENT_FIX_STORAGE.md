# 🚨 URGENT: Fix Storage Upload Errors

## Problem
You're getting this error when trying to upload files:
```
Error uploading file: StorageApiError: new row violates row-level security policy
```

## Solution
Run the updated SQL file in Supabase to create storage buckets and policies.

## Steps:

### 1. Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Updated SQL
1. Open the file `RUN_THIS_IN_SUPABASE.sql` from this project
2. Copy **ALL** the contents (it now includes storage bucket creation)
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)
5. Wait for "Success" message

### 3. Verify Storage Buckets Were Created
1. Go to **Storage** in the left sidebar
2. You should see 3 buckets:
   - ✅ `project-update-photos`
   - ✅ `inventory-bills`
   - ✅ `design-files`

### 4. Test Uploads
1. Go to your project page
2. Try uploading:
   - An update with photos (Updates tab)
   - An inventory item with bill (Inventory tab)
   - A design file (Designs tab)

## What Was Fixed

### Storage Buckets
- Created 3 storage buckets automatically via SQL
- Set proper file size limits (50MB for photos/bills, 100MB for designs)
- Configured allowed MIME types for each bucket

### Storage Policies
- Added RLS policies for authenticated users to upload
- Made buckets public for viewing
- Users can delete their own files

### UI Improvements
- Fixed Stages Board layout (removed black lines, fixed overflow)
- Removed confusing "Subtask" concept
- Tasks now show directly in columns with start/end dates
- Cleaner, more professional UI with better spacing
- All task info collected upfront (no separate subtask modal)

## If You Still Get Errors

### Check Authentication
Make sure you're logged in. The error happens when:
- User is not authenticated
- Session expired
- Wrong permissions

### Check Bucket Names
The code uses these exact bucket names:
- `project-update-photos` (for Updates tab)
- `inventory-bills` (for Inventory tab)
- `design-files` (for Designs tab)

### Check File Types
Allowed file types:
- **Photos**: JPEG, PNG, GIF, WebP
- **Bills**: JPEG, PNG, GIF, WebP, PDF
- **Designs**: JPEG, PNG, GIF, WebP, PDF, DWG, DXF

## Next Steps After Fix

1. ✅ Run the SQL (fixes storage)
2. ✅ Test uploads in all 3 tabs
3. ✅ Enjoy the improved UI!

The UI is now much cleaner and more professional. No more black lines, no more content overflow, and tasks are easier to manage!

