-- Migration: 20261027_add_branch_architecture.sql
-- Multi-Branch support for Kukatpally and AS Rao Nagar branches

-- 1. Users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_users_branch ON public.users(branch);

-- 2. Projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_projects_branch ON public.projects(branch);

-- 3. Quotation Leads (CRM) table
ALTER TABLE public.quotation_leads 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_quotation_leads_branch ON public.quotation_leads(branch);

-- 4. Attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance(branch);

-- 5. Office Expenses table
ALTER TABLE public.office_expenses 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_office_expenses_branch ON public.office_expenses(branch);

-- 6. Snags table
ALTER TABLE public.snags 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_snags_branch ON public.snags(branch);

-- 7. Tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';
CREATE INDEX IF NOT EXISTS idx_tasks_branch ON public.tasks(branch);

-- Default all existing records to Kukatpally
UPDATE public.users SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.projects SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.quotation_leads SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.attendance SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.office_expenses SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.snags SET branch = 'Kukatpally' WHERE branch IS NULL;
UPDATE public.tasks SET branch = 'Kukatpally' WHERE branch IS NULL;
