-- Phase 1: Client Portal Security Migration

-- 1. Add 'client' to user_role enum
-- Note: In Postgres, you can't easily add a value to an enum inside a transaction in some environments, 
-- but Supabase usually handles this well.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'client') THEN
        ALTER TYPE user_role ADD VALUE 'client';
    END IF;
END
$$;

-- 2. Add portal_user_id to projects table to officially link a client account
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Update RLS policies to allow clients to access their data
-- We use a SECURITY DEFINER function or direct RLS.

-- Allow clients to view their own projects
CREATE POLICY "Clients can view their assigned projects" 
  ON projects FOR SELECT 
  USING (
    portal_user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow clients to view updates for their projects
CREATE POLICY "Clients can view their project updates"
  ON project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_updates.project_id 
      AND projects.portal_user_id = auth.uid()
    )
  );

-- Allow clients to view designs for their projects
CREATE POLICY "Clients can view their design files"
  ON design_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = design_files.project_id 
      AND projects.portal_user_id = auth.uid()
    )
  );

-- Allow clients to Approve/Reject designs (Update status)
CREATE POLICY "Clients can update design status"
  ON design_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = design_files.project_id 
      AND projects.portal_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = design_files.project_id 
      AND projects.portal_user_id = auth.uid()
    )
  );

-- Allow clients to post messages (Timeline updates)
CREATE POLICY "Clients can post updates to their projects"
  ON project_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_updates.project_id 
      AND projects.portal_user_id = auth.uid()
    )
  );
