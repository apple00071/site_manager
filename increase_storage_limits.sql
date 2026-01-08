
-- INCREASE STORAGE LIMITS
-- Run this in Supabase SQL Editor

-- Increase limit for design-files to 500MB (524288000 bytes)
UPDATE storage.buckets 
SET file_size_limit = 524288000
WHERE id = 'design-files';

-- Increase limit for project-files to 200MB (209715200 bytes)
UPDATE storage.buckets 
SET file_size_limit = 209715200
WHERE id = 'project-files';

-- Increase limit for project-documents to 200MB
UPDATE storage.buckets 
SET file_size_limit = 209715200
WHERE id = 'project-documents';

-- Increase limit for inventory-bills to 100MB
UPDATE storage.buckets 
SET file_size_limit = 104857600
WHERE id = 'inventory-bills';

-- Verify the changes
SELECT id, name, file_size_limit / 1024 / 1024 as limit_mb 
FROM storage.buckets;
