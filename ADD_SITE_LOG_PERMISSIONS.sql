-- Upsert new permissions for Site Logs to ensure they are added or updated
INSERT INTO permissions (code, module, action, description)
VALUES 
  ('site_logs.view', 'site_logs', 'view', 'View daily site logs'),
  ('site_logs.create', 'site_logs', 'create', 'Create daily site logs'),
  ('site_logs.edit', 'site_logs', 'edit', 'Edit daily site logs'),
  ('site_logs.delete', 'site_logs', 'delete', 'Delete daily site logs')
ON CONFLICT (code) 
DO UPDATE SET 
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

-- Grant all site_logs permissions to the 'Admin' role
DO $$
DECLARE
  admin_role_id uuid;
  perm_id uuid;
BEGIN
  -- Find Admin role
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin';

  IF admin_role_id IS NOT NULL THEN
    -- Loop through site_logs permissions and assign to Admin
    FOR perm_id IN 
      SELECT id FROM permissions WHERE module = 'site_logs'
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (admin_role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Verify insertion
SELECT * FROM permissions WHERE module = 'site_logs';
