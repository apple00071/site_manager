-- Add budget and unified status columns to projects table
-- Run this in Supabase SQL Editor

-- Add budget column (admin-only visibility)
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS budget DECIMAL(12, 2);

-- Add unified status column (merges workflow_stage + status)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS unified_status VARCHAR(50) DEFAULT 'requirements_upload';

-- Set default unified status based on existing workflow_stage and status
-- This maps the current two-status system to a single unified status
UPDATE projects
SET unified_status = CASE
  WHEN workflow_stage = 'design_pending' OR workflow_stage IS NULL THEN 'requirements_upload'
  WHEN workflow_stage = 'design_in_progress' THEN 'design_in_progress'
  WHEN workflow_stage = 'design_completed' AND (status = 'pending' OR status IS NULL) THEN 'design_completed'
  WHEN status = 'in_progress' THEN 'execution_in_progress'
  WHEN status = 'completed' THEN 'completed'
  ELSE 'requirements_upload'
END
WHERE unified_status IS NULL OR unified_status = 'requirements_upload';

-- Create index for fast status filtering (important for tab performance)
CREATE INDEX IF NOT EXISTS idx_projects_unified_status ON projects(unified_status);

-- Add comment for documentation
COMMENT ON COLUMN projects.budget IS 'Project budget in INR - visible only to admin users';
COMMENT ON COLUMN projects.unified_status IS 'Unified project status combining workflow_stage and site status';

-- Optional: Create a function to auto-update unified_status when workflow_stage or status changes
-- This ensures consistency when other parts of the app update the old fields
CREATE OR REPLACE FUNCTION update_unified_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.unified_status := CASE
    WHEN NEW.workflow_stage = 'design_pending' OR NEW.workflow_stage IS NULL THEN 'requirements_upload'
    WHEN NEW.workflow_stage = 'design_in_progress' THEN 'design_in_progress'
    WHEN NEW.workflow_stage = 'design_completed' AND (NEW.status = 'pending' OR NEW.status IS NULL) THEN 'design_completed'
    WHEN NEW.status = 'in_progress' THEN 'execution_in_progress'  
    WHEN NEW.status = 'completed' THEN 'completed'
    ELSE 'requirements_upload'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update unified_status
DROP TRIGGER IF EXISTS trigger_update_unified_status ON projects;
CREATE TRIGGER trigger_update_unified_status
  BEFORE INSERT OR UPDATE OF workflow_stage, status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_status();

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Projects table enhanced successfully!';
  RAISE NOTICE 'Added columns: budget, unified_status';
  RAISE NOTICE 'Created index: idx_projects_unified_status';
  RAISE NOTICE 'Created trigger: trigger_update_unified_status';
END $$;
