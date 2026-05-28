-- Add is_active column to users table
-- Tracks whether a user account is active or soft-deleted/disabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;
