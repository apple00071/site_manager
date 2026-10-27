-- Migration: 20261027_add_created_by_to_quotation_leads.sql
-- Add created_by column to quotation_leads table to track the user who captured the lead

ALTER TABLE public.quotation_leads 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_quotation_leads_created_by ON public.quotation_leads(created_by);
