-- Add resolved_description column to snags table
alter table snags 
add column if not exists resolved_description text;
