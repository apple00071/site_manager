-- Create push_subscriptions table for PWA push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role can manage all push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE push_subscriptions IS 'Stores push notification subscriptions for PWA';

