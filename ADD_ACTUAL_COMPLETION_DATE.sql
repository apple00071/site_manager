-- Add actual_completion_date column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_completion_date TIMESTAMPTZ;

-- Allow it to be nullable (optional)
ALTER TABLE projects ALTER COLUMN actual_completion_date DROP NOT NULL;

-- Comment
COMMENT ON COLUMN projects.actual_completion_date IS 'The actual date when the project was completed';
