-- ============================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- ============================================

-- Step 1: Create Tables
-- ============================================

-- Create project_updates table for timeline updates
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  update_date DATE NOT NULL,
  description TEXT NOT NULL,
  photos TEXT[], -- Array of photo URLs from Supabase Storage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
  supplier_name VARCHAR(255),
  date_purchased DATE,
  bill_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create design_files table
CREATE TABLE IF NOT EXISTS design_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  admin_comments TEXT,
  is_current_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create design_comments table
CREATE TABLE IF NOT EXISTS design_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_file_id UUID NOT NULL REFERENCES design_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_update_date ON project_updates(update_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_project_id ON inventory_items(project_id);
CREATE INDEX IF NOT EXISTS idx_design_files_project_id ON design_files(project_id);
CREATE INDEX IF NOT EXISTS idx_design_files_approval_status ON design_files(approval_status);
CREATE INDEX IF NOT EXISTS idx_design_comments_design_file_id ON design_comments(design_file_id);

-- Step 3: Create Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_project_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_updates_updated_at ON project_updates;
CREATE TRIGGER trigger_update_project_updates_updated_at
  BEFORE UPDATE ON project_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_project_updates_updated_at();

CREATE OR REPLACE FUNCTION update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trigger_update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

CREATE OR REPLACE FUNCTION update_design_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_design_files_updated_at ON design_files;
CREATE TRIGGER trigger_update_design_files_updated_at
  BEFORE UPDATE ON design_files
  FOR EACH ROW
  EXECUTE FUNCTION update_design_files_updated_at();

-- Step 4: Enable RLS
-- ============================================

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_comments ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for project_updates
-- ============================================

DROP POLICY IF EXISTS "Admins can do everything with project_updates" ON project_updates;
CREATE POLICY "Admins can do everything with project_updates" ON project_updates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Project members can view project_updates" ON project_updates;
CREATE POLICY "Project members can view project_updates" ON project_updates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_updates.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project members can create project_updates" ON project_updates;
CREATE POLICY "Project members can create project_updates" ON project_updates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_updates.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- Step 6: RLS Policies for inventory_items
-- ============================================

DROP POLICY IF EXISTS "Admins can do everything with inventory_items" ON inventory_items;
CREATE POLICY "Admins can do everything with inventory_items" ON inventory_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Project members can view inventory_items" ON inventory_items;
CREATE POLICY "Project members can view inventory_items" ON inventory_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = inventory_items.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project members can manage inventory_items" ON inventory_items;
CREATE POLICY "Project members can manage inventory_items" ON inventory_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = inventory_items.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- Step 7: RLS Policies for design_files
-- ============================================

DROP POLICY IF EXISTS "Admins can do everything with design_files" ON design_files;
CREATE POLICY "Admins can do everything with design_files" ON design_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Project members can view design_files" ON design_files;
CREATE POLICY "Project members can view design_files" ON design_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_files.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project members can upload design_files" ON design_files;
CREATE POLICY "Project members can upload design_files" ON design_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_files.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- Step 8: RLS Policies for design_comments
-- ============================================

DROP POLICY IF EXISTS "Admins can do everything with design_comments" ON design_comments;
CREATE POLICY "Admins can do everything with design_comments" ON design_comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Project members can view design_comments" ON design_comments;
CREATE POLICY "Project members can view design_comments" ON design_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM design_files
      JOIN projects ON projects.id = design_files.project_id
      WHERE design_files.id = design_comments.design_file_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project members can add design_comments" ON design_comments;
CREATE POLICY "Project members can add design_comments" ON design_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM design_files
      JOIN projects ON projects.id = design_files.project_id
      WHERE design_files.id = design_comments.design_file_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- ============================================
-- Step 9: Create Storage Buckets
-- ============================================

-- Create bucket for project update photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-update-photos',
  'project-update-photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Create bucket for inventory bills/invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-bills',
  'inventory-bills',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Create bucket for design files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-files',
  'design-files',
  true,
  104857600, -- 100MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/dwg', 'application/dxf', 'image/vnd.dwg', 'image/vnd.dxf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/dwg', 'application/dxf', 'image/vnd.dwg', 'image/vnd.dxf'];

-- ============================================
-- Step 10: Storage RLS Policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload update photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own inventory bills" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload design files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own design files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to project-update-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to inventory-bills" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from design-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to design-files" ON storage.objects;

-- SIMPLIFIED Storage policies - Allow all authenticated users to upload/manage files

-- Project Update Photos
CREATE POLICY "Allow authenticated uploads to project-update-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-update-photos');

CREATE POLICY "Allow public read from project-update-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow authenticated delete from project-update-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-update-photos');

CREATE POLICY "Allow authenticated update to project-update-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-update-photos');

-- Inventory Bills
CREATE POLICY "Allow authenticated uploads to inventory-bills"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inventory-bills');

CREATE POLICY "Allow public read from inventory-bills"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Allow authenticated delete from inventory-bills"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'inventory-bills');

CREATE POLICY "Allow authenticated update to inventory-bills"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'inventory-bills');

-- Design Files
CREATE POLICY "Allow authenticated uploads to design-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Allow public read from design-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'design-files');

CREATE POLICY "Allow authenticated delete from design-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'design-files');

CREATE POLICY "Allow authenticated update to design-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'design-files');

-- ============================================
-- DONE! All tables, policies, and storage buckets created.
-- ============================================

