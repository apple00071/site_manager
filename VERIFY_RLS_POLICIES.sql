-- ============================================================================
-- RLS POLICY VERIFICATION SCRIPT
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify your RLS policies
-- are correctly configured
-- ============================================================================

-- ============================================================================
-- PART 1: Check Projects Table Policies
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'projects'
ORDER BY policyname;

-- Expected policies:
-- 1. "Admins can manage all projects" - FOR ALL
-- 2. "Employees can view assigned projects" - FOR SELECT
--    Should check BOTH project_members AND assigned_employee_id

-- ============================================================================
-- PART 2: Check Project Steps Table Policies
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'project_steps'
ORDER BY policyname;

-- Expected policies after running COMPLETE_RLS_FIX.sql:
-- 1. "project_steps_select" - FOR SELECT
-- 2. "project_steps_insert" - FOR INSERT
-- 3. "project_steps_update" - FOR UPDATE
-- 4. "project_steps_delete" - FOR DELETE

-- ============================================================================
-- PART 3: Check Project Step Tasks Table Policies
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'project_step_tasks'
ORDER BY policyname;

-- Expected policies after running COMPLETE_RLS_FIX.sql:
-- 1. "step_tasks_select" - FOR SELECT
-- 2. "step_tasks_insert" - FOR INSERT
-- 3. "step_tasks_update" - FOR UPDATE
-- 4. "step_tasks_delete" - FOR DELETE

-- ============================================================================
-- PART 4: Check Project Members Table Policies
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'project_members'
ORDER BY policyname;

-- Expected policies:
-- 1. "Admins can manage project members" - FOR ALL
-- 2. "Employees can view their project assignments" - FOR SELECT

-- ============================================================================
-- PART 5: Test Current User's Access
-- ============================================================================

-- Check your current user's role
SELECT
  id,
  email,
  role,
  full_name
FROM users
WHERE id = auth.uid();

-- Check which projects you have access to via project_members
SELECT 
  pm.project_id,
  p.title as project_title,
  pm.permissions
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id = auth.uid();

-- Check which projects you have access to via assigned_employee_id
SELECT 
  id,
  title,
  assigned_employee_id
FROM projects
WHERE assigned_employee_id = auth.uid();

-- ============================================================================
-- PART 6: Count Policies (Quick Check)
-- ============================================================================

-- This should show the count of policies for each table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('projects', 'project_steps', 'project_step_tasks', 'project_members')
GROUP BY tablename
ORDER BY tablename;

-- Expected counts after running COMPLETE_RLS_FIX.sql:
-- projects: 2 policies
-- project_steps: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- project_step_tasks: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- project_members: 2 policies

-- ============================================================================
-- PART 7: Check for Old/Conflicting Policies
-- ============================================================================

-- Check if there are any "FOR ALL" policies on project_steps (should be removed)
SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'project_steps'
AND cmd = '*';  -- '*' means FOR ALL

-- This should return NO ROWS after running COMPLETE_RLS_FIX.sql
-- If you see "project_steps_modify", it means the old policy wasn't dropped

-- Check if there are any "FOR ALL" policies on project_step_tasks (should be removed)
SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'project_step_tasks'
AND cmd = '*';  -- '*' means FOR ALL

-- This should return NO ROWS after running COMPLETE_RLS_FIX.sql
-- If you see "step_tasks_modify", it means the old policy wasn't dropped

-- ============================================================================
-- TROUBLESHOOTING TIPS
-- ============================================================================

-- If you see unexpected results:
-- 1. Make sure you ran the ENTIRE COMPLETE_RLS_FIX.sql file
-- 2. Check that you're logged in as the correct user in Supabase
-- 3. Try logging out and back in to refresh your session
-- 4. Clear your browser cache

-- If policies are missing:
-- 1. Re-run COMPLETE_RLS_FIX.sql
-- 2. Check for SQL errors in the Supabase SQL Editor output

-- If you still see "FOR ALL" policies:
-- 1. Manually drop them using:
--    DROP POLICY IF EXISTS "project_steps_modify" ON project_steps;
--    DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks;
-- 2. Then re-run COMPLETE_RLS_FIX.sql

