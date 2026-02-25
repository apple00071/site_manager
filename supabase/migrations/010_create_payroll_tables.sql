-- Final Repair Migration for Payroll module
-- This script ensures employee_salary_profiles exists and RLS policies are correctly applied.

-- 1. Create employee_salary_profiles if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employee_salary_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    hra NUMERIC NOT NULL DEFAULT 0,
    special_allowance NUMERIC NOT NULL DEFAULT 0,
    other_allowances JSONB DEFAULT '{}'::jsonb,
    deductions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ensure RLS is enabled on both tables
ALTER TABLE public.employee_salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;

-- 3. Create or Replace RLS Policies
-- Drop existing policies first to be idempotent
DROP POLICY IF EXISTS "Admins can manage all salary profiles" ON public.employee_salary_profiles;
DROP POLICY IF EXISTS "Admins can manage all payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Employees can view their own salary profile" ON public.employee_salary_profiles;
DROP POLICY IF EXISTS "Employees can view their own payrolls" ON public.payrolls;

-- Admins can do everything
CREATE POLICY "Admins can manage all salary profiles" ON public.employee_salary_profiles
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all payrolls" ON public.payrolls
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Employees can view their own
CREATE POLICY "Employees can view their own salary profile" ON public.employee_salary_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Employees can view their own payrolls" ON public.payrolls
    FOR SELECT USING (user_id = auth.uid());
