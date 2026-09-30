-- ============================================
-- Enable Row Level Security (RLS) on boq_bills
-- Fixes Supabase Security Warning: Table publicly accessible (rls_disabled_in_public)
-- ============================================

-- 1. Enable RLS on boq_bills
ALTER TABLE public.boq_bills ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies on boq_bills if any to avoid duplicates
DROP POLICY IF EXISTS "Authenticated users can view boq_bills" ON public.boq_bills;
DROP POLICY IF EXISTS "Admins and project members can manage boq_bills" ON public.boq_bills;

-- 3. Policy: Authenticated users can view boq_bills if admin or assigned to the project
CREATE POLICY "Authenticated users can view boq_bills" ON public.boq_bills
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_id = boq_bills.project_id
            AND user_id = auth.uid()
        )
    );

-- 4. Policy: Admins and assigned project members can insert/update/delete boq_bills
CREATE POLICY "Admins and project members can manage boq_bills" ON public.boq_bills
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_id = boq_bills.project_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_id = boq_bills.project_id
            AND user_id = auth.uid()
        )
    );
