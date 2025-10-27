-- Migration to update projects table
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the foreign key constraint if it exists
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;

-- Step 2: Drop the column
ALTER TABLE projects DROP COLUMN IF EXISTS client_id;

-- Step 3: Add required fields for project management
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS alt_phone_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Step 4: Add role column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'employee';

-- Verify changes
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name IN ('client_id', 'customer_name', 'assigned_employee_id');

-- Expected: client_id should not appear, but customer_name and assigned_employee_id should

