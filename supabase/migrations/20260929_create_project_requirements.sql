-- ============================================
-- Migration: Project Requirements from CRM Quotation & Site Verification
-- Created: 2026-09-29
-- ============================================

-- 1. Create project_requirements (Checklist & Specifications)
CREATE TABLE IF NOT EXISTS public.project_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    room_section VARCHAR(100) NOT NULL DEFAULT 'General',
    item_name TEXT NOT NULL,
    dimensions TEXT,
    designer_specs TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'issue'
    supervisor_notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    quotation_item_id UUID,
    order_index INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist if table was already partially created
DO $$ 
BEGIN
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS room_section VARCHAR(100) DEFAULT 'General';
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS item_name TEXT;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS dimensions TEXT;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS designer_specs TEXT;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS supervisor_notes TEXT;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS quotation_item_id UUID;
    ALTER TABLE public.project_requirements ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
    -- Drop NOT NULL on legacy title column if present
    ALTER TABLE public.project_requirements ALTER COLUMN title DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_requirements_project ON public.project_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_requirements_room ON public.project_requirements(project_id, room_section);
CREATE INDEX IF NOT EXISTS idx_project_requirements_status ON public.project_requirements(project_id, status);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project_requirements" ON public.project_requirements;
CREATE POLICY "Authenticated users can view project_requirements" ON public.project_requirements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project_requirements" ON public.project_requirements;
CREATE POLICY "Authenticated users can manage project_requirements" ON public.project_requirements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Seed RBAC permissions
INSERT INTO public.permissions (code, module, action, description)
VALUES 
    ('requirements.view', 'requirements', 'view', 'View project requirements checklist and notes'),
    ('requirements.edit', 'requirements', 'edit', 'Update designer specs and verify on site'),
    ('requirements.delete', 'requirements', 'delete', 'Delete project requirements items')
ON CONFLICT (code) DO NOTHING;

-- Grant to admin
DO $$
DECLARE
    admin_role_id UUID;
    perm_record RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE LOWER(name) = 'admin' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
        FOR perm_record IN SELECT id FROM public.permissions WHERE code IN ('requirements.view', 'requirements.edit', 'requirements.delete') LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm_record.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
