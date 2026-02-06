-- Add geolocation columns to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS check_in_latitude FLOAT8,
ADD COLUMN IF NOT EXISTS check_in_longitude FLOAT8,
ADD COLUMN IF NOT EXISTS check_out_latitude FLOAT8,
ADD COLUMN IF NOT EXISTS check_out_longitude FLOAT8;

COMMENT ON COLUMN public.attendance.check_in_latitude IS 'Latitude at time of punch in';
COMMENT ON COLUMN public.attendance.check_in_longitude IS 'Longitude at time of punch in';
COMMENT ON COLUMN public.attendance.check_out_latitude IS 'Latitude at time of punch out';
COMMENT ON COLUMN public.attendance.check_out_longitude IS 'Longitude at time of punch out';
