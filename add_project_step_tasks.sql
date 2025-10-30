-- Migration: Add project_step_tasks table for tasks inside a step
-- Run in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo','in_progress','blocked','done');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS project_step_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_id UUID NOT NULL REFERENCES project_steps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  estimated_completion_date TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_step_tasks_step ON project_step_tasks(step_id);
CREATE INDEX IF NOT EXISTS idx_step_tasks_status ON project_step_tasks(status);

ALTER TABLE project_step_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_tasks_select" ON project_step_tasks;
CREATE POLICY "step_tasks_select" ON project_step_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_steps ps
      WHERE ps.id = project_step_tasks.step_id
    )
  );

DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks;
CREATE POLICY "step_tasks_modify" ON project_step_tasks
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM project_steps ps
      JOIN project_members pm ON pm.project_id = ps.project_id
      WHERE ps.id = project_step_tasks.step_id
    )
  );

-- Step 2: Add color and assignee_id fields
ALTER TABLE project_step_tasks ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'gray';
ALTER TABLE project_step_tasks ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;


