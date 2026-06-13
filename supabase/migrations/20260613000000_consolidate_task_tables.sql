-- Consolidate Task Tables Migration
-- ============================================

BEGIN;

-- 1. Add step_id and estimated_completion_date columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES project_steps(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_step_id ON tasks(step_id);

-- 2. Migrate any existing data from project_step_tasks to tasks
-- Since project_step_tasks is empty in this environment, this is a no-op but included for consistency.
INSERT INTO tasks (
  id,
  title,
  description,
  status,
  priority,
  assigned_to,
  created_by,
  created_at,
  updated_at,
  completion_description,
  completion_photos,
  step_id,
  start_date,
  estimated_completion_date,
  start_at,
  end_at
)
SELECT
  pst.id,
  pst.title,
  pst.description,
  pst.status,
  pst.priority,
  CASE WHEN pst.assigned_to IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[pst.assigned_to] END,
  pst.created_by,
  pst.created_at,
  pst.updated_at,
  pst.completion_description,
  pst.completion_photos,
  pst.step_id,
  pst.start_date,
  pst.estimated_completion_date,
  COALESCE(pst.start_date::timestamp with time zone, pst.created_at),
  COALESCE(pst.estimated_completion_date::timestamp with time zone, pst.created_at + INTERVAL '1 day')
FROM project_step_tasks pst
ON CONFLICT (id) DO NOTHING;

-- 3. Drop the project_step_tasks table
DROP TABLE IF EXISTS project_step_tasks CASCADE;

-- 4. Recreate RLS Policies on tasks table to include project memberships visibility
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Assignees or creators can update tasks" ON tasks;

-- Select policy: Allow access to creator, assigned_to, admins, or project members
CREATE POLICY "Users can view assigned tasks" 
ON tasks FOR SELECT 
USING (
  auth.uid() = ANY(assigned_to) 
  OR created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
  OR (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = tasks.project_id 
      AND project_members.user_id = auth.uid()
    )
  )
  OR (
    step_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM project_members 
      JOIN project_steps ON project_steps.project_id = project_members.project_id
      WHERE project_steps.id = tasks.step_id
      AND project_members.user_id = auth.uid()
    )
  )
);

-- Update policy: Allow updates by creator, assigned_to, admins, or project managers/members with edit access
CREATE POLICY "Assignees or creators can update tasks" 
ON tasks FOR UPDATE 
USING (
  auth.uid() = ANY(assigned_to) 
  OR created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
  OR (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = tasks.project_id 
      AND project_members.user_id = auth.uid()
      AND (project_members.permissions->>'edit')::boolean = true
    )
  )
);

COMMIT;
