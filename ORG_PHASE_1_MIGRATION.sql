-- Org Section Phase 1 Migration
-- Creates organizations, org_settings, and approval_workflows tables
-- Seeds default organization

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create org_settings table
CREATE TABLE IF NOT EXISTS org_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    config JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('purchase_order', 'payment')),
    min_amount NUMERIC DEFAULT 0 NOT NULL,
    max_amount NUMERIC, -- NULL means infinity
    approver_role TEXT NOT NULL,
    sequence_order INTEGER DEFAULT 1 NOT NULL,
    is_mandatory BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS (Row Level Security) - Basic Policy for now
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view organization data (adjust strictness later)
CREATE POLICY "Allow read access for authenticated users" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON approval_workflows FOR SELECT TO authenticated USING (true);

-- Allow admins to edit settings (assuming admin role check exists in app, enforcing here generically)
-- Note: Real enforcement will happen via Service Role in API for now to avoid RLS complexity in Phase 1 setup

-- 5. Seed Data
DO $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Check if org exists
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'apple-interior') THEN
        -- Create Default Org
        INSERT INTO organizations (name, slug)
        VALUES ('Apple Interior', 'apple-interior')
        RETURNING id INTO new_org_id;

        -- Create Default Settings
        INSERT INTO org_settings (org_id, config)
        VALUES (
            new_org_id,
            '{
                "enabled_modules": ["boq", "procurement", "snag", "projects", "users"],
                "budget_enforcement": "warn", 
                "approval_strictness": "relaxed",
                "default_project_buckets": ["requirements_upload", "design_in_progress", "design_completed", "execution_in_progress", "completed"]
            }'::jsonb
        );

        -- Create Default Workflow (Admin approve > 50k)
        INSERT INTO approval_workflows (org_id, entity_type, min_amount, approver_role, sequence_order)
        VALUES (new_org_id, 'purchase_order', 50000, 'admin', 1);
        
        RAISE NOTICE 'Organization seeded successfully with ID: %', new_org_id;
    ELSE
        RAISE NOTICE 'Organization already exists';
    END IF;
END $$;
