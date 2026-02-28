-- ============================================
-- Fix Workflow History Logging
-- ============================================
-- 1. Allow changed_by to be NULL for system/auto updates
ALTER TABLE workflow_history ALTER COLUMN changed_by DROP NOT NULL;

-- 2. Update the trigger function to log even if auth.uid() is null
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
