-- ============================================
-- SIMPLE TASK MANAGEMENT TABLES
-- ============================================
-- Run this in your Supabase SQL Editor

-- Create project_steps table (simple version)
CREATE TABLE IF NOT EXISTS project_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_step_tasks table (simple version)
CREATE TABLE IF NOT EXISTS project_step_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES project_steps(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  estimated_completion_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'todo',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simple indexes (after tables are created)
CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_step_id ON project_step_tasks(step_id);
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_status ON project_step_tasks(status);

-- Enable RLS
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_step_tasks ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies - Allow all authenticated users to manage tasks
CREATE POLICY "Allow all authenticated users to manage project_steps" ON project_steps
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to manage project_step_tasks" ON project_step_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON project_steps TO authenticated;
GRANT ALL ON project_step_tasks TO authenticated;
GRANT ALL ON project_steps TO service_role;
GRANT ALL ON project_step_tasks TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Simple task tables created successfully!';
  RAISE NOTICE 'Tables: project_steps, project_step_tasks';
  RAISE NOTICE 'All authenticated users can create and manage tasks';
END $$;
