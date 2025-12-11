-- Activity log for tasks
-- Track all changes and interactions with tasks

CREATE TABLE IF NOT EXISTS task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, 
  -- Types: 'created', 'status_changed', 'assigned', 'priority_changed', 'commented', 'updated', 'due_date_changed'
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast task activity lookup
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_user_id ON task_activity(user_id);

-- Enable RLS
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activity for tasks they have access to
CREATE POLICY "Users can view task activity for accessible tasks"
  ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_activity.task_id
      AND (
        tasks.assigned_to = auth.uid()
        OR tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
    )
  );

-- Policy: Users can create activity for tasks
CREATE POLICY "Users can create activity"
  ON task_activity FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: No updates or deletes (activity is immutable)
-- Activity records are permanent for audit trail

COMMENT ON TABLE task_activity IS 'Logs all activity and changes made to tasks';
COMMENT ON COLUMN task_activity.activity_type IS 'Type of activity: created, status_changed, assigned, priority_changed, commented, updated, due_date_changed';
COMMENT ON COLUMN task_activity.old_value IS 'Previous value before change (for change types)';
COMMENT ON COLUMN task_activity.new_value IS 'New value after change (for change types)';
COMMENT ON COLUMN task_activity.comment IS 'Optional comment or note about the activity';
