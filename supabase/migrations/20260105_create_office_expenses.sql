-- Create office_expenses table
CREATE TABLE IF NOT EXISTS office_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bill_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  admin_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for status
CREATE INDEX IF NOT EXISTS idx_office_expenses_status ON office_expenses(status);
CREATE INDEX IF NOT EXISTS idx_office_expenses_user_id ON office_expenses(user_id);

-- Enable RLS
ALTER TABLE office_expenses ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all office expenses" ON office_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Employees can view their own expenses
CREATE POLICY "Users can view their own office expenses" ON office_expenses
  FOR SELECT
  USING (user_id = auth.uid());

-- Employees can insert their own expenses
CREATE POLICY "Users can create their own office expenses" ON office_expenses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_office_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_office_expenses_updated_at
  BEFORE UPDATE ON office_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_office_expenses_updated_at();

-- Seed Permissions for Office Expenses
INSERT INTO permissions (code, module, action, description) VALUES
  ('office_expenses.view', 'office_expenses', 'view', 'View office expenses'),
  ('office_expenses.create', 'office_expenses', 'create', 'Add office expenses'),
  ('office_expenses.approve', 'office_expenses', 'approve', 'Approve office expenses'),
  ('office_expenses.delete', 'office_expenses', 'delete', 'Delete office expenses')
ON CONFLICT (code) DO NOTHING;

-- Grant all office_expenses permissions to Admin role if it exists
DO $$
DECLARE
  admin_role_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  IF admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions WHERE code LIKE 'office_expenses.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;
