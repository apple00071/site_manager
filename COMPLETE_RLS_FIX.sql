-- ============================================================================
-- COMPLETE RLS POLICY FIX FOR APPLE INTERIOR MANAGER
-- ============================================================================
-- This file fixes ALL RLS (Row Level Security) policy issues
-- Run this ENTIRE file in Supabase SQL Editor in ONE GO
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Projects Table RLS Policies
-- ============================================================================

-- Drop existing employee project view policy
DROP POLICY IF EXISTS "Employees can view assigned projects" ON projects;

-- Create new policy that allows employees to see projects via BOTH methods:
-- 1. Via project_members table (team assignments)
-- 2. Via assigned_employee_id field (direct assignment)
CREATE POLICY "Employees can view assigned projects" 
  ON projects FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = projects.id 
      AND user_id = auth.uid() 
      AND permissions->>'view' = 'true'
    )
    OR
    assigned_employee_id = auth.uid()
  );

-- ============================================================================
-- PART 2: Fix Project Steps Table RLS Policies
-- ============================================================================

-- Drop ALL existing project_steps policies
DROP POLICY IF EXISTS "project_steps_select" ON project_steps;
DROP POLICY IF EXISTS "project_steps_modify" ON project_steps;
DROP POLICY IF EXISTS "project_steps_insert" ON project_steps;
DROP POLICY IF EXISTS "project_steps_update" ON project_steps;
DROP POLICY IF EXISTS "project_steps_delete" ON project_steps;

-- Create separate SELECT policy (avoids circular dependency)
CREATE POLICY "project_steps_select" ON project_steps
  FOR SELECT TO authenticated USING (
    -- Allow admins to view all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to view steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create INSERT policy
CREATE POLICY "project_steps_insert" ON project_steps
  FOR INSERT TO authenticated WITH CHECK (
    -- Allow admins to insert all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to insert steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create UPDATE policy
CREATE POLICY "project_steps_update" ON project_steps
  FOR UPDATE TO authenticated USING (
    -- Allow admins to update all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to update steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
  ) WITH CHECK (
    -- Allow admins to update all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to update steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create DELETE policy
CREATE POLICY "project_steps_delete" ON project_steps
  FOR DELETE TO authenticated USING (
    -- Allow admins to delete all steps
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to delete steps
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 3: Fix Project Step Tasks Table RLS Policies
-- ============================================================================

-- Drop ALL existing project_step_tasks policies
DROP POLICY IF EXISTS "step_tasks_select" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_insert" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_update" ON project_step_tasks;
DROP POLICY IF EXISTS "step_tasks_delete" ON project_step_tasks;

-- Create SELECT policy
CREATE POLICY "step_tasks_select" ON project_step_tasks
  FOR SELECT TO authenticated USING (
    -- Allow admins to view all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to view tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create INSERT policy
CREATE POLICY "step_tasks_insert" ON project_step_tasks
  FOR INSERT TO authenticated WITH CHECK (
    -- Allow admins to insert all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to insert tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create UPDATE policy
CREATE POLICY "step_tasks_update" ON project_step_tasks
  FOR UPDATE TO authenticated USING (
    -- Allow admins to update all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
  ) WITH CHECK (
    -- Allow admins to update all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to update tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create DELETE policy
CREATE POLICY "step_tasks_delete" ON project_step_tasks
  FOR DELETE TO authenticated USING (
    -- Allow admins to delete all tasks
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Allow project members to delete tasks
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
      AND pm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run these to verify the policies)
-- ============================================================================

-- Check all policies on project_steps table
-- SELECT * FROM pg_policies WHERE tablename = 'project_steps';

-- Check all policies on project_step_tasks table
-- SELECT * FROM pg_policies WHERE tablename = 'project_step_tasks';

-- Check all policies on projects table
-- SELECT * FROM pg_policies WHERE tablename = 'projects';

