-- Make quantity field optional in inventory_items table
-- This allows inventory items to be created without specifying quantity

ALTER TABLE inventory_items
ALTER COLUMN quantity DROP NOT NULL;

COMMENT ON COLUMN inventory_items.quantity IS 'Optional quantity field - can be null if not specified';
