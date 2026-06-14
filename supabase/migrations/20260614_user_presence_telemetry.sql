-- Migration: User Presence Telemetry
-- Description: Adds a user_activities table for tracking user activity and heartbeats.

CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'page_view', -- 'page_view', 'heartbeat'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow admins to view all activities
DROP POLICY IF EXISTS "Admins can view all user activities" ON public.user_activities;
CREATE POLICY "Admins can view all user activities" ON public.user_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Insert policy: Allow users to insert their own activities
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.user_activities;
CREATE POLICY "Users can insert their own activities" ON public.user_activities
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_activities_created_at_idx ON public.user_activities (created_at DESC);
CREATE INDEX IF NOT EXISTS user_activities_user_id_idx ON public.user_activities (user_id);


-- Function to get heavy users in a given time period (in days)
CREATE OR REPLACE FUNCTION public.get_heavy_users(days_limit int)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    designation TEXT,
    activity_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ua.user_id,
        u.full_name,
        u.email,
        u.role::text,
        u.designation,
        COUNT(ua.id) as activity_count
    FROM public.user_activities ua
    JOIN public.users u ON ua.user_id = u.id
    WHERE ua.created_at >= NOW() - (days_limit || ' days')::INTERVAL
    GROUP BY ua.user_id, u.full_name, u.email, u.role, u.designation
    ORDER BY activity_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
