-- Migration to add site-based tracking to snags
ALTER TABLE IF EXISTS snags 
ADD COLUMN IF NOT EXISTS site_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Update RLS if needed (assuming public.snags has basic RLS)
-- Since site_name and customer_phone are just text fields, no complex RLS changes are likely needed 
-- unless there are specific column-level policies.
