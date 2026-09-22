-- Create app_popups table
CREATE TABLE IF NOT EXISTS app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  popup_type TEXT NOT NULL DEFAULT 'announcement', -- 'info', 'warning', 'celebration', 'announcement'
  image_url TEXT,
  action_label TEXT DEFAULT 'Got it',
  action_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'role', 'users'
  target_roles JSONB DEFAULT '[]'::jsonb, -- Array of role/designation strings
  target_user_ids JSONB DEFAULT '[]'::jsonb, -- Array of user UUID strings
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying active popups
CREATE INDEX IF NOT EXISTS idx_app_popups_is_active ON app_popups(is_active);
CREATE INDEX IF NOT EXISTS idx_app_popups_created_at ON app_popups(created_at DESC);

-- Create app_popup_dismissals table to track which users have seen/dismissed each popup
CREATE TABLE IF NOT EXISTS app_popup_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES app_popups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_popup_user_dismissal UNIQUE (popup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_popup_dismissals_lookup ON app_popup_dismissals(popup_id, user_id);

-- Enable RLS
ALTER TABLE app_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_popup_dismissals ENABLE ROW LEVEL SECURITY;

-- Popups RLS: Authenticated users can view active popups
DROP POLICY IF EXISTS "Authenticated users can view popups" ON app_popups;
CREATE POLICY "Authenticated users can view popups"
  ON app_popups
  FOR SELECT
  TO authenticated
  USING (true);

-- Popups RLS: Admin or IT can insert/update/delete popups
DROP POLICY IF EXISTS "Admins can manage popups" ON app_popups;
CREATE POLICY "Admins can manage popups"
  ON app_popups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'admin' OR LOWER(TRIM(COALESCE(designation, ''))) = 'it')
    )
  );

-- Dismissals RLS: Users can view and insert their own dismissals
DROP POLICY IF EXISTS "Users can manage their dismissals" ON app_popup_dismissals;
CREATE POLICY "Users can manage their dismissals"
  ON app_popup_dismissals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
