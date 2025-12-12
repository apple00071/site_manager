-- ============================================
-- BOQ Extended Fields Migration
-- Created: 2025-12-12
-- Adds: order_status, item_type, source, draft_quantity
-- ============================================

-- Add new columns to boq_items if they don't exist
DO $$ 
BEGIN
    -- order_status: pending, ordered, received, cancelled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'order_status') THEN
        ALTER TABLE boq_items ADD COLUMN order_status VARCHAR(50) DEFAULT 'pending';
    END IF;

    -- item_type: material, labour, equipment, subcontract
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'item_type') THEN
        ALTER TABLE boq_items ADD COLUMN item_type VARCHAR(50) DEFAULT 'material';
    END IF;

    -- source: bought_out, raw_material, site_work
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'source') THEN
        ALTER TABLE boq_items ADD COLUMN source VARCHAR(50) DEFAULT 'bought_out';
    END IF;

    -- draft_quantity: quantity before final confirmation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'draft_quantity') THEN
        ALTER TABLE boq_items ADD COLUMN draft_quantity DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Add index for order_status if not exists
CREATE INDEX IF NOT EXISTS idx_boq_items_order_status ON boq_items(order_status);
CREATE INDEX IF NOT EXISTS idx_boq_items_item_type ON boq_items(item_type);

-- Progress tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'progress_percent') THEN
        ALTER TABLE boq_items ADD COLUMN progress_percent INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'guidelines') THEN
        ALTER TABLE boq_items ADD COLUMN guidelines TEXT;
    END IF;
END $$;

-- ============================================
-- DONE!
-- ============================================
