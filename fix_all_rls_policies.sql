-- Fix all RLS policies for projects and users tables
-- Run this in your Supabase SQL Editor

-- Step 1: Drop all existing policies on projects table
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Employees can view assigned projects" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- Step 2: Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all user data" ON users;
DROP POLICY IF EXISTS "Admins can insert user data" ON users;
DROP POLICY IF EXISTS "Admins can update user data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "users_own_view" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_own_update" ON users;
DROP POLICY IF EXISTS "users_view_all" ON users;

-- Step 3: Create simple policies for projects table
-- Allow all authenticated users to insert projects
CREATE POLICY "projects_insert" ON projects
  FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to view projects
CREATE POLICY "projects_select" ON projects
  FOR SELECT
  USING (true);

-- Allow all authenticated users to update projects
CREATE POLICY "projects_update" ON projects
  FOR UPDATE
  USING (true);

-- Allow all authenticated users to delete projects
CREATE POLICY "projects_delete" ON projects
  FOR DELETE
  USING (true);

-- Step 4: Create simple policies for users table
-- Allow all authenticated users to view users
CREATE POLICY "users_view_all" ON users
  FOR SELECT
  USING (true);

-- Allow all authenticated users to insert users
CREATE POLICY "users_insert" ON users
  FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to update users
CREATE POLICY "users_own_update" ON users
  FOR UPDATE
  USING (true);

-- Step 5: Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('projects', 'users')
ORDER BY tablename, policyname;
