-- ============================================
-- Proposals Table Migration
-- Created: 2025-12-12
-- ============================================

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  selected_items UUID[] NOT NULL DEFAULT '{}',
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, approved, rejected
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_proposals_updated_at ON proposals;
CREATE TRIGGER trigger_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage proposals" ON proposals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Project members can view proposals" ON proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = proposals.project_id
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- DONE!
-- ============================================
