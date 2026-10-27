-- Seed Permission for Marketing & Sales Lead Creation
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('leads.create', 'crm', 'create_lead', 'Create and submit new marketing/sales leads')
ON CONFLICT (code) DO NOTHING;

-- Grant leads.create permission to Admin role if it exists
DO $$
DECLARE
    admin_role_id UUID;
    perm_create_id UUID;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1;
    SELECT id INTO perm_create_id FROM permissions WHERE code = 'leads.create' LIMIT 1;

    IF admin_role_id IS NOT NULL AND perm_create_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_create_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
