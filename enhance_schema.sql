-- Enhance database schema for interior design company
-- Run this in your Supabase SQL Editor

-- Step 1: Add designation to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;

-- Step 2: Add comprehensive project details to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_completion_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS designer_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS designer_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS carpenter_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS carpenter_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS electrician_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS electrician_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plumber_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plumber_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS painter_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS painter_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_budget DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_notes TEXT;

-- Step 3: Update existing projects with default values for new required fields
UPDATE projects 
SET start_date = COALESCE(start_date, created_at)
WHERE start_date IS NULL;

-- Step 4: Add constraints for required fields
ALTER TABLE projects ALTER COLUMN start_date SET NOT NULL;
