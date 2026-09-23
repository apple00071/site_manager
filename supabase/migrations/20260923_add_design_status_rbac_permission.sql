-- Seed Permission for Daily Design Status Tracker
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('designs.daily_status', 'designs', 'daily_status', 'View & update daily design status tracker')
ON CONFLICT (code) DO NOTHING;

-- Grant designs.daily_status permission to Admin role if it exists
DO $$
DECLARE
    admin_role_id UUID;
    perm_id UUID;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1;
    SELECT id INTO perm_id FROM permissions WHERE code = 'designs.daily_status' LIMIT 1;

    IF admin_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
