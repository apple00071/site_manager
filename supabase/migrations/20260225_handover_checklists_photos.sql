-- Add photos array to handover_checklists table
ALTER TABLE public.handover_checklists
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];

-- Ensure the column is an array of text
COMMENT ON COLUMN public.handover_checklists.photos IS 'Array of public photo URLs associated with this checklist item';
