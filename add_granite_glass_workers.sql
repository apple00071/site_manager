-- Add granite and glass worker columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS granite_worker_name TEXT,
ADD COLUMN IF NOT EXISTS granite_worker_phone TEXT,
ADD COLUMN IF NOT EXISTS glass_worker_name TEXT,
ADD COLUMN IF NOT EXISTS glass_worker_phone TEXT;

-- Add property detail columns if they don't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS property_type TEXT,
ADD COLUMN IF NOT EXISTS apartment_name TEXT,
ADD COLUMN IF NOT EXISTS block_number TEXT,
ADD COLUMN IF NOT EXISTS flat_number TEXT,
ADD COLUMN IF NOT EXISTS floor_number TEXT,
ADD COLUMN IF NOT EXISTS area_sqft NUMERIC;

-- Add requirements PDF column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS requirements_pdf_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN projects.granite_worker_name IS 'Name of the granite worker assigned to the project';
COMMENT ON COLUMN projects.granite_worker_phone IS 'Phone number of the granite worker';
COMMENT ON COLUMN projects.glass_worker_name IS 'Name of the glass worker assigned to the project';
COMMENT ON COLUMN projects.glass_worker_phone IS 'Phone number of the glass worker';
COMMENT ON COLUMN projects.requirements_pdf_url IS 'URL to the project requirements PDF document';
