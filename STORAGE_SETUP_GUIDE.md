# Storage Buckets Setup Guide

## Step 1: Run SQL Migration

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file `RUN_THIS_IN_SUPABASE.sql` from this project
6. Copy ALL the contents
7. Paste into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)
9. Wait for "Success. No rows returned" message

## Step 2: Create Storage Buckets

You need to create 3 storage buckets manually in the Supabase Dashboard.

### Bucket 1: project-update-photos

1. Go to **Storage** in the left sidebar
2. Click **New bucket**
3. Enter bucket name: `project-update-photos`
4. **IMPORTANT**: Toggle **Public bucket** to ON (green)
5. Click **Create bucket**

### Bucket 2: inventory-bills

1. Click **New bucket** again
2. Enter bucket name: `inventory-bills`
3. **IMPORTANT**: Toggle **Public bucket** to ON (green)
4. Click **Create bucket**

### Bucket 3: design-files

1. Click **New bucket** again
2. Enter bucket name: `design-files`
3. **IMPORTANT**: Toggle **Public bucket** to ON (green)
4. Click **Create bucket**

## Step 3: Configure Storage Policies

For each bucket, you need to set up policies to allow authenticated users to upload files.

### For project-update-photos bucket:

1. Click on the `project-update-photos` bucket
2. Click **Policies** tab
3. Click **New Policy**
4. Select **For full customization**
5. Policy name: `Allow authenticated uploads`
6. Target roles: `authenticated`
7. Policy definition:
   - **SELECT**: Check ✓ (Allow)
   - **INSERT**: Check ✓ (Allow)
   - **UPDATE**: Check ✓ (Allow)
   - **DELETE**: Check ✓ (Allow)
8. USING expression:
   ```sql
   (bucket_id = 'project-update-photos'::text)
   ```
9. WITH CHECK expression:
   ```sql
   (bucket_id = 'project-update-photos'::text)
   ```
10. Click **Review**
11. Click **Save policy**

### For inventory-bills bucket:

Repeat the same steps as above, but replace `project-update-photos` with `inventory-bills`:

1. Click on the `inventory-bills` bucket
2. Click **Policies** tab
3. Click **New Policy**
4. Select **For full customization**
5. Policy name: `Allow authenticated uploads`
6. Target roles: `authenticated`
7. Policy definition: Check all (SELECT, INSERT, UPDATE, DELETE)
8. USING expression:
   ```sql
   (bucket_id = 'inventory-bills'::text)
   ```
9. WITH CHECK expression:
   ```sql
   (bucket_id = 'inventory-bills'::text)
   ```
10. Click **Review**
11. Click **Save policy**

### For design-files bucket:

Repeat the same steps, but replace with `design-files`:

1. Click on the `design-files` bucket
2. Click **Policies** tab
3. Click **New Policy**
4. Select **For full customization**
5. Policy name: `Allow authenticated uploads`
6. Target roles: `authenticated`
7. Policy definition: Check all (SELECT, INSERT, UPDATE, DELETE)
8. USING expression:
   ```sql
   (bucket_id = 'design-files'::text)
   ```
9. WITH CHECK expression:
   ```sql
   (bucket_id = 'design-files'::text)
   ```
10. Click **Review**
11. Click **Save policy**

## Step 4: Verify Setup

### Check Tables
1. Go to **Table Editor**
2. You should see these new tables:
   - ✓ project_updates
   - ✓ inventory_items
   - ✓ design_files
   - ✓ design_comments

### Check Storage Buckets
1. Go to **Storage**
2. You should see these buckets:
   - ✓ project-update-photos (Public)
   - ✓ inventory-bills (Public)
   - ✓ design-files (Public)

### Check Policies
1. Click on each bucket
2. Click **Policies** tab
3. You should see "Allow authenticated uploads" policy for each bucket

## Step 5: Test

1. Refresh your browser at http://localhost:3000
2. Navigate to a project
3. Try uploading:
   - A photo in the Updates tab
   - A bill in the Inventory tab
   - A design file in the Designs tab

If you still get errors, check the browser console and let me know!

## Troubleshooting

### Error: "new row violates row-level security policy"

This means the storage policies are not set up correctly. Make sure:
1. All buckets are set to **Public**
2. All buckets have the "Allow authenticated uploads" policy
3. The policy USING and WITH CHECK expressions match the bucket name exactly

### Error: "Bucket not found"

This means the bucket doesn't exist. Go back to Step 2 and create the missing bucket.

### Error: "Failed to fetch updates/inventory/designs"

This means the database tables don't exist. Go back to Step 1 and run the SQL migration.

