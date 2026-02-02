-- Clean up existing tables if any
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.leaves CASCADE;

-- 1. Create ATTENDANCE table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable RLS for Attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can punch in" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can punch out" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins have full access to attendance" ON public.attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- 2. Create LEAVES table
CREATE TABLE public.leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Enable RLS for Leaves
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leaves" ON public.leaves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can apply for leaves" ON public.leaves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit pending leaves" ON public.leaves FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins have full access to leaves" ON public.leaves FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- 3. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. RBAC Permissions (Add these to your permissions table if it exists)
-- This ensures that the verifyPermission checks in the API don't fail with 403
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
        INSERT INTO public.permissions (code, module, action, description)
        VALUES 
            ('attendance.view', 'attendance', 'view', 'Allows viewing attendance logs'),
            ('attendance.log', 'attendance', 'log', 'Allows punch in/out'),
            ('leaves.view', 'leaves', 'view', 'Allows viewing leave requests'),
            ('leaves.apply', 'leaves', 'apply', 'Allows applying for leaves'),
            ('leaves.approve', 'leaves', 'approve', 'Allows approving/rejecting leaves')
        ON CONFLICT (code) DO NOTHING;
        
        -- Automatically grant these to the 'Employee' role if role_permissions table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
            DECLARE
                emp_role_id UUID;
            BEGIN
                -- Using ILIKE to be case-insensitive for 'Employee'
                SELECT id INTO emp_role_id FROM public.roles WHERE name ILIKE 'employee' LIMIT 1;
                
                IF emp_role_id IS NOT NULL THEN
                    INSERT INTO public.role_permissions (role_id, permission_id)
                    SELECT emp_role_id, id FROM public.permissions 
                    WHERE code IN ('attendance.view', 'attendance.log', 'leaves.view', 'leaves.apply')
                    ON CONFLICT DO NOTHING;
                END IF;
            END;
        END IF;
    END IF;
END $$;

-- Comments
COMMENT ON TABLE public.attendance IS 'Daily attendance logs for employees.';
COMMENT ON TABLE public.leaves IS 'Leave requests and tracking.';
