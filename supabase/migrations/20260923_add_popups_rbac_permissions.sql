-- Seed Permissions for In-App Popups & Announcements
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('popups.view', 'popups', 'view', 'View popups and recipient history'),
    ('popups.manage', 'popups', 'manage', 'Create, toggle, and delete in-app popups')
ON CONFLICT (code) DO NOTHING;

-- Grant popups permissions to Admin role if it exists
DO $$
DECLARE
    admin_role_id UUID;
    perm_view_id UUID;
    perm_manage_id UUID;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1;
    SELECT id INTO perm_view_id FROM permissions WHERE code = 'popups.view' LIMIT 1;
    SELECT id INTO perm_manage_id FROM permissions WHERE code = 'popups.manage' LIMIT 1;

    IF admin_role_id IS NOT NULL THEN
        IF perm_view_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm_view_id)
            ON CONFLICT DO NOTHING;
        END IF;

        IF perm_manage_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm_manage_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
