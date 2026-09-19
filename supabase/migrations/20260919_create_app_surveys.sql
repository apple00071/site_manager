-- Create app_surveys table to store mandatory feedback/survey responses
CREATE TABLE IF NOT EXISTS app_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issues TEXT NOT NULL,
  improvements TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup by user and date
CREATE INDEX IF NOT EXISTS idx_app_surveys_user_id ON app_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_app_surveys_created_at ON app_surveys(created_at DESC);

-- Enable RLS
ALTER TABLE app_surveys ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own survey
DROP POLICY IF EXISTS "Users can insert their own survey" ON app_surveys;
CREATE POLICY "Users can insert their own survey"
  ON app_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users with IT designation or Admin to read all surveys
DROP POLICY IF EXISTS "IT users can view all surveys" ON app_surveys;
CREATE POLICY "IT users can view all surveys"
  ON app_surveys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (LOWER(TRIM(designation)) = 'it' OR role = 'admin')
    )
  );
