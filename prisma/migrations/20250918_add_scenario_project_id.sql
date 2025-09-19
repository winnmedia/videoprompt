-- =============================================================================
-- VideoPlanet 데이터 무결성 보장 마이그레이션
-- Migration: 20250918_add_scenario_project_id
-- Data Lead: Daniel
-- =============================================================================
-- 목적: Scenario 테이블에 project_id 필드 안전하게 추가
-- 전략: 점진적 마이그레이션 + 데이터 보전 + 롤백 가능성 확보
-- =============================================================================

-- 마이그레이션 시작 로깅
INSERT INTO "MigrationLog" (
    "migration_id",
    "migration_name",
    "applied_at",
    "status",
    "created_by"
) VALUES (
    '20250918_add_scenario_project_id',
    'Add project_id field to Scenario table with data integrity safeguards',
    CURRENT_TIMESTAMP,
    'STARTING',
    'data_lead_daniel'
);

-- =============================================================================
-- PHASE 1: 사전 검증 (Pre-flight Checks)
-- =============================================================================

-- 1.1. 현재 Scenario 테이블 데이터 개수 확인
DO $$
DECLARE
    scenario_count INTEGER;
    project_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO scenario_count FROM "Scenario";
    SELECT COUNT(*) INTO project_count FROM "Project";

    RAISE NOTICE 'PRE-MIGRATION STATUS:';
    RAISE NOTICE '  - Scenario records: %', scenario_count;
    RAISE NOTICE '  - Project records: %', project_count;

    -- 데이터 무결성 경고
    IF scenario_count > 0 AND project_count = 0 THEN
        RAISE WARNING 'RISK: Scenario records exist but no Project records found!';
    END IF;
END $$;

-- 1.2. 현재 Scenario 테이블 구조 백업 (데이터 보전)
CREATE TABLE IF NOT EXISTS "Scenario_backup_20250918" AS
SELECT * FROM "Scenario";

COMMENT ON TABLE "Scenario_backup_20250918" IS
'Backup of Scenario table before adding project_id field - Created by Data Lead Daniel';

-- =============================================================================
-- PHASE 2: 스키마 변경 (Schema Modification)
-- =============================================================================

-- 2.1. project_id 컬럼 추가 (NULL 허용으로 기존 데이터 보호)
ALTER TABLE "Scenario"
ADD COLUMN IF NOT EXISTS "project_id" TEXT;

-- 2.2. 외래키 제약조건 추가 (참조 무결성 보장)
ALTER TABLE "Scenario"
ADD CONSTRAINT "Scenario_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- 2.3. 성능 최적화를 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_scenario_project_id" ON "Scenario"("project_id");
CREATE INDEX IF NOT EXISTS "idx_scenario_user_project" ON "Scenario"("user_id", "project_id");

-- =============================================================================
-- PHASE 3: 데이터 무결성 검증 및 기본값 설정 (Data Validation)
-- =============================================================================

-- 3.1. 기존 Scenario 레코드의 project_id 설정 전략
-- 전략: 같은 사용자의 첫 번째 프로젝트와 연결 (안전한 기본값)
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

-- 3.2. 연결되지 않은 레코드 리포트 (데이터 품질 확인)
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM "Scenario"
    WHERE "project_id" IS NULL;

    IF orphaned_count > 0 THEN
        RAISE WARNING 'DATA QUALITY ALERT: % Scenario records without project_id', orphaned_count;
        RAISE NOTICE 'These records may need manual intervention or default project assignment';
    ELSE
        RAISE NOTICE 'DATA QUALITY CHECK: All Scenario records successfully linked to Projects';
    END IF;
END $$;

-- =============================================================================
-- PHASE 4: 최종 검증 및 제약조건 (Final Validation)
-- =============================================================================

-- 4.1. 데이터 일관성 최종 검증
DO $$
DECLARE
    integrity_check BOOLEAN := TRUE;
    invalid_refs INTEGER;
BEGIN
    -- 참조 무결성 검증
    SELECT COUNT(*) INTO invalid_refs
    FROM "Scenario" s
    LEFT JOIN "Project" p ON s.project_id = p.id
    WHERE s.project_id IS NOT NULL AND p.id IS NULL;

    IF invalid_refs > 0 THEN
        integrity_check := FALSE;
        RAISE EXCEPTION 'MIGRATION FAILED: % invalid project_id references found', invalid_refs;
    END IF;

    RAISE NOTICE 'INTEGRITY CHECK: % - All project_id references are valid',
        CASE WHEN integrity_check THEN 'PASSED' ELSE 'FAILED' END;
END $$;

-- 4.2. 마이그레이션 통계 수집
DO $$
DECLARE
    total_scenarios INTEGER;
    linked_scenarios INTEGER;
    orphaned_scenarios INTEGER;
    link_percentage DECIMAL;
BEGIN
    SELECT COUNT(*) INTO total_scenarios FROM "Scenario";
    SELECT COUNT(*) INTO linked_scenarios FROM "Scenario" WHERE project_id IS NOT NULL;
    SELECT COUNT(*) INTO orphaned_scenarios FROM "Scenario" WHERE project_id IS NULL;

    IF total_scenarios > 0 THEN
        link_percentage := (linked_scenarios::DECIMAL / total_scenarios::DECIMAL) * 100;
    ELSE
        link_percentage := 100;
    END IF;

    RAISE NOTICE 'MIGRATION STATISTICS:';
    RAISE NOTICE '  - Total Scenarios: %', total_scenarios;
    RAISE NOTICE '  - Linked to Projects: % (%.1f%%)', linked_scenarios, link_percentage;
    RAISE NOTICE '  - Orphaned Records: %', orphaned_scenarios;
END $$;

-- =============================================================================
-- PHASE 5: 스키마 동기화 업데이트 (Schema Documentation)
-- =============================================================================

-- 5.1. 테이블 및 컬럼 코멘트 업데이트
COMMENT ON COLUMN "Scenario"."project_id" IS
'프로젝트 참조 ID - Project 테이블과 외래키 관계, NULL 허용 (기존 데이터 호환성)';

-- 5.2. 마이그레이션 완료 로깅
UPDATE "MigrationLog"
SET
    "status" = 'COMPLETED',
    "execution_time_ms" = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - applied_at)) * 1000,
    "metadata" = jsonb_build_object(
        'phase', 'completed',
        'backup_table', 'Scenario_backup_20250918',
        'data_integrity', 'verified',
        'rollback_available', true
    )
WHERE "migration_id" = '20250918_add_scenario_project_id';

-- =============================================================================
-- ROLLBACK SCRIPT (별도 실행 시에만 사용)
-- =============================================================================
/*
-- 롤백이 필요한 경우 아래 스크립트 실행:

-- 1. 백업에서 데이터 복원
DROP TABLE IF EXISTS "Scenario_rollback_temp";
CREATE TABLE "Scenario_rollback_temp" AS SELECT * FROM "Scenario";

TRUNCATE TABLE "Scenario";
INSERT INTO "Scenario" (id, title, logline, structure4, shots12, pdf_url, version, created_by, created_at, updated_at, user_id)
SELECT id, title, logline, structure4, shots12, pdf_url, version, created_by, created_at, updated_at, user_id
FROM "Scenario_backup_20250918";

-- 2. project_id 컬럼 제거
ALTER TABLE "Scenario" DROP CONSTRAINT IF EXISTS "Scenario_project_id_fkey";
DROP INDEX IF EXISTS "idx_scenario_project_id";
DROP INDEX IF EXISTS "idx_scenario_user_project";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "project_id";

-- 3. 롤백 로깅
INSERT INTO "MigrationLog" (migration_id, migration_name, status, created_by)
VALUES ('20250918_rollback_scenario_project_id', 'Rollback: Remove project_id from Scenario', 'ROLLBACK_COMPLETED', 'data_lead_daniel');
*/

RAISE NOTICE '=============================================================================';
RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
RAISE NOTICE 'Data Lead: Daniel | Migration: 20250918_add_scenario_project_id';
RAISE NOTICE 'Backup available: Scenario_backup_20250918';
RAISE NOTICE 'Rollback script available in migration comments';
RAISE NOTICE '=============================================================================';