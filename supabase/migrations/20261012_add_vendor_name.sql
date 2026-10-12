-- Migration: Add vendor_name to boq_items and boq_bills
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_items' AND column_name = 'vendor_name') THEN
        ALTER TABLE boq_items ADD COLUMN vendor_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'boq_bills' AND column_name = 'vendor_name') THEN
        ALTER TABLE boq_bills ADD COLUMN vendor_name VARCHAR(255);
    END IF;
END $$;
