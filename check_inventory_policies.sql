-- ============================================
-- CHECK INVENTORY-BILLS POLICIES IN DETAIL
-- ============================================

SELECT 
    policyname,
    cmd as operation,
    roles::text,
    CASE 
        WHEN qual IS NOT NULL THEN qual
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN with_check
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (
    policyname LIKE '%inventory%' 
    OR qual LIKE '%inventory-bills%'
    OR with_check LIKE '%inventory-bills%'
)
ORDER BY policyname;
