-- Daily Progress Report (DPR) Module Tables

-- 1. Progress Reports Table
CREATE TABLE IF NOT EXISTS progress_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    summary TEXT,
    manpower_details JSONB DEFAULT '[]'::jsonb,
    blockers TEXT,
    tomorrow_plan TEXT,
    expected_end_date DATE,
    aggregated_data JSONB DEFAULT '{}'::jsonb,
    photos TEXT[] DEFAULT '{}',
    pdf_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Report Subscribers Table
CREATE TABLE IF NOT EXISTS report_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Project Viewpoints Table
CREATE TABLE IF NOT EXISTS project_viewpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    reference_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Report Viewpoint Photos Table
CREATE TABLE IF NOT EXISTS report_viewpoint_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES progress_reports(id) ON DELETE CASCADE,
    viewpoint_id UUID REFERENCES project_viewpoints(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger for progress_reports
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_progress_reports_updated_at
    BEFORE UPDATE ON progress_reports
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS (Assuming existing RLS patterns)
ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_viewpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_viewpoint_photos ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies (standard for this project's setup)
CREATE POLICY "Allow authenticated users to manage DPR" ON progress_reports FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to manage subscribers" ON report_subscribers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to manage viewpoints" ON project_viewpoints FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to manage viewpoint photos" ON report_viewpoint_photos FOR ALL USING (auth.role() = 'authenticated');
