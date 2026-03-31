-- Add sender_name to project_updates to identify client/external messages
-- When user_id is NULL, sender_name holds the display name (e.g., client's name)
ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Allow user_id to be NULL (for client/external messages)
ALTER TABLE project_updates
  ALTER COLUMN user_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN project_updates.sender_name IS 'Display name for messages sent by clients or external parties (user_id will be NULL for these)';
