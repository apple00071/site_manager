# Apple Interior Manager - Setup Instructions

## Quick Start

### 1. Database Setup

Run the SQL migration file in your Supabase SQL Editor:

**File:** `RUN_THIS_IN_SUPABASE.sql`

**Steps:**
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the entire contents of `RUN_THIS_IN_SUPABASE.sql`
6. Click **Run** (or press Ctrl+Enter)
7. Wait for "Success" message

This will create:
- ✅ 4 new database tables (project_updates, inventory_items, design_files, design_comments)
- ✅ All necessary indexes
- ✅ Row Level Security (RLS) policies
- ✅ Auto-update triggers

### 2. Storage Buckets Setup

Create 3 storage buckets in Supabase Dashboard:

#### Bucket 1: project-update-photos
1. Go to **Storage** → Click **New bucket**
2. Name: `project-update-photos`
3. **Toggle "Public bucket" to ON** ✅
4. Click **Create bucket**
5. Click on the bucket → **Policies** tab → **New Policy**
6. Select **For full customization**
7. Policy name: `Allow authenticated uploads`
8. Target roles: `authenticated`
9. Check all: SELECT, INSERT, UPDATE, DELETE
10. USING expression: `(bucket_id = 'project-update-photos'::text)`
11. WITH CHECK expression: `(bucket_id = 'project-update-photos'::text)`
12. Click **Save policy**

#### Bucket 2: inventory-bills
Repeat the same steps as above, but use `inventory-bills` as the bucket name.

#### Bucket 3: design-files
Repeat the same steps as above, but use `design-files` as the bucket name.

### 3. Install Dependencies

```bash
npm install
```

### 4. Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 6. Build for Production

```bash
npm run build
```

---

## Features

### 1. Updates Tab
- Timeline view for daily project updates
- Upload multiple photos per update
- View full-screen photos
- Shows who posted each update

### 2. Inventory Tab
- Track materials and inventory items
- Record quantity, unit, price per unit
- Auto-calculate total cost
- Upload bills/invoices
- Edit and delete items
- View total inventory cost

### 3. Designs Tab
- Upload design files (images, PDFs, CAD files)
- Version tracking
- **Admin-only approval workflow**
- Four approval statuses: Pending, Approved, Rejected, Needs Changes
- Admin comments/feedback
- Highlight currently approved design

---

## User Roles

### Admin
- Full access to all features
- Can approve/reject designs
- Can manage all projects
- Can create/edit/delete users

### Employee
- Can view assigned projects
- Can create updates, inventory items, and upload designs
- Cannot approve designs
- Limited to projects they're assigned to

---

## Permissions

The application uses two methods for project assignment:

1. **Direct Assignment**: Via `projects.assigned_employee_id` field
2. **Team Assignment**: Via `project_members` table with JSONB permissions

Permissions in `project_members.permissions`:
- `view`: Can view the project
- `edit`: Can edit project data
- `upload`: Can upload files
- `mark_done`: Can mark tasks as done

---

## Color Theme

The application uses a yellow and gray color scheme matching the Apple Interiors brand:

- **Primary**: Yellow (yellow-500, yellow-600)
- **Text**: Gray-900 for primary text
- **Backgrounds**: White and gray-50
- **Accents**: Green (success), Red (error), Orange (warning)

---

## API Routes

### Project Updates
- `GET /api/project-updates?project_id={id}` - Fetch updates
- `POST /api/project-updates` - Create update
- `PATCH /api/project-updates` - Update update
- `DELETE /api/project-updates?id={id}` - Delete update

### Inventory Items
- `GET /api/inventory-items?project_id={id}` - Fetch items
- `POST /api/inventory-items` - Create item
- `PATCH /api/inventory-items` - Update item
- `DELETE /api/inventory-items?id={id}` - Delete item

### Design Files
- `GET /api/design-files?project_id={id}` - Fetch designs
- `POST /api/design-files` - Upload design
- `PATCH /api/design-files` - Update approval status (admin only)
- `DELETE /api/design-files?id={id}` - Delete design

### Design Comments
- `POST /api/design-comments` - Add comment

All routes use cookie-based authentication.

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Solution:** Make sure storage buckets are set to **Public** and have the correct policies.

### Error: "Failed to fetch updates/inventory/designs"

**Solution:** Run the SQL migration file (`RUN_THIS_IN_SUPABASE.sql`) to create the database tables.

### Error: "Module not found: @/lib/supabase-admin"

**Solution:** The correct file is `@/lib/supabaseAdmin` (camelCase). This has been fixed in the codebase.

### Build Errors

**Solution:** Run `npm install` to ensure all dependencies are installed, then `npm run build`.

---

## Database Schema

### project_updates
- Stores timeline updates with photos
- Links to projects and users
- Photos stored as array of URLs

### inventory_items
- Stores inventory/material items
- Auto-calculates total cost (quantity × price_per_unit)
- Links to projects and users
- Bill URL for invoices

### design_files
- Stores design file metadata
- Tracks approval status and version
- Links to projects, uploaders, and approvers
- Admin comments field

### design_comments
- Stores comments on design files
- Links to design files and users

---

## Storage Buckets

### project-update-photos
- For timeline update photos
- Public bucket
- Authenticated users can upload

### inventory-bills
- For inventory bills/invoices
- Public bucket
- Authenticated users can upload

### design-files
- For design files (images, PDFs, CAD)
- Public bucket
- Authenticated users can upload

---

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Make sure to:
1. Set Node.js version to 18+
2. Build command: `npm run build`
3. Output directory: `.next`
4. Add all environment variables

---

## Support

For issues or questions, check:
1. Browser console for errors
2. Network tab for failed API requests
3. Supabase Dashboard logs
4. Server terminal for backend errors

---

## Files Reference

- `RUN_THIS_IN_SUPABASE.sql` - Database migration (run this first!)
- `STORAGE_SETUP_GUIDE.md` - Detailed storage setup instructions
- `supabase-schema.sql` - Original database schema
- `README.md` - Project overview

---

**All features are ready to use after completing the setup!** 🎉

