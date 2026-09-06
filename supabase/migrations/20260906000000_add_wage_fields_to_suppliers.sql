-- ===================================================
-- Add Wage & Rate Information to Suppliers (Vendors)
-- Migration: 20260906000000_add_wage_fields_to_suppliers.sql
-- ===================================================

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS wage_type VARCHAR(50) DEFAULT 'Daily',
ADD COLUMN IF NOT EXISTS daily_wage NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);

-- Migrate any encoded wage metadata from notes if present
UPDATE suppliers
SET 
  wage_type = COALESCE(NULLIF(SUBSTRING(notes FROM '<!--wage_meta:.*"wage_type":"([^"]+)".*-->'), ''), wage_type, 'Daily'),
  daily_wage = COALESCE(NULLIF(SUBSTRING(notes FROM '<!--wage_meta:.*"daily_wage":([0-9.]+).*-->'), '')::numeric, daily_wage, 0),
  upi_id = COALESCE(NULLIF(SUBSTRING(notes FROM '<!--wage_meta:.*"upi_id":"([^"]*)".*-->'), ''), upi_id)
WHERE notes LIKE '%<!--wage_meta:%';
