-- ============================================
-- Multi-Assignee Task Support Migration
-- ============================================
-- This migration converts the assigned_to columns in tasks and project_step_tasks
-- from a single UUID to a UUID array to support multiple assignees per task.

BEGIN;

-- 1. Update tasks table (Calendar Tasks)
-- ============================================

-- Create a temporary column to hold the new array data
ALTER TABLE tasks ADD COLUMN assigned_to_new UUID[] DEFAULT '{}';

-- Migrate existing data: convert single UUID to array with one element
UPDATE tasks SET assigned_to_new = ARRAY[assigned_to] WHERE assigned_to IS NOT NULL;

-- Drop the old column and rename the new one
ALTER TABLE tasks DROP COLUMN assigned_to;
ALTER TABLE tasks RENAME COLUMN assigned_to_new TO assigned_to;

-- Re-create index for the new array column using GIN for performance with contains/overlap operators
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks USING GIN (assigned_to);

-- 2. Update project_step_tasks table (General Tasks)
-- ============================================

-- Create a temporary column
ALTER TABLE project_step_tasks ADD COLUMN assigned_to_new UUID[] DEFAULT '{}';

-- Migrate existing data
UPDATE project_step_tasks SET assigned_to_new = ARRAY[assigned_to] WHERE assigned_to IS NOT NULL;

-- Drop and rename
ALTER TABLE project_step_tasks DROP COLUMN assigned_to;
ALTER TABLE project_step_tasks RENAME COLUMN assigned_to_new TO assigned_to;

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_assigned_to ON project_step_tasks USING GIN (assigned_to);

-- 3. Update RLS Policies
-- ============================================

-- Update policies for 'tasks' table
-- Note: We need to drop and recreate policies that depend on the assigned_to column

-- Dropping existing policies that likely use the old assigned_to column
-- (Adjusting names based on common patterns in the codebase)
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Employees can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Assignees can update their tasks" ON tasks;

-- Recreating with array support
CREATE POLICY "Users can view assigned tasks" 
ON tasks FOR SELECT 
USING (
  auth.uid() = ANY(assigned_to) 
  OR created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Assignees or creators can update tasks" 
ON tasks FOR UPDATE 
USING (
  auth.uid() = ANY(assigned_to) 
  OR created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Update policies for 'project_step_tasks' table
DROP POLICY IF EXISTS "Users can view assigned step tasks" ON project_step_tasks;
DROP POLICY IF EXISTS "Assignees can update step tasks" ON project_step_tasks;

CREATE POLICY "Users can view assigned step tasks" 
ON project_step_tasks FOR SELECT 
USING (
  auth.uid() = ANY(assigned_to) 
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM project_members 
    JOIN project_steps ON project_steps.project_id = project_members.project_id
    WHERE project_steps.id = project_step_tasks.step_id
    AND project_members.user_id = auth.uid()
  )
);

-- 4. Update task_activity policies
-- ============================================

DROP POLICY IF EXISTS "Users can view task activity for accessible tasks" ON task_activity;

CREATE POLICY "Users can view task activity for accessible tasks"
  ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_activity.task_id
      AND (
        auth.uid() = ANY(tasks.assigned_to)
        OR tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
    )
  );

COMMIT;

COMMENT ON COLUMN tasks.assigned_to IS 'Array of user IDs assigned to this task';
COMMENT ON COLUMN project_step_tasks.assigned_to IS 'Array of user IDs assigned to this project step task';
