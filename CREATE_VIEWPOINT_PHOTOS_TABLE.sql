-- Report Viewpoint Photos Table (for storing captured photos during DPR)
-- This table stores photos captured for predefined viewpoints

CREATE TABLE IF NOT EXISTS report_viewpoint_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES progress_reports(id) ON DELETE CASCADE,
    viewpoint_id TEXT NOT NULL, -- Predefined viewpoint ID like 'vp-living-room'
    photo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE report_viewpoint_photos ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to manage viewpoint photos" ON report_viewpoint_photos;
CREATE POLICY "Allow authenticated users to manage viewpoint photos" ON report_viewpoint_photos FOR ALL USING (auth.role() = 'authenticated');
