-- ============================================================================
-- FORCE DROP AND RECREATE ALL RLS POLICIES
-- ============================================================================
-- This script aggressively drops ALL policies and recreates them correctly
-- Run this ENTIRE file in Supabase SQL Editor in ONE GO
-- ============================================================================

-- ============================================================================
-- STEP 1: FORCE DROP ALL EXISTING POLICIES (Even if they don't exist)
-- ============================================================================

-- Drop ALL possible policies on projects table
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Employees can view assigned projects" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- Drop ALL possible policies on project_steps table
DROP POLICY IF EXISTS "project_steps_select" ON project_steps;
DROP POLICY IF EXISTS "project_steps_modify" ON project_steps;
DROP POLICY IF EXISTS "project_steps_insert" ON project_steps;
DROP POLICY IF EXISTS "project_steps_update" ON project_steps;
DROP POLICY IF EXISTS "project_steps_delete" ON project_steps;
DROP POLICY IF EXISTS "project_steps_all" ON project_steps;

-- Drop ALL possible policies on project_step_tasks table
DROP POLICY IF EXISTS "step_tasks_select" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_insert" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_update" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_delete" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_all" ON project_step_tasks;

-- ============================================================================
-- STEP 2: RECREATE PROJECTS TABLE POLICIES
-- ============================================================================

-- Policy 1: Admins can do everything with projects
CREATE POLICY "Admins can manage all projects" 
  ON projects 
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 2: Employees can view projects they're assigned to (BOTH methods)
CREATE POLICY "Employees can view assigned projects" 
  ON projects 
  FOR SELECT 
  TO authenticated
  USING (
    -- Method 1: Via project_members table
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = projects.id 
      AND user_id = auth.uid() 
      AND permissions->>'view' = 'true'
    )
    OR
    -- Method 2: Via assigned_employee_id field
    assigned_employee_id = auth.uid()
  );

-- ============================================================================
-- STEP 3: RECREATE PROJECT_STEPS TABLE POLICIES
-- ============================================================================

-- Policy 1: SELECT - Who can view steps
CREATE POLICY "project_steps_select" 
  ON project_steps
  FOR SELECT 
  TO authenticated 
  USING (
    -- Admins can view all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can view steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can view steps
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Who can create new steps
CREATE POLICY "project_steps_insert" 
  ON project_steps
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- Admins can insert all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can insert steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can insert steps
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 3: UPDATE - Who can modify existing steps
CREATE POLICY "project_steps_update" 
  ON project_steps
  FOR UPDATE 
  TO authenticated 
  USING (
    -- Admins can update all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can update steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can update steps
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
      AND p.assigned_employee_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Admins can update all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can update steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can update steps
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Who can delete steps
CREATE POLICY "project_steps_delete" 
  ON project_steps
  FOR DELETE 
  TO authenticated 
  USING (
    -- Admins can delete all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can delete steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can delete steps
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: RECREATE PROJECT_STEP_TASKS TABLE POLICIES
-- ============================================================================

-- Policy 1: SELECT - Who can view tasks
CREATE POLICY "step_tasks_select" 
  ON project_step_tasks
  FOR SELECT 
  TO authenticated 
  USING (
    -- Admins can view all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can view tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can view tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Who can create new tasks
CREATE POLICY "step_tasks_insert" 
  ON project_step_tasks
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- Admins can insert all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can insert tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can insert tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 3: UPDATE - Who can modify existing tasks
CREATE POLICY "step_tasks_update" 
  ON project_step_tasks
  FOR UPDATE 
  TO authenticated 
  USING (
    -- Admins can update all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND p.assigned_employee_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Admins can update all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Who can delete tasks
CREATE POLICY "step_tasks_delete" 
  ON project_step_tasks
  FOR DELETE 
  TO authenticated 
  USING (
    -- Admins can delete all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Project members can delete tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Users assigned via assigned_employee_id can delete tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND p.assigned_employee_id = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICATION: Check that policies were created correctly
-- ============================================================================

-- This should show exactly 2 policies for projects
SELECT COUNT(*) as projects_policy_count FROM pg_policies WHERE tablename = 'projects';

-- This should show exactly 4 policies for project_steps
SELECT COUNT(*) as project_steps_policy_count FROM pg_policies WHERE tablename = 'project_steps';

-- This should show exactly 4 policies for project_step_tasks
SELECT COUNT(*) as project_step_tasks_policy_count FROM pg_policies WHERE tablename = 'project_step_tasks';

