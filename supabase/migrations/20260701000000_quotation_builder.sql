-- Migration: Quotation Builder Tables
-- Date: 2026-07-01

-- ============================================
-- 1. RATE CARD (master price list, admin-editable)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sqft',   -- 'sqft', 'rft', 'nos', 'lumpsum'
  default_rate NUMERIC NOT NULL DEFAULT 0,
  is_lumpsum BOOLEAN NOT NULL DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.rate_card ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_card_read" ON public.rate_card FOR SELECT TO authenticated USING (true);
CREATE POLICY "rate_card_write" ON public.rate_card FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. QUOTATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.quotation_leads(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'none',  -- 'none', 'percent', 'flat'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotations_read" ON public.quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotations_write" ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. QUOTATION ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item_name TEXT NOT NULL,
  is_lumpsum BOOLEAN NOT NULL DEFAULT false,
  length_ft NUMERIC,
  width_ft NUMERIC,
  area_sqft NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'sqft',
  rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0
);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotation_items_read" ON public.quotation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotation_items_write" ON public.quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. ADD COLUMNS TO quotation_leads
-- ============================================
ALTER TABLE public.quotation_leads
  ADD COLUMN IF NOT EXISTS latest_quotation_id UUID REFERENCES public.quotations(id),
  ADD COLUMN IF NOT EXISTS quote_version INT DEFAULT 0;

-- ============================================
-- 5. SEED RATE CARD (from Apple Interiors template)
-- ============================================
INSERT INTO public.rate_card (section, item_name, unit, default_rate, is_lumpsum, sort_order) VALUES
  -- Drawing Room
  ('Drawing Room', 'Designer TV Unit', 'sqft', 1250, false, 1),
  ('Drawing Room', 'Feature Wall / Panelling', 'sqft', 800, false, 2),
  ('Drawing Room', 'False Ceiling Cove', 'sqft', 67, false, 3),

  -- Dining Area
  ('Dining Area', 'Crockery Unit', 'sqft', 1550, false, 1),
  ('Dining Area', 'Vanity Box', 'sqft', 1550, false, 2),
  ('Dining Area', 'Vanity Tiles', 'lumpsum', 12000, true, 3),

  -- Puja Area
  ('Puja Area', 'Puja Unit Base', 'sqft', 2300, false, 1),
  ('Puja Area', 'Puja Unit Back Panelling', 'sqft', 800, false, 2),
  ('Puja Area', 'Puja Unit Arch Panelling', 'rft', 550, false, 3),
  ('Puja Area', 'Puja Glass Doors', 'lumpsum', 22000, true, 4),

  -- Kitchen
  ('Kitchen', 'Kitchen Platform Base Box', 'sqft', 1750, false, 1),
  ('Kitchen', 'Kitchen Platform Over Head', 'sqft', 1550, false, 2),
  ('Kitchen', 'Loft Storage Above Door Level', 'sqft', 1000, false, 3),
  ('Kitchen', 'Kitchen Accessories (Sleek Tandum)', 'lumpsum', 42000, true, 4),
  ('Kitchen', 'Profile Doors in Kitchen', 'lumpsum', 14000, true, 5),

  -- Master Bedroom
  ('Master Bedroom', 'Wardrobe (Sliding / Open Door)', 'sqft', 1550, false, 1),
  ('Master Bedroom', 'Loft', 'sqft', 1000, false, 2),
  ('Master Bedroom', 'Loft Panelling', 'sqft', 550, false, 3),
  ('Master Bedroom', 'King Sized Bed With Hydraulic Storage', 'sqft', 1550, false, 4),
  ('Master Bedroom', 'Head Board With Cushion', 'lumpsum', 18000, true, 5),
  ('Master Bedroom', 'Dressing Unit', 'sqft', 1600, false, 6),
  ('Master Bedroom', 'Simple TV Unit', 'sqft', 1000, false, 7),

  -- Bedroom (reusable for Children's / Guest)
  ('Bedroom 2', 'Wardrobe (Sliding / Open Door)', 'sqft', 1550, false, 1),
  ('Bedroom 2', 'Loft', 'sqft', 1000, false, 2),
  ('Bedroom 2', 'Study cum Bookshelves', 'lumpsum', 32000, true, 3),
  ('Bedroom 2', 'Dressing Unit', 'sqft', 1600, false, 4),
  ('Bedroom 2', 'Working Station', 'sqft', 1550, false, 5),
  ('Bedroom 2', 'Simple Mirror with Panelling', 'sqft', 1100, false, 6),

  -- Bedroom 3
  ('Bedroom 3', 'Wardrobe (Sliding / Open Door)', 'sqft', 1550, false, 1),
  ('Bedroom 3', 'Loft', 'sqft', 1000, false, 2),
  ('Bedroom 3', 'Dressing Unit', 'sqft', 1600, false, 3),
  ('Bedroom 3', 'Working Station', 'sqft', 1550, false, 4),

  -- Miscellaneous
  ('Miscellaneous', 'Standard Shoe Rack', 'lumpsum', 22000, true, 1),
  ('Miscellaneous', 'Simple Main Door Panelling', 'lumpsum', 25000, true, 2),
  ('Miscellaneous', 'Utility Box', 'sqft', 1450, false, 3),
  ('Miscellaneous', 'Flat Debris & Deep Cleaning', 'lumpsum', 15000, true, 4),
  ('Miscellaneous', 'Lifting Charges', 'lumpsum', 6000, true, 5),
  ('Miscellaneous', 'Floor Protection Mat', 'lumpsum', 13000, true, 6),

  -- Kitchen Platform
  ('Kitchen Platform', 'Quartz Top', 'nos', 50000, false, 1),
  ('Kitchen Platform', 'Dado Tiles', 'lumpsum', 12000, true, 2),
  ('Kitchen Platform', 'Labour Charges — Granite & Tile Laying', 'lumpsum', 35000, true, 3),

  -- False Ceiling
  ('False Ceiling', 'Gypsum False Ceiling', 'sqft', 67, false, 1),
  ('False Ceiling', 'PVC Ceiling', 'sqft', 220, false, 2),

  -- Painting
  ('Painting', 'False Ceiling Paint (Birla Putty + Primer + Premium)', 'sqft', 34, false, 1),
  ('Painting', 'Wall Paint — Asian Royal Aspira (touch-ups)', 'lumpsum', 40000, true, 2),

  -- Electrical
  ('Electrical', 'Wiring — Full Scope (Finolex)', 'lumpsum', 95000, true, 1),
  ('Electrical', 'Profile Lights (Rope / Spot / Scale)', 'lumpsum', 35000, true, 2)

ON CONFLICT DO NOTHING;
