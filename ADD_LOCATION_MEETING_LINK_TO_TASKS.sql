-- Add location and meeting_link columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Update RLS if needed (usually not needed if already enabled for the table)
-- But ensuring they are included in the schema cache
NOTIFY pgrst, 'reload schema';
