-- ============================================================================
-- DIAGNOSTIC SCRIPT FOR RLS ISSUES
-- ============================================================================
-- Run this script to diagnose why you're getting 401 errors
-- Copy the results and share them to get help
-- ============================================================================

-- ============================================================================
-- PART 1: Check Current User Authentication
-- ============================================================================

-- Who am I logged in as?
SELECT 
  auth.uid() as my_user_id,
  auth.jwt() ->> 'email' as my_email,
  auth.jwt() ->> 'role' as jwt_role;

-- What's my user record?
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM users
WHERE id = auth.uid();

-- ============================================================================
-- PART 2: Check Project Access
-- ============================================================================

-- Which projects can I access via project_members?
SELECT 
  pm.project_id,
  p.title as project_title,
  pm.permissions,
  pm.created_at
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id = auth.uid();

-- Which projects can I access via assigned_employee_id?
SELECT 
  id as project_id,
  title as project_title,
  assigned_employee_id,
  created_at
FROM projects
WHERE assigned_employee_id = auth.uid();

-- Can I see ANY projects at all?
SELECT 
  id,
  title,
  assigned_employee_id,
  created_at
FROM projects
LIMIT 5;

-- ============================================================================
-- PART 3: Check RLS Policies on project_steps
-- ============================================================================

-- List ALL policies on project_steps
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'project_steps'
ORDER BY policyname;

-- Count policies by command type
SELECT 
  cmd,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'project_steps'
GROUP BY cmd
ORDER BY cmd;

-- ============================================================================
-- PART 4: Test INSERT Permission on project_steps
-- ============================================================================

-- First, let's see if we can SELECT from project_steps
SELECT COUNT(*) as steps_i_can_see
FROM project_steps;

-- Try to see steps for a specific project (replace with your project ID)
-- REPLACE 'your-project-id-here' with the actual project ID from the URL
SELECT 
  id,
  title,
  stage,
  status,
  project_id
FROM project_steps
WHERE project_id = 'dcbdcf72f-18f3-460f-9043-dfb88e47b0c5'  -- REPLACE THIS
LIMIT 5;

-- ============================================================================
-- PART 5: Check if RLS is Enabled
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('projects', 'project_steps', 'project_step_tasks', 'users')
ORDER BY tablename;

-- ============================================================================
-- PART 6: Test Policy Logic Manually
-- ============================================================================

-- Am I an admin?
SELECT EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = auth.uid() AND u.role = 'admin'
) as am_i_admin;

-- For a specific project, am I a member?
-- REPLACE 'your-project-id-here' with the actual project ID
SELECT EXISTS (
  SELECT 1 FROM project_members pm
  WHERE pm.project_id = 'dcbdcf72f-18f3-460f-9043-dfb88e47b0c5'  -- REPLACE THIS
  AND pm.user_id = auth.uid()
) as am_i_member_via_project_members;

-- For a specific project, am I assigned via assigned_employee_id?
-- REPLACE 'your-project-id-here' with the actual project ID
SELECT EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = 'dcbdcf72f-18f3-460f-9043-dfb88e47b0c5'  -- REPLACE THIS
  AND p.assigned_employee_id = auth.uid()
) as am_i_assigned_via_employee_id;

-- ============================================================================
-- PART 7: Check for Policy Conflicts
-- ============================================================================

-- Are there any "FOR ALL" policies that might conflict?
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('project_steps', 'project_step_tasks')
AND cmd = '*'  -- '*' means FOR ALL
ORDER BY tablename, policyname;

-- This should return NO ROWS if the fix was applied correctly

-- ============================================================================
-- PART 8: Verify Policy Counts
-- ============================================================================

SELECT 
  tablename,
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies,
  COUNT(*) FILTER (WHERE cmd = '*') as for_all_policies
FROM pg_policies 
WHERE tablename IN ('projects', 'project_steps', 'project_step_tasks')
GROUP BY tablename
ORDER BY tablename;

-- Expected results:
-- projects: 2 total (1 FOR ALL for admins, 1 SELECT for employees)
-- project_steps: 4 total (1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE)
-- project_step_tasks: 4 total (1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE)

-- ============================================================================
-- PART 9: Test Actual INSERT (This will fail if RLS is blocking)
-- ============================================================================

-- Try to insert a test step (this will show the actual error)
-- REPLACE 'your-project-id-here' with the actual project ID
-- This will fail if you don't have permission, but the error message will be helpful

-- UNCOMMENT THE LINES BELOW TO TEST (remove the -- at the start of each line)
-- INSERT INTO project_steps (project_id, title, stage, status, sort_order)
-- VALUES (
--   'dcbdcf72f-18f3-460f-9043-dfb88e47b0c5',  -- REPLACE THIS
--   'Test Step - DELETE ME',
--   'false_ceiling',
--   'todo',
--   999
-- )
-- RETURNING *;

-- If the above INSERT works, delete the test step:
-- DELETE FROM project_steps WHERE title = 'Test Step - DELETE ME';

-- ============================================================================
-- SUMMARY OF WHAT TO CHECK
-- ============================================================================

-- 1. PART 1: Verify you're logged in and your role is correct
-- 2. PART 2: Verify you can see the project you're trying to add steps to
-- 3. PART 3: Verify there are 4 policies on project_steps (SELECT, INSERT, UPDATE, DELETE)
-- 4. PART 6: Verify at least ONE of these is TRUE:
--    - am_i_admin = true, OR
--    - am_i_member_via_project_members = true, OR
--    - am_i_assigned_via_employee_id = true
-- 5. PART 7: Verify there are NO "FOR ALL" policies (should return 0 rows)
-- 6. PART 8: Verify policy counts match expected values
-- 7. PART 9: Try the actual INSERT to see the real error message

-- ============================================================================
-- NEXT STEPS BASED ON RESULTS
-- ============================================================================

-- If PART 1 shows auth.uid() is NULL:
--   → You're not logged in. Log out and log back in.

-- If PART 2 shows no projects:
--   → You don't have access to any projects. Ask admin to assign you.

-- If PART 3 shows 5 policies instead of 4:
--   → Old "FOR ALL" policy wasn't dropped. Run FORCE_DROP_AND_RECREATE_POLICIES.sql

-- If PART 6 shows all FALSE:
--   → You're not assigned to this project. Ask admin to assign you.

-- If PART 7 shows any rows:
--   → Old policies are conflicting. Run FORCE_DROP_AND_RECREATE_POLICIES.sql

-- If PART 8 shows wrong counts:
--   → Policies weren't created correctly. Run FORCE_DROP_AND_RECREATE_POLICIES.sql

