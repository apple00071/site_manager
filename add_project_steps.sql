-- Migration: Add project_steps table with 5 fixed stages
-- Run this in Supabase SQL Editor

-- Create enum for stages if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_stage') THEN
    CREATE TYPE project_stage AS ENUM (
      'false_ceiling',
      'electrical_work',
      'carpenter_works',
      'painting_work',
      'deep_cleaning'
    );
  END IF;
END$$;

-- Create enum for step status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'step_status') THEN
    CREATE TYPE step_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
  END IF;
END$$;

-- Steps table
CREATE TABLE IF NOT EXISTS project_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stage project_stage NOT NULL,
  status step_status NOT NULL DEFAULT 'todo',
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_project_steps_project ON project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_stage ON project_steps(stage);
CREATE INDEX IF NOT EXISTS idx_project_steps_status ON project_steps(status);

-- Row Level Security
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;

-- Policies (mirror projects access: members or admins)
DROP POLICY IF EXISTS "project_steps_select" ON project_steps;
CREATE POLICY "project_steps_select" ON project_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_steps.project_id
    )
  );

DROP POLICY IF EXISTS "project_steps_modify" ON project_steps;
CREATE POLICY "project_steps_modify" ON project_steps
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_steps.project_id
    )
  );



