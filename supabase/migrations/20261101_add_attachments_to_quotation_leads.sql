-- Migration: 20261101_add_attachments_to_quotation_leads.sql
-- Description: Add native JSONB attachments column to quotation_leads for multi-file support (PDF, Word, Excel, CAD, Images)

-- 1. Add attachments column to quotation_leads table
ALTER TABLE public.quotation_leads 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill existing floor_plan_url / floor_plan_name into attachments array for existing leads
UPDATE public.quotation_leads
SET attachments = jsonb_build_array(
    jsonb_build_object(
        'url', floor_plan_url,
        'name', COALESCE(floor_plan_name, 'Floor Plan')
    )
)
WHERE floor_plan_url IS NOT NULL 
  AND floor_plan_url <> '' 
  AND (attachments IS NULL OR attachments = '[]'::jsonb);

-- 3. Create a GIN index on attachments for high-performance JSON querying
CREATE INDEX IF NOT EXISTS idx_quotation_leads_attachments 
ON public.quotation_leads USING GIN (attachments);
