-- Migration to support multiple bills/receipts
-- Renames bill_url to bill_urls (TEXT[]) in office_expenses and inventory_items

-- 1. Office Expenses
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'office_expenses' AND column_name = 'bill_url') THEN
        ALTER TABLE office_expenses RENAME COLUMN bill_url TO bill_url_old;
        ALTER TABLE office_expenses ADD COLUMN bill_urls TEXT[] DEFAULT '{}';
        UPDATE office_expenses SET bill_urls = ARRAY[bill_url_old] WHERE bill_url_old IS NOT NULL AND bill_url_old != '';
        ALTER TABLE office_expenses DROP COLUMN bill_url_old;
    END IF;
END $$;

-- 2. Inventory Items (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'bill_url') THEN
        ALTER TABLE inventory_items RENAME COLUMN bill_url TO bill_url_old;
        ALTER TABLE inventory_items ADD COLUMN bill_urls TEXT[] DEFAULT '{}';
        UPDATE inventory_items SET bill_urls = ARRAY[bill_url_old] WHERE bill_url_old IS NOT NULL AND bill_url_old != '';
        ALTER TABLE inventory_items DROP COLUMN bill_url_old;
    END IF;
END $$;
