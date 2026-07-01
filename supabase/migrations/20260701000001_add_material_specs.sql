-- Migration: Add material_specs column to quotations
-- Date: 2026-07-01

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS material_specs JSONB;
