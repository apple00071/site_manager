-- Add actual_completion_date column to site_logs
alter table site_logs 
add column if not exists actual_completion_date date;
