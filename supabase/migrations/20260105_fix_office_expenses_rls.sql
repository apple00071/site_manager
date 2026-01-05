-- Fix RLS policies for office_expenses table
-- Drop all potential policy names to ensure clean state
DROP POLICY IF EXISTS "Admins can manage all office expenses" ON office_expenses;
DROP POLICY IF EXISTS "Users can view their own office expenses" ON office_expenses;
DROP POLICY IF EXISTS "Users can create their own office expenses" ON office_expenses;
DROP POLICY IF EXISTS "Enable select for users or admins" ON office_expenses;
DROP POLICY IF EXISTS "Enable insert for users or admins" ON office_expenses;
DROP POLICY IF EXISTS "Enable update for users or admins" ON office_expenses;
DROP POLICY IF EXISTS "Enable delete for users or admins" ON office_expenses;

-- 1. SELECT: Users can view their own, Admins can view all
CREATE POLICY "Enable select for users or admins" ON office_expenses
  FOR SELECT
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 2. INSERT: Users can create their own (must be pending), Admins can create for anyone
CREATE POLICY "Enable insert for users or admins" ON office_expenses
  FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() AND status = 'pending') OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 3. UPDATE: Users can update their own if pending, Admins can update all
CREATE POLICY "Enable update for users or admins" ON office_expenses
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = 'pending') OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'pending') OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 4. DELETE: Users can delete their own if pending, Admins can delete all
CREATE POLICY "Enable delete for users or admins" ON office_expenses
  FOR DELETE
  USING (
    (user_id = auth.uid() AND status = 'pending') OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
