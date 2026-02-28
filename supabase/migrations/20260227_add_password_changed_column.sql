-- Add password_changed column to users table
-- Tracks whether a user has changed their default temporary password

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_changed'
  ) THEN
    ALTER TABLE public.users ADD COLUMN password_changed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Mark the admin user as already having changed their password
UPDATE public.users SET password_changed = true WHERE role = 'admin';
