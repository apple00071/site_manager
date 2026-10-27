-- Seed Permissions for Performance Reports
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('reports.view', 'reports', 'view', 'View performance reports'),
    ('reports.export', 'reports', 'export', 'Download & export performance reports')
ON CONFLICT (code) DO NOTHING;

-- Grant reports permissions to Admin role if it exists
DO $$
DECLARE
    admin_role_id UUID;
    perm_view_id UUID;
    perm_export_id UUID;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1;
    SELECT id INTO perm_view_id FROM permissions WHERE code = 'reports.view' LIMIT 1;
    SELECT id INTO perm_export_id FROM permissions WHERE code = 'reports.export' LIMIT 1;

    IF admin_role_id IS NOT NULL THEN
        IF perm_view_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm_view_id)
            ON CONFLICT DO NOTHING;
        END IF;

        IF perm_export_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm_export_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
