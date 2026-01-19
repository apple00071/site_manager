-- Create project_client_access table
CREATE TABLE IF NOT EXISTS project_client_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    password_hash TEXT, -- Optional password protection
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE project_client_access ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage client access"
    ON project_client_access FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Public can view project data via token"
    ON project_client_access FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > now()));
