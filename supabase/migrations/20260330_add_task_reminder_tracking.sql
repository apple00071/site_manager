-- Add reminder_sent_at column to tasks table to track 1-hour before notifications
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Create an index for performance when querying for upcoming reminders
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_tracking 
ON tasks (start_at, reminder_sent_at) 
WHERE status != 'done';
