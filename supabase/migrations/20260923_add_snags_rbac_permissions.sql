-- Migration: Seed and update Snags RBAC Permissions
-- Description: Ensures all snag permissions exist with clear descriptions and Admin has full access

-- 1. Insert or update snag permissions
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('snags.view', 'snags', 'view', 'View assigned snags'),
    ('snags.view_all', 'snags', 'view_all', 'View all snags across sites (not just assigned)'),
    ('snags.create', 'snags', 'create', 'Create snags'),
    ('snags.update', 'snags', 'update', 'Update snag details'),
    ('snags.edit', 'snags', 'edit', 'Edit snags'),
    ('snags.resolve', 'snags', 'resolve', 'Resolve snags'),
    ('snags.verify', 'snags', 'verify', 'Verify resolved snags')
ON CONFLICT (code) DO UPDATE 
SET description = EXCLUDED.description;

-- 2. Grant all snag permissions to the Admin role
DO $$
DECLARE
    admin_role_id UUID;
    p_record RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1;

    IF admin_role_id IS NOT NULL THEN
        FOR p_record IN SELECT id FROM permissions WHERE code LIKE 'snags.%' LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, p_record.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
