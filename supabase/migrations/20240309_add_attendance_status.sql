-- Add status column for attendance approval
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('approved', 'pending', 'rejected');
    END IF;
END $$;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status attendance_status DEFAULT 'approved';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS admin_comments TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
