-- Add status column to site_logs
alter table site_logs 
add column if not exists status text default 'in_progress' check (status in ('in_progress', 'completed'));

-- Policy update (ensure updates are allowed if not already)
-- (Users can already update their own logs based on previous script)
