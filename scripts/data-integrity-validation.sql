-- ============================================================================
-- Planning 테이블 데이터 무결성 검증 스크립트
-- 마이그레이션 전후 데이터 일관성 체크 및 백업 복구 전략
-- ============================================================================

-- 검증 시작 시간 기록
SELECT 'Planning 데이터 무결성 검증 시작: ' || NOW() as validation_start;

-- ============================================================================
-- 1단계: 기본 스키마 검증 (Schema Validation)
-- ============================================================================

-- 1.1 필수 필드 존재 확인
SELECT
    '1.1 Required Fields Check' as test_name,
    CASE
        WHEN COUNT(*) = 14 THEN 'PASS'
        ELSE 'FAIL: ' || (14 - COUNT(*)) || ' fields missing'
    END as result,
    ARRAY_AGG(column_name ORDER BY ordinal_position) as existing_fields
FROM information_schema.columns
WHERE table_name = 'planning'
AND table_schema = 'public'
AND column_name IN ('id', 'type', 'title', 'content', 'status', 'user_id', 'project_id', 'version', 'metadata', 'storage', 'source', 'storage_status', 'created_at', 'updated_at');

-- 1.2 신규 필드 존재 확인 (마이그레이션 대상)
SELECT
    '1.2 New Fields Check' as test_name,
    CASE
        WHEN COUNT(*) = 4 THEN 'PASS: All new fields exist'
        ELSE 'FAIL: ' || (4 - COUNT(*)) || ' new fields missing'
    END as result,
    ARRAY_AGG(column_name) as new_fields
FROM information_schema.columns
WHERE table_name = 'planning'
AND table_schema = 'public'
AND column_name IN ('project_id', 'storage', 'storage_status', 'source');

-- 1.3 데이터 타입 검증
SELECT
    '1.3 Data Types Check' as test_name,
    column_name,
    data_type,
    CASE
        WHEN column_name = 'id' AND data_type = 'uuid' THEN 'PASS'
        WHEN column_name = 'type' AND data_type = 'text' THEN 'PASS'
        WHEN column_name = 'title' AND data_type = 'text' THEN 'PASS'
        WHEN column_name = 'content' AND data_type = 'jsonb' THEN 'PASS'
        WHEN column_name = 'status' AND data_type = 'text' THEN 'PASS'
        WHEN column_name = 'user_id' AND data_type = 'uuid' THEN 'PASS'
        WHEN column_name = 'project_id' AND data_type = 'uuid' THEN 'PASS'
        WHEN column_name = 'version' AND data_type = 'integer' THEN 'PASS'
        WHEN column_name = 'metadata' AND data_type = 'jsonb' THEN 'PASS'
        WHEN column_name = 'storage' AND data_type = 'jsonb' THEN 'PASS'
        WHEN column_name = 'source' AND data_type = 'text' THEN 'PASS'
        WHEN column_name = 'storage_status' AND data_type = 'text' THEN 'PASS'
        WHEN column_name IN ('created_at', 'updated_at') AND data_type = 'timestamp with time zone' THEN 'PASS'
        ELSE 'FAIL: Unexpected type'
    END as validation_result
FROM information_schema.columns
WHERE table_name = 'planning'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 2단계: 인덱스 검증 (Index Validation)
-- ============================================================================

-- 2.1 필수 인덱스 존재 확인
SELECT
    '2.1 Required Indexes Check' as test_name,
    CASE
        WHEN COUNT(*) >= 10 THEN 'PASS: All required indexes exist'
        ELSE 'FAIL: ' || (10 - COUNT(*)) || ' indexes missing'
    END as result,
    ARRAY_AGG(indexname ORDER BY indexname) as existing_indexes
FROM pg_indexes
WHERE tablename = 'planning'
AND schemaname = 'public'
AND indexname LIKE 'idx_planning_%';

-- ============================================================================
-- 3단계: 데이터 품질 검증 (Data Quality Validation)
-- ============================================================================

-- 3.1 기본 데이터 품질 체크
SELECT
    '3.1 Basic Data Quality' as test_category,
    'Total Records' as metric,
    COUNT(*) as value,
    'Planning 테이블 총 레코드 수' as description
FROM public.planning;

-- 3.2 NULL 값 검증 (필수 필드)
SELECT
    '3.2 NULL Values Check' as test_category,
    'Non-nullable fields' as metric,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS: No NULL values in required fields'
        ELSE 'FAIL: ' || COUNT(*) || ' records with NULL in required fields'
    END as result,
    COUNT(*) as null_count
FROM public.planning
WHERE id IS NULL
   OR type IS NULL
   OR title IS NULL
   OR content IS NULL
   OR status IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

-- 3.3 storage_status 기본값 검증
SELECT
    '3.3 Default Values Check' as test_category,
    'storage_status defaults' as metric,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS: All storage_status have values'
        ELSE 'FAIL: ' || COUNT(*) || ' records with NULL storage_status'
    END as result,
    COUNT(*) as null_count
FROM public.planning
WHERE storage_status IS NULL;

-- ============================================================================
-- 최종 검증 요약 (Final Validation Summary)
-- ============================================================================

-- 검증 완료 메시지
SELECT 'Planning 테이블 스키마 동기화 검증 완료: ' || NOW() as validation_complete;

-- 체크리스트 출력
SELECT '========================================' as checklist_header;
SELECT 'DATA MIGRATION VALIDATION CHECKLIST' as checklist_title;
SELECT '========================================' as checklist_separator;
SELECT '□ 1. Schema Fields: All required fields exist' as checklist_item;
SELECT '□ 2. Data Types: All field types match Prisma schema' as checklist_item;
SELECT '□ 3. Indexes: All performance indexes created' as checklist_item;
SELECT '□ 4. Data Quality: No NULL values in required fields' as checklist_item;
SELECT '□ 5. Default Values: storage_status defaults applied' as checklist_item;
SELECT '□ 6. Backup: Data backup completed successfully' as checklist_item;
SELECT '========================================' as checklist_footer;

