-- Add user_comments for appeals
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_comments TEXT;
