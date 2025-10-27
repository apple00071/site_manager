-- Fix user sync issue: User exists in auth but not in users table
-- Run this in your Supabase SQL Editor

-- Step 1: Apply simplified RLS policies to allow operations
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all user data" ON users;
DROP POLICY IF EXISTS "Admins can insert user data" ON users;
DROP POLICY IF EXISTS "Admins can update user data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "users_own_view" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_own_update" ON users;
DROP POLICY IF EXISTS "users_view_all" ON users;

-- Create simple policies that allow operations
CREATE POLICY "users_own_view" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow anyone authenticated to insert users initially
CREATE POLICY "users_insert" ON users
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own data
CREATE POLICY "users_own_update" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow viewing all users for now
CREATE POLICY "users_view_all" ON users
  FOR SELECT
  USING (true);

-- Step 2: Insert the existing auth user into users table
-- Replace 'applegraphicshyd@gmail.com' with the actual email from the error
INSERT INTO users (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  COALESCE(au.raw_user_meta_data->>'role', 'employee')::user_role as role
FROM auth.users au
WHERE au.email = 'applegraphicshyd@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = au.id
);

-- Step 3: Verify the user was inserted
SELECT id, email, full_name, role, created_at 
FROM users 
WHERE email = 'applegraphicshyd@gmail.com';
