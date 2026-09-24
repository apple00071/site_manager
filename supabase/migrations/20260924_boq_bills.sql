-- ============================================
-- BOQ Delivery Bills Migration
-- Created: 2026-09-24
-- Supports grouping exported items into unified Delivery Bills
-- ============================================

DO $$ 
BEGIN
    -- Add bill_number to boq_items if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'bill_number') THEN
        ALTER TABLE boq_items ADD COLUMN bill_number VARCHAR(100);
    END IF;

    -- Create boq_bills table to record each exported bill / delivery lot
    CREATE TABLE IF NOT EXISTS boq_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        bill_number VARCHAR(100) NOT NULL,
        bill_type VARCHAR(50) DEFAULT 'boq', -- 'boq' or 'laminate'
        order_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'ordered', -- 'ordered', 'delivered'
        item_count INTEGER DEFAULT 0,
        item_names TEXT[],
        delivery_date TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        delivered_by UUID REFERENCES users(id) ON DELETE SET NULL,
        delivery_challan_url TEXT,
        delivery_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_boq_bills_project_id ON boq_bills(project_id);
    CREATE INDEX IF NOT EXISTS idx_boq_items_bill_number ON boq_items(bill_number);
END $$;
