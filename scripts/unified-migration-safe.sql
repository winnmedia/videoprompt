-- =============================================================================
-- VideoPlanet 안전한 통합 마이그레이션 스크립트
-- 생성일: 2025-01-18
-- 목적: 중복 방지 및 데이터 무결성 보장하는 마이그레이션 실행
-- 담당: Backend Lead Benjamin
-- =============================================================================

-- 마이그레이션 로그 테이블 생성 (존재하지 않는 경우)
CREATE TABLE IF NOT EXISTS "MigrationLog" (
    "id" SERIAL PRIMARY KEY,
    "migration_id" TEXT NOT NULL UNIQUE,
    "migration_name" TEXT NOT NULL,
    "applied_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'STARTING',
    "execution_time_ms" BIGINT,
    "created_by" TEXT NOT NULL DEFAULT 'backend_lead_benjamin',
    "metadata" JSONB DEFAULT '{}'::jsonb
);

-- 마이그레이션 시작 로깅
INSERT INTO "MigrationLog" (
    "migration_id",
    "migration_name",
    "status",
    "created_by"
) VALUES (
    'unified_migration_2025_01_18',
    'Unified safe migration resolving conflicts and adding missing fields',
    'STARTING',
    'backend_lead_benjamin'
) ON CONFLICT (migration_id) DO NOTHING;

-- =============================================================================
-- PHASE 1: 백업 생성 (데이터 보전)
-- =============================================================================

-- 1.1. Scenario 테이블 백업
CREATE TABLE IF NOT EXISTS "Scenario_backup_unified" AS
SELECT * FROM "Scenario";

-- 1.2. Prompt 테이블 백업
CREATE TABLE IF NOT EXISTS "Prompt_backup_unified" AS
SELECT * FROM "Prompt";

RAISE NOTICE 'BACKUP COMPLETED: Scenario_backup_unified, Prompt_backup_unified';

-- =============================================================================
-- PHASE 2: Scenario 테이블 안전한 컬럼 추가
-- =============================================================================

-- 2.1. project_id 컬럼 추가 (IF NOT EXISTS로 중복 방지)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'project_id') THEN
        ALTER TABLE "Scenario" ADD COLUMN "project_id" TEXT;
        RAISE NOTICE 'ADDED: Scenario.project_id column';
    ELSE
        RAISE NOTICE 'SKIPPED: Scenario.project_id already exists';
    END IF;
END $$;

-- 2.2. 기타 누락된 Scenario 필드들 안전하게 추가
DO $$
BEGIN
    -- story 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'story') THEN
        ALTER TABLE "Scenario" ADD COLUMN "story" TEXT;
        RAISE NOTICE 'ADDED: Scenario.story column';
    END IF;

    -- genre 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'genre') THEN
        ALTER TABLE "Scenario" ADD COLUMN "genre" TEXT;
        RAISE NOTICE 'ADDED: Scenario.genre column';
    END IF;

    -- tone 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'tone') THEN
        ALTER TABLE "Scenario" ADD COLUMN "tone" TEXT;
        RAISE NOTICE 'ADDED: Scenario.tone column';
    END IF;

    -- target 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'target') THEN
        ALTER TABLE "Scenario" ADD COLUMN "target" TEXT;
        RAISE NOTICE 'ADDED: Scenario.target column';
    END IF;

    -- format 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'format') THEN
        ALTER TABLE "Scenario" ADD COLUMN "format" TEXT;
        RAISE NOTICE 'ADDED: Scenario.format column';
    END IF;

    -- tempo 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'tempo') THEN
        ALTER TABLE "Scenario" ADD COLUMN "tempo" TEXT;
        RAISE NOTICE 'ADDED: Scenario.tempo column';
    END IF;

    -- development_method 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'development_method') THEN
        ALTER TABLE "Scenario" ADD COLUMN "development_method" TEXT;
        RAISE NOTICE 'ADDED: Scenario.development_method column';
    END IF;

    -- development_intensity 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'development_intensity') THEN
        ALTER TABLE "Scenario" ADD COLUMN "development_intensity" TEXT;
        RAISE NOTICE 'ADDED: Scenario.development_intensity column';
    END IF;

    -- duration_sec 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'duration_sec') THEN
        ALTER TABLE "Scenario" ADD COLUMN "duration_sec" INTEGER;
        RAISE NOTICE 'ADDED: Scenario.duration_sec column';
    END IF;

    -- source 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'source') THEN
        ALTER TABLE "Scenario" ADD COLUMN "source" TEXT DEFAULT 'user';
        RAISE NOTICE 'ADDED: Scenario.source column';
    END IF;

    -- status 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'status') THEN
        ALTER TABLE "Scenario" ADD COLUMN "status" TEXT DEFAULT 'draft';
        RAISE NOTICE 'ADDED: Scenario.status column';
    END IF;

    -- storage_status 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'storage_status') THEN
        ALTER TABLE "Scenario" ADD COLUMN "storage_status" TEXT DEFAULT 'pending';
        RAISE NOTICE 'ADDED: Scenario.storage_status column';
    END IF;

    -- storage 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'storage') THEN
        ALTER TABLE "Scenario" ADD COLUMN "storage" TEXT;
        RAISE NOTICE 'ADDED: Scenario.storage column';
    END IF;

    -- metadata 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Scenario' AND column_name = 'metadata') THEN
        ALTER TABLE "Scenario" ADD COLUMN "metadata" TEXT;
        RAISE NOTICE 'ADDED: Scenario.metadata column';
    END IF;
END $$;

-- =============================================================================
-- PHASE 3: Prompt 테이블 누락 필드 추가
-- =============================================================================

DO $$
BEGIN
    -- final_prompt 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'final_prompt') THEN
        ALTER TABLE "Prompt" ADD COLUMN "final_prompt" TEXT;
        RAISE NOTICE 'ADDED: Prompt.final_prompt column';
    END IF;

    -- keywords 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'keywords') THEN
        ALTER TABLE "Prompt" ADD COLUMN "keywords" TEXT;
        RAISE NOTICE 'ADDED: Prompt.keywords column';
    END IF;

    -- source 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'source') THEN
        ALTER TABLE "Prompt" ADD COLUMN "source" TEXT DEFAULT 'user';
        RAISE NOTICE 'ADDED: Prompt.source column';
    END IF;

    -- status 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'status') THEN
        ALTER TABLE "Prompt" ADD COLUMN "status" TEXT DEFAULT 'draft';
        RAISE NOTICE 'ADDED: Prompt.status column';
    END IF;

    -- storage_status 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'storage_status') THEN
        ALTER TABLE "Prompt" ADD COLUMN "storage_status" TEXT DEFAULT 'pending';
        RAISE NOTICE 'ADDED: Prompt.storage_status column';
    END IF;

    -- storage 필드
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'Prompt' AND column_name = 'storage') THEN
        ALTER TABLE "Prompt" ADD COLUMN "storage" TEXT;
        RAISE NOTICE 'ADDED: Prompt.storage column';
    END IF;
END $$;

-- =============================================================================
-- PHASE 4: Video 테이블 생성 (존재하지 않는 경우만)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
    "video_url" TEXT,
    "thumbnail_url" TEXT,
    "processing_job_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "storage_status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "storage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_video_project" FOREIGN KEY ("project_id") REFERENCES "Project"("id")
);

-- =============================================================================
-- PHASE 5: 외래키 제약조건 안전하게 추가
-- =============================================================================

-- 5.1. Scenario.project_id 외래키 (중복 방지)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'Scenario_project_id_fkey') THEN
        ALTER TABLE "Scenario"
        ADD CONSTRAINT "Scenario_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "Project"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'ADDED: Scenario.project_id foreign key constraint';
    ELSE
        RAISE NOTICE 'SKIPPED: Scenario.project_id foreign key already exists';
    END IF;
END $$;

-- =============================================================================
-- PHASE 6: 성능 인덱스 추가 (중복 방지)
-- =============================================================================

-- 6.1. Scenario 테이블 인덱스
CREATE INDEX IF NOT EXISTS "idx_scenario_project_id" ON "Scenario"("project_id");
CREATE INDEX IF NOT EXISTS "idx_scenario_user_project" ON "Scenario"("user_id", "project_id");
CREATE INDEX IF NOT EXISTS "idx_scenario_status" ON "Scenario"("status");

-- 6.2. Video 테이블 인덱스
CREATE INDEX IF NOT EXISTS "idx_video_project_id" ON "Video"("project_id");
CREATE INDEX IF NOT EXISTS "idx_video_status" ON "Video"("status");

-- 6.3. Prompt 테이블 인덱스
CREATE INDEX IF NOT EXISTS "idx_prompt_status" ON "Prompt"("status");
CREATE INDEX IF NOT EXISTS "idx_prompt_project_id" ON "Prompt"("project_id");

RAISE NOTICE 'PERFORMANCE INDEXES: All indexes created or verified';

-- =============================================================================
-- PHASE 7: 데이터 마이그레이션 (기존 Scenario에 project_id 할당)
-- =============================================================================

-- 7.1. 기존 Scenario 레코드의 project_id 설정
DO $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    UPDATE "Scenario"
    SET "project_id" = (
        SELECT p.id
        FROM "Project" p
        WHERE p.user_id = "Scenario".user_id
        ORDER BY p.created_at ASC
        LIMIT 1
    )
    WHERE "project_id" IS NULL
    AND "user_id" IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p.user_id = "Scenario".user_id
    );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'DATA MIGRATION: % Scenario records linked to Projects', updated_count;
END $$;

-- =============================================================================
-- PHASE 8: 최종 검증 및 로깅
-- =============================================================================

-- 8.1. 데이터 일관성 검증
DO $$
DECLARE
    scenario_count INTEGER;
    linked_scenarios INTEGER;
    orphaned_scenarios INTEGER;
    integrity_check BOOLEAN := TRUE;
BEGIN
    SELECT COUNT(*) INTO scenario_count FROM "Scenario";
    SELECT COUNT(*) INTO linked_scenarios FROM "Scenario" WHERE project_id IS NOT NULL;
    SELECT COUNT(*) INTO orphaned_scenarios FROM "Scenario" WHERE project_id IS NULL;

    RAISE NOTICE 'FINAL VERIFICATION:';
    RAISE NOTICE '  - Total Scenarios: %', scenario_count;
    RAISE NOTICE '  - Linked to Projects: %', linked_scenarios;
    RAISE NOTICE '  - Orphaned Records: %', orphaned_scenarios;

    IF orphaned_scenarios > 0 THEN
        RAISE WARNING 'DATA QUALITY: % orphaned Scenario records need attention', orphaned_scenarios;
    END IF;
END $$;

-- 8.2. 마이그레이션 완료 로깅
UPDATE "MigrationLog"
SET
    "status" = 'COMPLETED',
    "execution_time_ms" = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - applied_at)) * 1000,
    "metadata" = jsonb_build_object(
        'backup_tables', ARRAY['Scenario_backup_unified', 'Prompt_backup_unified'],
        'schema_changes', 'scenario_fields_added,prompt_fields_added,video_table_created',
        'indexes_added', 'performance_indexes_created',
        'data_migration', 'scenario_project_linking_completed',
        'rollback_available', true
    )
WHERE "migration_id" = 'unified_migration_2025_01_18';

-- =============================================================================
-- 마이그레이션 완료 메시지
-- =============================================================================

RAISE NOTICE '=============================================================================';
RAISE NOTICE 'UNIFIED MIGRATION COMPLETED SUCCESSFULLY';
RAISE NOTICE 'Backend Lead: Benjamin | Date: 2025-01-18';
RAISE NOTICE 'Changes Applied:';
RAISE NOTICE '  ✓ Scenario table: project_id + planning fields added safely';
RAISE NOTICE '  ✓ Prompt table: missing infrastructure fields added';
RAISE NOTICE '  ✓ Video table: created with proper constraints';
RAISE NOTICE '  ✓ Performance indexes: added for optimal query performance';
RAISE NOTICE '  ✓ Data migration: existing scenarios linked to projects';
RAISE NOTICE 'Backups Available: Scenario_backup_unified, Prompt_backup_unified';
RAISE NOTICE '=============================================================================';

-- =============================================================================
-- ROLLBACK SCRIPT (주석으로 보관 - 필요시 별도 실행)
-- =============================================================================
/*
-- 롤백이 필요한 경우 아래 스크립트를 별도로 실행:

-- 1. 백업에서 데이터 복원
TRUNCATE TABLE "Scenario";
INSERT INTO "Scenario" SELECT * FROM "Scenario_backup_unified";

TRUNCATE TABLE "Prompt";
INSERT INTO "Prompt" SELECT * FROM "Prompt_backup_unified";

-- 2. 추가된 컬럼들 제거
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "story";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "genre";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "tone";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "target";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "format";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "tempo";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "development_method";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "development_intensity";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "duration_sec";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "source";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "storage_status";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "storage";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "metadata";

ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "final_prompt";
ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "keywords";
ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "source";
ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "storage_status";
ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "storage";

-- 3. Video 테이블 삭제
DROP TABLE IF EXISTS "Video";

-- 4. 인덱스 제거
DROP INDEX IF EXISTS "idx_scenario_project_id";
DROP INDEX IF EXISTS "idx_scenario_user_project";
DROP INDEX IF EXISTS "idx_scenario_status";
DROP INDEX IF EXISTS "idx_video_project_id";
DROP INDEX IF EXISTS "idx_video_status";
DROP INDEX IF EXISTS "idx_prompt_status";
DROP INDEX IF EXISTS "idx_prompt_project_id";

-- 5. 롤백 로깅
INSERT INTO "MigrationLog" (migration_id, migration_name, status, created_by)
VALUES ('unified_migration_2025_01_18_rollback', 'Rollback: Unified Migration', 'ROLLBACK_COMPLETED', 'backend_lead_benjamin');
*/