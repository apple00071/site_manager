-- Migration: Cron Reliability & Holidays
-- Description: Adds tables for cron execution tracking and holiday management.

-- Table for tracking cron job execution to prevent duplicates
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
    job_name TEXT PRIMARY KEY,
    last_run_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'success'::text,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table for managing holiday dates (festivals, etc.) where notifications should be silenced
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add reminded_at to tasks to prevent duplicate proximity alerts
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'reminded_at') THEN
        ALTER TABLE public.tasks ADD COLUMN reminded_at TIMESTAMPTZ;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Select policy for everyone (Holidays)
DROP POLICY IF EXISTS "Everyone can view holidays" ON public.holidays;
CREATE POLICY "Everyone can view holidays" ON public.holidays
    FOR SELECT USING (true);

-- Admin management policy (Holidays)
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "Admins can manage holidays" ON public.holidays
    FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Admin management policy (Cron Logs)
DROP POLICY IF EXISTS "Admins can manage cron logs" ON public.cron_job_logs;
CREATE POLICY "Admins can manage cron logs" ON public.cron_job_logs
    FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
