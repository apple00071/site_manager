-- ============================================
-- BOQ Delivery Tracking Migration
-- Created: 2026-09-24
-- Adds: order_status, delivered_quantity, delivered_at, delivered_by, delivery_challan_url, delivery_notes
-- ============================================

DO $$ 
BEGIN
    -- order_status: pending, ordered, delivered, partial, cancelled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'order_status') THEN
        ALTER TABLE boq_items ADD COLUMN order_status VARCHAR(50) DEFAULT 'pending';
    END IF;

    -- delivered_quantity: quantity received on site
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'delivered_quantity') THEN
        ALTER TABLE boq_items ADD COLUMN delivered_quantity DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- delivered_at: timestamp when delivery was confirmed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'delivered_at') THEN
        ALTER TABLE boq_items ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;

    -- delivered_by: user who confirmed receipt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'delivered_by') THEN
        ALTER TABLE boq_items ADD COLUMN delivered_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- delivery_challan_url: photo/image of the delivery challan or materials
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'delivery_challan_url') THEN
        ALTER TABLE boq_items ADD COLUMN delivery_challan_url TEXT;
    END IF;

    -- delivery_notes: remarks, challan number, condition notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'delivery_notes') THEN
        ALTER TABLE boq_items ADD COLUMN delivery_notes TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boq_items_order_status ON boq_items(order_status);
CREATE INDEX IF NOT EXISTS idx_boq_items_delivered_at ON boq_items(delivered_at);
