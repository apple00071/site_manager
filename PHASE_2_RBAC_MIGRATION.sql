-- Phase 2: Roles & Permissions Migration
-- Creates roles, permissions, and role_permissions tables
-- Adds role_id to users table
-- Seeds default permissions and roles

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(org_id, name)
);

-- 2. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(role_id, permission_id)
);

-- 4. Add role_id to users table (nullable for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- 5. Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON role_permissions FOR SELECT TO authenticated USING (true);

-- 6. Seed Permissions
DO $$
BEGIN
    -- Projects
    INSERT INTO permissions (code, module, action, description) VALUES
        ('projects.view', 'projects', 'view', 'View projects'),
        ('projects.create', 'projects', 'create', 'Create new projects'),
        ('projects.edit', 'projects', 'edit', 'Edit project details'),
        ('projects.delete', 'projects', 'delete', 'Delete projects'),
        ('projects.assign', 'projects', 'assign', 'Assign projects to users')
    ON CONFLICT (code) DO NOTHING;

    -- BOQ
    INSERT INTO permissions (code, module, action, description) VALUES
        ('boq.view', 'boq', 'view', 'View BOQ items'),
        ('boq.create', 'boq', 'create', 'Create BOQ items'),
        ('boq.edit', 'boq', 'edit', 'Edit BOQ items'),
        ('boq.delete', 'boq', 'delete', 'Delete BOQ items'),
        ('boq.import', 'boq', 'import', 'Import BOQ from Excel')
    ON CONFLICT (code) DO NOTHING;

    -- Procurement
    INSERT INTO permissions (code, module, action, description) VALUES
        ('procurement.view', 'procurement', 'view', 'View procurement data'),
        ('procurement.create_po', 'procurement', 'create_po', 'Create purchase orders'),
        ('procurement.approve_po', 'procurement', 'approve_po', 'Approve purchase orders'),
        ('procurement.create_invoice', 'procurement', 'create_invoice', 'Create invoices'),
        ('procurement.approve_invoice', 'procurement', 'approve_invoice', 'Approve invoices'),
        ('procurement.create_payment', 'procurement', 'create_payment', 'Record payments')
    ON CONFLICT (code) DO NOTHING;

    -- Inventory
    INSERT INTO permissions (code, module, action, description) VALUES
        ('inventory.view', 'inventory', 'view', 'View inventory'),
        ('inventory.add', 'inventory', 'add', 'Add inventory items'),
        ('inventory.remove', 'inventory', 'remove', 'Remove inventory items')
    ON CONFLICT (code) DO NOTHING;

    -- Designs
    INSERT INTO permissions (code, module, action, description) VALUES
        ('designs.view', 'designs', 'view', 'View design files'),
        ('designs.upload', 'designs', 'upload', 'Upload design files'),
        ('designs.delete', 'designs', 'delete', 'Delete design files')
    ON CONFLICT (code) DO NOTHING;

    -- Snags
    INSERT INTO permissions (code, module, action, description) VALUES
        ('snags.view', 'snags', 'view', 'View snags'),
        ('snags.create', 'snags', 'create', 'Create snags'),
        ('snags.resolve', 'snags', 'resolve', 'Resolve snags'),
        ('snags.verify', 'snags', 'verify', 'Verify resolved snags')
    ON CONFLICT (code) DO NOTHING;

    -- Users
    INSERT INTO permissions (code, module, action, description) VALUES
        ('users.view', 'users', 'view', 'View users'),
        ('users.create', 'users', 'create', 'Create new users'),
        ('users.edit', 'users', 'edit', 'Edit user details'),
        ('users.delete', 'users', 'delete', 'Delete users')
    ON CONFLICT (code) DO NOTHING;

    -- Settings
    INSERT INTO permissions (code, module, action, description) VALUES
        ('settings.view', 'settings', 'view', 'View organization settings'),
        ('settings.edit', 'settings', 'edit', 'Edit organization settings')
    ON CONFLICT (code) DO NOTHING;

    RAISE NOTICE 'Permissions seeded successfully';
END $$;

-- 7. Seed Default Roles
DO $$
DECLARE
    default_org_id UUID;
    admin_role_id UUID;
    employee_role_id UUID;
BEGIN
    -- Get the default org
    SELECT id INTO default_org_id FROM organizations WHERE slug = 'apple-interior' LIMIT 1;
    
    IF default_org_id IS NULL THEN
        RAISE NOTICE 'Default organization not found. Skipping role seeding.';
        RETURN;
    END IF;

    -- Create Admin role
    INSERT INTO roles (org_id, name, description, is_system)
    VALUES (default_org_id, 'Admin', 'Full system access', true)
    ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO admin_role_id;

    -- Create Employee role
    INSERT INTO roles (org_id, name, description, is_system)
    VALUES (default_org_id, 'Employee', 'Standard employee access', true)
    ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO employee_role_id;

    -- Grant ALL permissions to Admin
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Grant subset of permissions to Employee
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT employee_role_id, id FROM permissions
    WHERE code IN (
        'projects.view', 'projects.create', 'projects.edit',
        'boq.view', 'boq.edit',
        'procurement.view', 'procurement.create_po', 'procurement.create_invoice',
        'inventory.view', 'inventory.add',
        'designs.view', 'designs.upload',
        'snags.view', 'snags.create', 'snags.resolve',
        'users.view'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Migrate existing users to have role_id
    UPDATE users SET role_id = admin_role_id WHERE role = 'admin' AND role_id IS NULL;
    UPDATE users SET role_id = employee_role_id WHERE role = 'employee' AND role_id IS NULL;

    RAISE NOTICE 'Roles seeded and users migrated successfully';
END $$;
