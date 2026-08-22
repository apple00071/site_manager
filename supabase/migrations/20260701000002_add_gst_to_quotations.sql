-- Migration: Add gst_rate and gst_amount to quotations
-- Date: 2026-08-22

ALTER TABLE public.quotations 
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0;
