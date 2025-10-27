-- Fix RLS policies to allow admin user creation
-- Run this in your Supabase SQL Editor

-- Drop existing policies that cause circular dependency
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all user data" ON users;
DROP POLICY IF EXISTS "Admins can insert user data" ON users;
DROP POLICY IF EXISTS "Admins can update user data" ON users;

-- Create new policies that check admin role from auth metadata instead of database
CREATE POLICY "Users can view their own data" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all user data" 
  ON users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_user_meta_data->>'role' = 'admin'
        OR auth.users.raw_app_meta_data->>'role' = 'admin'
      )
    )
  );

CREATE POLICY "Admins can insert user data" 
  ON users FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_user_meta_data->>'role' = 'admin'
        OR auth.users.raw_app_meta_data->>'role' = 'admin'
      )
    )
  );

CREATE POLICY "Admins can update user data" 
  ON users FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_user_meta_data->>'role' = 'admin'
        OR auth.users.raw_app_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow users to update their own data
CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

