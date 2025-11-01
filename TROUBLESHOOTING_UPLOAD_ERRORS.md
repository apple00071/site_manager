# Troubleshooting File Upload Errors

Based on the errors you're experiencing, here's a comprehensive guide to fix all upload issues.

---

## Error 1: "new row violates row-level security policy"

### What This Means
Supabase Storage buckets have Row Level Security (RLS) enabled, but the policies are not configured to allow authenticated users to upload files.

### Solution: Configure Storage Policies

You need to add storage policies for each bucket. Here's how:

### Step 1: Go to Supabase Dashboard
1. Visit https://app.supabase.com
2. Select your project
3. Click **Storage** in the left sidebar

### Step 2: Configure project-update-photos Bucket

1. Click on the `project-update-photos` bucket
2. Click the **Policies** tab
3. Click **New Policy**
4. Click **For full customization**
5. Fill in the form:
   - **Policy name**: `Allow authenticated users to upload`
   - **Allowed operation**: Check ALL boxes (SELECT, INSERT, UPDATE, DELETE)
   - **Target roles**: Select `authenticated`
   - **Policy definition - USING expression**:
     ```sql
     true
     ```
   - **Policy definition - WITH CHECK expression**:
     ```sql
     true
     ```
6. Click **Review**
7. Click **Save policy**

### Step 3: Configure inventory-bills Bucket

Repeat Step 2 for the `inventory-bills` bucket with the same settings.

### Step 4: Configure design-files Bucket

Repeat Step 2 for the `design-files` bucket with the same settings.

---

## Error 2: "Bucket not found" or 400 Bad Request

### What This Means
The storage buckets don't exist yet.

### Solution: Create Storage Buckets

### Create project-update-photos Bucket
1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Bucket name: `project-update-photos`
4. **IMPORTANT**: Toggle **Public bucket** to ON (green switch)
5. Click **Create bucket**

### Create inventory-bills Bucket
1. Click **New bucket**
2. Bucket name: `inventory-bills`
3. **IMPORTANT**: Toggle **Public bucket** to ON
4. Click **Create bucket**

### Create design-files Bucket
1. Click **New bucket**
2. Bucket name: `design-files`
3. **IMPORTANT**: Toggle **Public bucket** to ON
4. Click **Create bucket**

After creating all buckets, go back to **Error 1** above and configure the policies.

---

## Error 3: "Failed to fetch updates/inventory/designs" (500 Internal Server Error)

### What This Means
The database tables don't exist yet. The migration hasn't been run.

### Solution: Run Database Migration

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file `RUN_THIS_IN_SUPABASE.sql` from your project
6. Copy the ENTIRE contents (all ~330 lines)
7. Paste into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)
9. Wait for "Success. No rows returned" message

### Verify Tables Were Created
1. Click **Table Editor** in the left sidebar
2. You should see these new tables:
   - `project_updates`
   - `inventory_items`
   - `design_files`
   - `design_comments`

If you don't see them, the migration failed. Check the error message in the SQL Editor.

---

## Error 4: Column "can_view" or "can_edit" does not exist

### What This Means
The RLS policies in the migration file were using incorrect column names.

### Solution
This has been fixed in the `RUN_THIS_IN_SUPABASE.sql` file. The policies now correctly use:
- `(project_members.permissions->>'view')::boolean = true`
- `(project_members.permissions->>'edit')::boolean = true`

If you already ran the old migration, run the new one again. It will drop and recreate the policies.

---

## Complete Setup Checklist

Follow this checklist to ensure everything is set up correctly:

### ✅ Database Setup
- [ ] Ran `RUN_THIS_IN_SUPABASE.sql` in SQL Editor
- [ ] Verified 4 new tables exist in Table Editor:
  - [ ] `project_updates`
  - [ ] `inventory_items`
  - [ ] `design_files`
  - [ ] `design_comments`

### ✅ Storage Buckets
- [ ] Created `project-update-photos` bucket (Public: ON)
- [ ] Created `inventory-bills` bucket (Public: ON)
- [ ] Created `design-files` bucket (Public: ON)

### ✅ Storage Policies
- [ ] Added policy to `project-update-photos` bucket
- [ ] Added policy to `inventory-bills` bucket
- [ ] Added policy to `design-files` bucket

### ✅ Test Each Feature
- [ ] Can upload photos in Updates tab
- [ ] Can upload bills in Inventory tab
- [ ] Can upload designs in Designs tab

---

## Quick Fix SQL Script

If you want to quickly set up storage policies via SQL instead of the UI, run this in SQL Editor:

```sql
-- Storage policies for project-update-photos
INSERT INTO storage.policies (name, bucket_id, definition, check)
VALUES (
  'Allow authenticated users to upload',
  'project-update-photos',
  'true',
  'true'
) ON CONFLICT DO NOTHING;

-- Storage policies for inventory-bills
INSERT INTO storage.policies (name, bucket_id, definition, check)
VALUES (
  'Allow authenticated users to upload',
  'inventory-bills',
  'true',
  'true'
) ON CONFLICT DO NOTHING;

-- Storage policies for design-files
INSERT INTO storage.policies (name, bucket_id, definition, check)
VALUES (
  'Allow authenticated users to upload',
  'design-files',
  'true',
  'true'
) ON CONFLICT DO NOTHING;
```

**Note:** This assumes the buckets already exist. If they don't, create them via the UI first.

---

## Testing After Setup

### Test Updates Tab
1. Navigate to any project
2. Click **Updates** tab
3. Click **+ Add Update**
4. Fill in date and description
5. Click **Choose File** and select an image
6. Wait for "Uploading photos..." to complete
7. Click **Save Update**
8. ✅ Should see "Update created successfully"

### Test Inventory Tab
1. Click **Inventory** tab
2. Click **+ Add Item**
3. Fill in item details
4. Click **Choose File** under Bill/Invoice
5. Select a file (image or PDF)
6. Wait for upload to complete
7. Click **Add Item**
8. ✅ Should see the item in the table

### Test Designs Tab
1. Click **Designs** tab
2. Click **+ Upload Design**
3. Select a design file
4. Enter version number
5. Click **Upload**
6. ✅ Should see the design in the list

---

## Common Errors and Solutions

### Error: "You are not logged in"
**Solution:** Log out and log back in. Clear browser cookies if needed.

### Error: "Permission denied"
**Solution:** Make sure you're assigned to the project. Check `project_members` table or `assigned_employee_id` field.

### Error: "Invalid file type"
**Solution:** 
- Updates: Only images allowed
- Inventory: Images and PDFs allowed
- Designs: All file types allowed

### Error: Upload hangs/never completes
**Solution:**
1. Check browser console for errors
2. Check network tab for failed requests
3. Verify storage bucket is public
4. Verify storage policies exist

---

## Still Having Issues?

If you're still experiencing errors after following this guide:

1. **Check Browser Console**
   - Press F12
   - Go to Console tab
   - Look for red error messages
   - Copy the exact error message

2. **Check Network Tab**
   - Press F12
   - Go to Network tab
   - Try uploading a file
   - Look for failed requests (red)
   - Click on the failed request
   - Check the Response tab for error details

3. **Check Supabase Logs**
   - Go to Supabase Dashboard
   - Click **Logs** in the left sidebar
   - Look for recent errors

4. **Verify Environment Variables**
   - Check `.env.local` file
   - Make sure all Supabase keys are correct
   - Restart dev server after changing env vars

---

## Summary

**Most common issue:** Storage policies not configured

**Quick fix:**
1. Create 3 storage buckets (all public)
2. Add policies to each bucket (allow authenticated users)
3. Run database migration
4. Test uploads

**If that doesn't work:**
- Check browser console for specific error
- Verify buckets exist and are public
- Verify tables exist in database
- Check that you're logged in

---

**After completing all steps, refresh your browser and test all three upload features!** 🚀

