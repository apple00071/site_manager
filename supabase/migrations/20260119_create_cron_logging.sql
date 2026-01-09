-- Migration for Cron Stabilization and Notification State Tracking

-- 1. Create cron_job_logs table to track once-per-day job executions
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
    job_name TEXT PRIMARY KEY,
    last_run_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'success'
);

-- Enable RLS for cron_job_logs
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access these logs (internal use only)
CREATE POLICY "Service role can do everything on cron_job_logs" ON public.cron_job_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Add reminded_at to tasks table to track reminder state
-- Note: Checking if column exists first to avoid errors (Supabase Migrations are better this way)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'reminded_at') THEN
        ALTER TABLE public.tasks ADD COLUMN reminded_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN public.tasks.reminded_at IS 'Tracks the last time a "Starting Soon" reminder was sent for this task to prevent duplicates.';
