-- ============================================
-- BOQ & Procurement Module Migration
-- Created: 2025-12-12
-- ============================================

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email TEXT,
  contact_phone VARCHAR(20),
  gst_number VARCHAR(20),
  pan_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. BOQ ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS boq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(100),
  sub_category VARCHAR(100),
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 0,
  rate DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  status VARCHAR(50) DEFAULT 'draft', -- draft, confirmed, completed
  sort_order INTEGER DEFAULT 0,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PURCHASE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  delivery_address TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 18,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, acknowledged, partially_received, received, cancelled
  terms_conditions TEXT,
  notes TEXT,
  email_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PO LINE ITEMS (links BOQ to PO)
-- ============================================
CREATE TABLE IF NOT EXISTS po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES boq_items(id),
  description VARCHAR(255) NOT NULL,
  unit VARCHAR(50),
  quantity DECIMAL(12,2) NOT NULL,
  rate DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  received_quantity DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  invoice_type VARCHAR(50) NOT NULL, -- advance, ra_bill, final, credit_note
  amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  file_url TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, paid
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50), -- bank_transfer, cheque, cash, upi
  reference_number VARCHAR(100),
  payment_proof_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_boq_items_project ON boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_category ON boq_items(category);
CREATE INDEX IF NOT EXISTS idx_boq_items_status ON boq_items(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_line_items_po ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_boq ON po_line_items(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_po ON invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ============================================
-- 8. TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_suppliers_updated_at ON suppliers;
CREATE TRIGGER trigger_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_boq_items_updated_at ON boq_items;
CREATE TRIGGER trigger_boq_items_updated_at
  BEFORE UPDATE ON boq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trigger_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. RLS POLICIES
-- ============================================

-- Suppliers RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suppliers" ON suppliers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can view suppliers" ON suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- BOQ Items RLS
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage boq_items" ON boq_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project members can view boq_items" ON boq_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = boq_items.project_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project members with edit can manage boq_items" ON boq_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = boq_items.project_id
      AND user_id = auth.uid()
      AND (permissions->>'edit')::boolean = true
    )
  );

-- Purchase Orders RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase_orders" ON purchase_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project members can view purchase_orders" ON purchase_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = purchase_orders.project_id
      AND user_id = auth.uid()
    )
  );

-- PO Line Items RLS
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage po_line_items via PO" ON po_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN project_members pm ON pm.project_id = po.project_id
      WHERE po.id = po_line_items.po_id
      AND pm.user_id = auth.uid()
    )
  );

-- Invoices RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project members can view invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = invoices.project_id
      AND user_id = auth.uid()
    )
  );

-- Payments RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payments" ON payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project members can view payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = payments.project_id
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- 10. PO NUMBER SEQUENCE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1001;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('po_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE!
-- ============================================
