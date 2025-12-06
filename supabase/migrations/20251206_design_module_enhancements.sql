-- Design Module Enhancements Migration
-- P0: Freeze support, version stacking, pin-drop comments
-- Safe, non-destructive additions to existing tables

BEGIN;

-- =============================================
-- 1. FREEZE SUPPORT FOR design_files
-- =============================================
-- Add is_frozen to prevent modifications to finalized designs
ALTER TABLE design_files 
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE design_files 
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

ALTER TABLE design_files 
  ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering frozen designs
CREATE INDEX IF NOT EXISTS idx_design_files_is_frozen 
  ON design_files(is_frozen) WHERE is_frozen = TRUE;

-- =============================================
-- 2. VERSION STACKING SUPPORT
-- =============================================
-- Add parent_design_id for linking version chains
ALTER TABLE design_files 
  ADD COLUMN IF NOT EXISTS parent_design_id UUID REFERENCES design_files(id) ON DELETE SET NULL;

-- Index for fetching version history
CREATE INDEX IF NOT EXISTS idx_design_files_parent 
  ON design_files(parent_design_id);

-- Index for fetching latest version of a file by name
CREATE INDEX IF NOT EXISTS idx_design_files_project_filename 
  ON design_files(project_id, file_name);

-- =============================================
-- 3. PIN-DROP COMMENTS WITH COORDINATES
-- =============================================
-- Add coordinate fields for spatial comments
ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS x_percent DECIMAL(5,2);

ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS y_percent DECIMAL(5,2);

ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS zoom_level DECIMAL(5,2);

-- Add mentions support
ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[];

-- Add resolution tracking
ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add task linkage
ALTER TABLE design_comments 
  ADD COLUMN IF NOT EXISTS linked_task_id UUID;

-- Note: We don't add FK to tasks table here in case it has different constraints
-- The application layer will ensure referential integrity

-- Index for finding comments with linked tasks
CREATE INDEX IF NOT EXISTS idx_design_comments_linked_task 
  ON design_comments(linked_task_id) WHERE linked_task_id IS NOT NULL;

-- Index for finding unresolved comments
CREATE INDEX IF NOT EXISTS idx_design_comments_unresolved 
  ON design_comments(design_file_id, is_resolved) WHERE is_resolved = FALSE;

COMMIT;

-- =============================================
-- ROLLBACK SCRIPT (for documentation)
-- =============================================
-- To rollback, run:
-- ALTER TABLE design_files DROP COLUMN IF EXISTS is_frozen;
-- ALTER TABLE design_files DROP COLUMN IF EXISTS frozen_at;
-- ALTER TABLE design_files DROP COLUMN IF EXISTS frozen_by;
-- ALTER TABLE design_files DROP COLUMN IF EXISTS parent_design_id;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS x_percent;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS y_percent;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS zoom_level;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS mentioned_user_ids;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS is_resolved;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS resolved_at;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS resolved_by;
-- ALTER TABLE design_comments DROP COLUMN IF EXISTS linked_task_id;
