-- Create a table to log all site-wide broadcasts for auditing and history
CREATE TABLE IF NOT EXISTS broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    recipient_count INTEGER NOT NULL,
    target_user_ids UUID[] DEFAULT NULL, -- NULL indicates broadcast to ALL users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view or manage broadcast logs
CREATE POLICY "Admins can manage broadcast logs" ON broadcast_logs
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    ));

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_admin_id ON broadcast_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at ON broadcast_logs(created_at);
