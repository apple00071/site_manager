-- Migration: Fix RLS policies for project_steps, project_step_tasks, and projects
-- Run this in Supabase SQL Editor
-- IMPORTANT: Run this entire file in one go to ensure all policies are updated correctly

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

-- Fix project_steps SELECT policy to allow proper access
DROP POLICY IF EXISTS "project_steps_select" ON project_steps;
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

-- Fix project_steps INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "project_steps_modify" ON project_steps;
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

-- Fix project_step_tasks SELECT policy
DROP POLICY IF EXISTS "step_tasks_select" ON project_step_tasks;
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

-- Fix project_step_tasks INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks;
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

