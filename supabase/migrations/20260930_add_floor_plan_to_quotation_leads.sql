-- Migration: 20260930_add_floor_plan_to_quotation_leads.sql
-- Add floor_plan_url and floor_plan_name to quotation_leads table for CRM lead floor plan attachments

ALTER TABLE public.quotation_leads 
ADD COLUMN IF NOT EXISTS floor_plan_url TEXT,
ADD COLUMN IF NOT EXISTS floor_plan_name TEXT;
