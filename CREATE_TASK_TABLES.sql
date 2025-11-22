-- ============================================
-- CREATE TASK MANAGEMENT TABLES
-- ============================================
-- Run this in your Supabase SQL Editor to create the missing task tables

-- Create project_steps table
CREATE TABLE IF NOT EXISTS project_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid status values
  CONSTRAINT check_step_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Create project_step_tasks table
CREATE TABLE IF NOT EXISTS project_step_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES project_steps(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  estimated_completion_date DATE,
  actual_completion_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'todo',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid status values
  CONSTRAINT check_task_status CHECK (status IN ('todo', 'in_progress', 'blocked', 'done'))
);

-- Generic calendar tasks table (not tied to project steps)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'todo',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_calendar_task_status CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  CONSTRAINT check_calendar_task_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_start_at ON tasks(start_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_status ON project_steps(status);
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_step_id ON project_step_tasks(step_id);
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_status ON project_step_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_step_tasks_assigned_to ON project_step_tasks(assigned_to);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_project_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_project_step_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_steps_updated_at ON project_steps;
CREATE TRIGGER trigger_update_project_steps_updated_at
  BEFORE UPDATE ON project_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_project_steps_updated_at();

DROP TRIGGER IF EXISTS trigger_update_project_step_tasks_updated_at ON project_step_tasks;
CREATE TRIGGER trigger_update_project_step_tasks_updated_at
  BEFORE UPDATE ON project_step_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_step_tasks_updated_at();

-- Enable RLS
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_step_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_steps
-- Admins can do everything
CREATE POLICY "Admins can manage all project_steps" ON project_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Project members can view steps
CREATE POLICY "Project members can view project_steps" ON project_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_steps.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

-- Project members can create/update steps if they have edit permissions
CREATE POLICY "Project members can manage project_steps" ON project_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_steps.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

CREATE POLICY "Project members can update project_steps" ON project_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_steps.project_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- RLS Policies for project_step_tasks
-- Admins can do everything
CREATE POLICY "Admins can manage all project_step_tasks" ON project_step_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Project members can view tasks
CREATE POLICY "Project members can view project_step_tasks" ON project_step_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_steps
      JOIN projects ON projects.id = project_steps.project_id
      WHERE project_steps.id = project_step_tasks.step_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'view')::boolean = true
        )
      )
    )
  );

-- Project members can create/update/delete tasks if they have edit permissions
CREATE POLICY "Project members can manage project_step_tasks" ON project_step_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_steps
      JOIN projects ON projects.id = project_steps.project_id
      WHERE project_steps.id = project_step_tasks.step_id
      AND (
        projects.assigned_employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND (project_members.permissions->>'edit')::boolean = true
        )
      )
    )
  );

-- Grant permissions to service role
GRANT ALL ON project_steps TO service_role;
GRANT ALL ON project_step_tasks TO service_role;
GRANT EXECUTE ON FUNCTION update_project_steps_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION update_project_step_tasks_updated_at() TO service_role;

-- Add some sample data for testing (optional)
-- You can remove this section if you don't want sample data

-- Insert a sample step for existing projects (if any)
INSERT INTO project_steps (project_id, title, description, created_by)
SELECT 
  p.id,
  'Initial Planning',
  'Initial project planning and requirements gathering',
  p.created_by
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_steps ps WHERE ps.project_id = p.id
)
LIMIT 5; -- Only add to first 5 projects to avoid clutter

-- ============================================
-- TASK TABLES CREATION COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Task management tables created successfully!';
  RAISE NOTICE 'Tables created: project_steps, project_step_tasks';
  RAISE NOTICE 'RLS policies enabled for role-based access';
  RAISE NOTICE 'You can now create and manage tasks in the application';
END $$;
