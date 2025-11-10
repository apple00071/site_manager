-- ============================================
-- Project Workflow Update Migration
-- ============================================
-- This migration updates the project workflow to support:
-- 1. Admin assigns project to Designer with requirements PDF
-- 2. Designer uploads design files
-- 3. Admin reviews and approves/rejects design
-- 4. Admin assigns approved project to Site Supervisor

-- Step 1: Add new columns to projects table
-- ============================================

-- Add workflow-related columns
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'requirements_upload',
ADD COLUMN IF NOT EXISTS requirements_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS requirements_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS designer_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS site_supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS site_supervisor_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS design_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS design_approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN projects.workflow_stage IS 'Current workflow stage: requirements_upload, design_pending, design_review, design_approved, design_rejected, in_progress, completed';
COMMENT ON COLUMN projects.requirements_pdf_url IS 'URL to requirements PDF file uploaded by admin';
COMMENT ON COLUMN projects.designer_id IS 'Designer assigned to create designs for this project';
COMMENT ON COLUMN projects.site_supervisor_id IS 'Site supervisor assigned after design approval';

-- Step 2: Update design_files table for approval workflow
-- ============================================

-- Add rejection reason and resubmission tracking
ALTER TABLE design_files
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS resubmitted_from UUID REFERENCES design_files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_resubmission BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN design_files.rejection_reason IS 'Reason for rejection if approval_status is rejected';
COMMENT ON COLUMN design_files.resubmitted_from IS 'Reference to previous design file if this is a resubmission';
COMMENT ON COLUMN design_files.is_resubmission IS 'True if this design was uploaded after a rejection';

-- Step 3: Update inventory_items table
-- ============================================

-- Make fields optional and add approval workflow
ALTER TABLE inventory_items
ALTER COLUMN unit DROP NOT NULL,
ALTER COLUMN price_per_unit DROP NOT NULL,
ADD COLUMN IF NOT EXISTS bill_approval_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS bill_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bill_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bill_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS bill_resubmitted_from UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_bill_resubmission BOOLEAN DEFAULT FALSE;

-- Drop the generated column first (can't alter generated columns directly)
ALTER TABLE inventory_items DROP COLUMN IF EXISTS total_cost;

-- Recreate total_cost as a regular nullable column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 2);

COMMENT ON COLUMN inventory_items.bill_approval_status IS 'Approval status: pending, approved, rejected';
COMMENT ON COLUMN inventory_items.bill_rejection_reason IS 'Reason for bill rejection';
COMMENT ON COLUMN inventory_items.is_bill_resubmission IS 'True if bill was re-uploaded after rejection';

-- Step 4: Create workflow_history table for audit trail
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_reason TEXT,
  metadata JSONB, -- Store additional context like rejection reasons, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_project_id ON workflow_history(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_created_at ON workflow_history(created_at DESC);

COMMENT ON TABLE workflow_history IS 'Audit trail for project workflow stage changes';

-- Enable RLS
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_history
CREATE POLICY "Admins can view all workflow history"
  ON workflow_history
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Employees can view workflow history for their projects"
  ON workflow_history
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = workflow_history.project_id 
    AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert workflow history"
  ON workflow_history
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Step 5: Create function to automatically log workflow changes
-- ============================================

CREATE OR REPLACE FUNCTION log_workflow_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if workflow_stage actually changed
  IF (TG_OP = 'UPDATE' AND OLD.workflow_stage IS DISTINCT FROM NEW.workflow_stage) THEN
    INSERT INTO workflow_history (project_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.workflow_stage, NEW.workflow_stage, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_log_workflow_change ON projects;
CREATE TRIGGER trigger_log_workflow_change
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_workflow_change();

-- Step 6: Create helper function to update workflow stage
-- ============================================

CREATE OR REPLACE FUNCTION update_project_workflow_stage(
  p_project_id UUID,
  p_new_stage VARCHAR(50),
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_old_stage VARCHAR(50);
BEGIN
  -- Get current stage
  SELECT workflow_stage INTO v_old_stage
  FROM projects
  WHERE id = p_project_id;
  
  -- Update the stage
  UPDATE projects
  SET workflow_stage = p_new_stage,
      updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the change with reason
  INSERT INTO workflow_history (project_id, from_stage, to_stage, changed_by, change_reason)
  VALUES (p_project_id, v_old_stage, p_new_stage, auth.uid(), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_project_workflow_stage IS 'Helper function to update project workflow stage with automatic logging';

-- Step 7: Update existing projects to new workflow
-- ============================================

-- Set workflow stage based on current status
UPDATE projects
SET workflow_stage = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'in_progress' THEN 'in_progress'
  ELSE 'requirements_upload'
END
WHERE workflow_stage IS NULL;

-- Step 8: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_workflow_stage ON projects(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_projects_designer_id ON projects(designer_id);
CREATE INDEX IF NOT EXISTS idx_projects_site_supervisor_id ON projects(site_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_design_files_approval_status ON design_files(approval_status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_bill_approval_status ON inventory_items(bill_approval_status);

-- Step 9: Add constraints
-- ============================================

-- Ensure workflow_stage has valid values
ALTER TABLE projects
ADD CONSTRAINT check_workflow_stage 
CHECK (workflow_stage IN (
  'requirements_upload',
  'design_pending',
  'design_review',
  'design_approved',
  'design_rejected',
  'in_progress',
  'completed',
  'cancelled'
));

-- Ensure bill_approval_status has valid values
ALTER TABLE inventory_items
ADD CONSTRAINT check_bill_approval_status
CHECK (bill_approval_status IN ('pending', 'approved', 'rejected'));

-- Ensure design approval_status has valid values (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_design_approval_status'
  ) THEN
    ALTER TABLE design_files
    ADD CONSTRAINT check_design_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_changes'));
  END IF;
END $$;

-- Step 10: Grant necessary permissions
-- ============================================

-- Ensure service role can access all tables
GRANT ALL ON workflow_history TO service_role;
GRANT EXECUTE ON FUNCTION log_workflow_change() TO service_role;
GRANT EXECUTE ON FUNCTION update_project_workflow_stage(UUID, VARCHAR, TEXT) TO service_role;

-- ============================================
-- Migration Complete
-- ============================================

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Project workflow migration completed successfully!';
  RAISE NOTICE 'New workflow stages: requirements_upload → design_pending → design_review → design_approved → in_progress → completed';
  RAISE NOTICE 'Inventory items now support bill approval workflow';
  RAISE NOTICE 'Design files support rejection and resubmission';
END $$;

