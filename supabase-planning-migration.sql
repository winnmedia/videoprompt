-- ============================================================================
-- Supabase Planning 테이블 스키마 동기화 마이그레이션
-- Prisma Schema와 100% 일치하도록 누락된 필드 추가
-- ============================================================================

-- 마이그레이션 시작 시간 기록
SELECT 'Planning 테이블 마이그레이션 시작: ' || NOW() as migration_start;

-- ============================================================================
-- 1단계: 백업 테이블 생성 (안전장치)
-- ============================================================================

-- 기존 데이터 백업 (롤백 시 사용)
CREATE TABLE IF NOT EXISTS public.planning_backup_20250918 AS
SELECT * FROM public.planning;

SELECT 'Planning 데이터 백업 완료. 레코드 수: ' || COUNT(*) as backup_status
FROM public.planning_backup_20250918;

-- ============================================================================
-- 2단계: 누락된 필드 추가 (Non-breaking Changes)
-- ============================================================================

-- project_id 필드 추가 (NULL 허용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planning'
        AND column_name = 'project_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.planning
        ADD COLUMN project_id UUID;

        RAISE NOTICE 'project_id 필드 추가 완료';
    ELSE
        RAISE NOTICE 'project_id 필드가 이미 존재합니다';
    END IF;
END $$;

-- storage 필드 추가 (JSON)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planning'
        AND column_name = 'storage'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.planning
        ADD COLUMN storage JSONB;

        RAISE NOTICE 'storage 필드 추가 완료';
    ELSE
        RAISE NOTICE 'storage 필드가 이미 존재합니다';
    END IF;
END $$;

-- storage_status 필드 추가 (기본값: pending)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planning'
        AND column_name = 'storage_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.planning
        ADD COLUMN storage_status TEXT DEFAULT 'pending';

        -- 기존 레코드에 기본값 설정
        UPDATE public.planning
        SET storage_status = 'pending'
        WHERE storage_status IS NULL;

        RAISE NOTICE 'storage_status 필드 추가 완료';
    ELSE
        RAISE NOTICE 'storage_status 필드가 이미 존재합니다';
    END IF;
END $$;

-- source 필드 추가 (NULL 허용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planning'
        AND column_name = 'source'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.planning
        ADD COLUMN source TEXT;

        RAISE NOTICE 'source 필드 추가 완료';
    ELSE
        RAISE NOTICE 'source 필드가 이미 존재합니다';
    END IF;
END $$;

-- ============================================================================
-- 3단계: 새로운 인덱스 추가 (성능 최적화)
-- ============================================================================

-- project_id 인덱스 (Prisma 스키마와 일치)
CREATE INDEX IF NOT EXISTS idx_planning_project_id
ON public.planning (project_id);

-- storage_status 인덱스 (Prisma 스키마와 일치)
CREATE INDEX IF NOT EXISTS idx_planning_storage_status
ON public.planning (storage_status);

-- storage JSONB 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_planning_storage_gin
ON public.planning USING GIN (storage);

-- 복합 인덱스: user_id + project_id (일반적인 쿼리 패턴)
CREATE INDEX IF NOT EXISTS idx_planning_user_project
ON public.planning (user_id, project_id);

-- 복합 인덱스: project_id + status (프로젝트별 상태 조회)
CREATE INDEX IF NOT EXISTS idx_planning_project_status
ON public.planning (project_id, status);

-- 복합 인덱스: project_id + type (프로젝트별 타입 조회)
CREATE INDEX IF NOT EXISTS idx_planning_project_type
ON public.planning (project_id, type);

SELECT 'Planning 테이블 인덱스 생성 완료' as index_status;

-- ============================================================================
-- 4단계: RLS 정책 업데이트 (project_id 고려)
-- ============================================================================

-- 기존 정책에 project_id 조건 추가를 위해 새로운 정책 생성

-- 정책: 프로젝트 소유자도 접근 가능 (project 테이블 조인 필요)
DROP POLICY IF EXISTS "Users can view project planning data" ON public.planning;
CREATE POLICY "Users can view project planning data" ON public.planning
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR project_id IN (
                SELECT id FROM public.projects
                WHERE user_id = auth.uid()
            )
        )
    );

-- project_id 기반 삽입 정책 (프로젝트 소유자만)
DROP POLICY IF EXISTS "Users can insert project planning data" ON public.planning;
CREATE POLICY "Users can insert project planning data" ON public.planning
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR (
                project_id IS NOT NULL
                AND project_id IN (
                    SELECT id FROM public.projects
                    WHERE user_id = auth.uid()
                )
            )
        )
    );

-- project_id 기반 수정 정책
DROP POLICY IF EXISTS "Users can update project planning data" ON public.planning;
CREATE POLICY "Users can update project planning data" ON public.planning
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR project_id IN (
                SELECT id FROM public.projects
                WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR project_id IN (
                SELECT id FROM public.projects
                WHERE user_id = auth.uid()
            )
        )
    );

-- project_id 기반 삭제 정책
DROP POLICY IF EXISTS "Users can delete project planning data" ON public.planning;
CREATE POLICY "Users can delete project planning data" ON public.planning
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR project_id IN (
                SELECT id FROM public.projects
                WHERE user_id = auth.uid()
            )
        )
    );

-- Service Role 전체 액세스 (서버 측 작업용) - 기존 유지
DROP POLICY IF EXISTS "Service role has full access" ON public.planning;
CREATE POLICY "Service role has full access" ON public.planning
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

SELECT 'Planning 테이블 RLS 정책 업데이트 완료' as rls_status;

-- ============================================================================
-- 5단계: 데이터 무결성 검증
-- ============================================================================

-- 스키마 일치 검증
SELECT
    'Schema Validation' as check_type,
    CASE
        WHEN COUNT(*) = 4 THEN 'PASS: 모든 필드 존재'
        ELSE 'FAIL: 누락된 필드 있음'
    END as result,
    COUNT(*) as field_count
FROM information_schema.columns
WHERE table_name = 'planning'
AND table_schema = 'public'
AND column_name IN ('project_id', 'storage', 'storage_status', 'source');

-- 기본값 설정 검증
SELECT
    'Default Values' as check_type,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS: storage_status 기본값 적용'
        ELSE 'FAIL: NULL 값 존재'
    END as result,
    COUNT(*) as null_count
FROM public.planning
WHERE storage_status IS NULL;

-- 인덱스 존재 검증
SELECT
    'Index Validation' as check_type,
    CASE
        WHEN COUNT(*) >= 6 THEN 'PASS: 필수 인덱스 존재'
        ELSE 'FAIL: 인덱스 누락'
    END as result,
    COUNT(*) as index_count
FROM pg_indexes
WHERE tablename = 'planning'
AND indexname LIKE 'idx_planning_%'
AND indexname IN (
    'idx_planning_project_id',
    'idx_planning_storage_status',
    'idx_planning_storage_gin',
    'idx_planning_user_project',
    'idx_planning_project_status',
    'idx_planning_project_type'
);

-- ============================================================================
-- 6단계: 마이그레이션 완료 기록
-- ============================================================================

-- 마이그레이션 로그 기록 (추적 가능성)
INSERT INTO public.migration_log (
    migration_id,
    migration_name,
    applied_at,
    execution_time_ms,
    status,
    metadata,
    created_by
) VALUES (
    'planning_schema_sync_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
    'Planning Table Schema Synchronization with Prisma',
    NOW(),
    0, -- 실행 시간은 별도 측정 필요
    'APPLIED',
    jsonb_build_object(
        'added_fields', array['project_id', 'storage', 'storage_status', 'source'],
        'added_indexes', array['idx_planning_project_id', 'idx_planning_storage_status', 'idx_planning_storage_gin', 'idx_planning_user_project', 'idx_planning_project_status', 'idx_planning_project_type'],
        'updated_policies', array['project_id based RLS policies'],
        'backup_table', 'planning_backup_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MI')
    ),
    'data_lead_daniel'
);

-- 최종 스키마 상태 리포트
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    'Added in migration' as notes
FROM information_schema.columns
WHERE table_name = 'planning'
AND table_schema = 'public'
AND column_name IN ('project_id', 'storage', 'storage_status', 'source')
ORDER BY ordinal_position;

SELECT 'Planning 테이블 스키마 동기화 마이그레이션 완료: ' || NOW() as migration_complete;

-- ============================================================================
-- 롤백 스크립트 (비상시 사용)
-- ============================================================================

/*
-- 롤백이 필요한 경우 아래 스크립트 사용:

-- 1. 추가된 필드 제거
ALTER TABLE public.planning DROP COLUMN IF EXISTS project_id;
ALTER TABLE public.planning DROP COLUMN IF EXISTS storage;
ALTER TABLE public.planning DROP COLUMN IF EXISTS storage_status;
ALTER TABLE public.planning DROP COLUMN IF EXISTS source;

-- 2. 추가된 인덱스 제거
DROP INDEX IF EXISTS idx_planning_project_id;
DROP INDEX IF EXISTS idx_planning_storage_status;
DROP INDEX IF EXISTS idx_planning_storage_gin;
DROP INDEX IF EXISTS idx_planning_user_project;
DROP INDEX IF EXISTS idx_planning_project_status;
DROP INDEX IF EXISTS idx_planning_project_type;

-- 3. RLS 정책 원복 (기존 정책으로)
-- (원본 create-planning-table.sql의 정책들로 복원)

-- 4. 백업에서 데이터 복원 (필요시)
-- TRUNCATE public.planning;
-- INSERT INTO public.planning SELECT * FROM public.planning_backup_20250918;
*/

