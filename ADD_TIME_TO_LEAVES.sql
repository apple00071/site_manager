-- Add start_time and end_time to leaves table for short period permissions
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Add a comment to explain the columns
COMMENT ON COLUMN public.leaves.start_time IS 'Start time for short period permissions.';
COMMENT ON COLUMN public.leaves.end_time IS 'End time for short period permissions.';
