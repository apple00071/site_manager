-- Add resolved_photos column to snags table
alter table snags 
add column if not exists resolved_photos text[] default array[]::text[];
