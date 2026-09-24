-- Create client_payments table for tracking project milestone payments
CREATE TABLE IF NOT EXISTS public.client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  milestone_name TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'Bank Transfer',
  reference_number TEXT,
  invoice_number TEXT,
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_payments_project_id ON public.client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_payment_date ON public.client_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_payments_recorded_by ON public.client_payments(recorded_by);

-- Enable Row Level Security
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view client payments
DROP POLICY IF EXISTS "client_payments_read" ON public.client_payments;
CREATE POLICY "client_payments_read" ON public.client_payments
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert / update / delete client payments
DROP POLICY IF EXISTS "client_payments_write" ON public.client_payments;
CREATE POLICY "client_payments_write" ON public.client_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_client_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_payments_updated_at ON public.client_payments;
CREATE TRIGGER trigger_client_payments_updated_at
  BEFORE UPDATE ON public.client_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_payments_updated_at();
