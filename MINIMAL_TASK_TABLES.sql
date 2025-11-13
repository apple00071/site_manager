-- ============================================
-- MINIMAL TASK TABLES - GUARANTEED TO WORK
-- ============================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS project_step_tasks CASCADE;
DROP TABLE IF EXISTS project_steps CASCADE;

-- Create project_steps table
CREATE TABLE project_steps (
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

-- Create project_step_tasks table
CREATE TABLE project_step_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES project_steps(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  estimated_completion_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'todo',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_project_steps_project_id ON project_steps(project_id);
CREATE INDEX idx_project_step_tasks_step_id ON project_step_tasks(step_id);
CREATE INDEX idx_project_step_tasks_status ON project_step_tasks(status);
CREATE INDEX idx_project_step_tasks_priority ON project_step_tasks(priority);

-- Enable RLS
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_step_tasks ENABLE ROW LEVEL SECURITY;

-- Create simple policies that allow all authenticated users
CREATE POLICY "authenticated_users_project_steps" ON project_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_project_step_tasks" ON project_step_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON project_steps TO authenticated, service_role;
GRANT ALL ON project_step_tasks TO authenticated, service_role;

-- Success message
SELECT 'Task tables created successfully! You can now create tasks.' as result;
