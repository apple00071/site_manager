-- Migration: 20260927_add_id_proof_url_to_suppliers.sql
-- Add id_proof_url to suppliers table for vendor/contractor documents

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS id_proof_url TEXT;
