-- ============================================
-- Vendor & Contract Worker Registration Module
-- Migration: 20260823000000_vendor_contract_workers.sql
-- ============================================

-- 1. Enhance suppliers table with trade_category and vendor_type if not present
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(100) DEFAULT 'subcontractor',
ADD COLUMN IF NOT EXISTS trade_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.0;

-- 2. Create contract_workers table
CREATE TABLE IF NOT EXISTS contract_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  secondary_phone VARCHAR(20),
  trade VARCHAR(100) NOT NULL, -- e.g., Carpentry, Electrical, Plumbing, Painting, Civil, Tile & Marble, False Ceiling, HVAC, Fabricator, General Labor
  skill_level VARCHAR(50) DEFAULT 'Skilled', -- Helper, Semi-Skilled, Skilled, Master / Foreman
  wage_type VARCHAR(50) DEFAULT 'Daily', -- Daily, Hourly, Monthly, Piece Rate
  daily_wage NUMERIC(10, 2) DEFAULT 0,
  aadhaar_number VARCHAR(20),
  id_proof_url TEXT,
  photo_url TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  upi_id VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  assigned_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_contract_workers_vendor_id ON contract_workers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contract_workers_assigned_project_id ON contract_workers(assigned_project_id);
CREATE INDEX IF NOT EXISTS idx_contract_workers_trade ON contract_workers(trade);
CREATE INDEX IF NOT EXISTS idx_contract_workers_phone ON contract_workers(phone);
CREATE INDEX IF NOT EXISTS idx_contract_workers_is_active ON contract_workers(is_active);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE contract_workers ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Idempotent)
DROP POLICY IF EXISTS "Allow authenticated users to read contract workers" ON contract_workers;
CREATE POLICY "Allow authenticated users to read contract workers" 
ON contract_workers FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage contract workers" ON contract_workers;
CREATE POLICY "Allow authenticated users to manage contract workers" 
ON contract_workers FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 6. Seed RBAC Permissions for Vendors & Contract Workers
INSERT INTO permissions (code, module, action, description) VALUES
  ('vendors.view', 'vendors', 'view', 'View vendors and contract workers'),
  ('vendors.create', 'vendors', 'create', 'Register new vendors and subcontractors'),
  ('vendors.edit', 'vendors', 'edit', 'Edit vendor and contractor profiles'),
  ('vendors.delete', 'vendors', 'delete', 'Delete vendors from the directory'),
  ('workers.create', 'workers', 'create', 'Register new contract workers and site labor'),
  ('workers.edit', 'workers', 'edit', 'Edit worker profiles, trades, and daily wages'),
  ('workers.delete', 'workers', 'delete', 'Delete worker records'),
  ('workers.assign', 'workers', 'assign', 'Assign workers to active project sites')
ON CONFLICT (code) DO NOTHING;

-- Grant all vendor & worker permissions to Admin role if it exists
DO $$
DECLARE
  admin_role_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  IF admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions WHERE code IN (
      'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete',
      'workers.create', 'workers.edit', 'workers.delete', 'workers.assign'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

