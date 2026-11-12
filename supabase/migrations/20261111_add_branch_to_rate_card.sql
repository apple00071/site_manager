-- Migration: 20261111_add_branch_to_rate_card.sql
-- Multi-Branch support for Rate Card Master (Kukatpally vs AS Rao Nagar)

-- 1. Add branch column to rate_card table
ALTER TABLE public.rate_card 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Kukatpally';

-- 2. Create index on branch for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_card_branch ON public.rate_card(branch);

-- 3. Default all existing items to Kukatpally
UPDATE public.rate_card SET branch = 'Kukatpally' WHERE branch IS NULL;

-- 4. Clone existing Kukatpally items for AS Rao Nagar branch so both branches start with a full price list
INSERT INTO public.rate_card (section, item_name, unit, default_rate, is_lumpsum, sort_order, is_active, branch)
SELECT section, item_name, unit, default_rate, is_lumpsum, sort_order, is_active, 'AS Rao Nagar'
FROM public.rate_card
WHERE (branch = 'Kukatpally' OR branch IS NULL) AND is_active = true
ON CONFLICT DO NOTHING;

