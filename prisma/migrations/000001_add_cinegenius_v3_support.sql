-- CineGenius v3.1 지원을 위한 마이그레이션
-- 기존 데이터는 건드리지 않고, 새로운 필드만 추가

-- 1. Prompt 테이블에 v3.1 지원 필드 추가
ALTER TABLE "Prompt" 
ADD COLUMN "project_id" TEXT,
ADD COLUMN "cinegenius_version" TEXT DEFAULT '2.0',
ADD COLUMN "project_config" JSONB,
ADD COLUMN "user_input" JSONB,
ADD COLUMN "generation_control" JSONB,
ADD COLUMN "ai_analysis" JSONB;

-- 2. 인덱스 추가 (검색 성능 향상)
CREATE INDEX "idx_prompt_cinegenius_version" ON "Prompt"("cinegenius_version");
CREATE INDEX "idx_prompt_project_id" ON "Prompt"("project_id");
CREATE INDEX "idx_prompt_user_id_version" ON "Prompt"("user_id", "cinegenius_version");

-- 3. VideoAsset 테이블에 v3.1 메타데이터 추가
ALTER TABLE "VideoAsset" 
ADD COLUMN "generation_metadata" JSONB,
ADD COLUMN "quality_score" DECIMAL(3,2) DEFAULT 0.0;

-- 4. 인덱스 추가
CREATE INDEX "idx_video_asset_quality_score" ON "VideoAsset"("quality_score");

-- 5. ShareToken 테이블에 v3.1 지원
ALTER TABLE "ShareToken" 
ADD COLUMN "permissions" JSONB DEFAULT '{"canView": true, "canComment": false}';

-- 6. Comment 테이블에 구조화된 피드백 지원
ALTER TABLE "Comment" 
ADD COLUMN "comment_type" TEXT DEFAULT 'general',
ADD COLUMN "feedback_data" JSONB,
ADD COLUMN "rating" INTEGER CHECK ("rating" >= 1 AND "rating" <= 5);

-- 7. 인덱스 추가
CREATE INDEX "idx_comment_type_rating" ON "Comment"("comment_type", "rating");

-- 8. 마이그레이션 로그 테이블 생성
CREATE TABLE "MigrationLog" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "execution_time_ms" INTEGER,
    "records_affected" INTEGER DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    
    CONSTRAINT "MigrationLog_pkey" PRIMARY KEY ("id")
);

-- 9. 마이그레이션 실행 로그
INSERT INTO "MigrationLog" ("id", "version", "description", "records_affected") 
VALUES (
    gen_random_uuid()::text, 
    '3.1.0', 
    'Add CineGenius v3.1 support fields', 
    0
);

-- 10. 기존 Prompt 데이터에 대한 기본값 설정 (선택적)
-- 이미 존재하는 레코드들의 project_id는 NULL로 유지 (마이그레이션 스크립트에서 처리)

-- 11. 체크 제약조건 추가
ALTER TABLE "Prompt" 
ADD CONSTRAINT "check_cinegenius_version" 
CHECK ("cinegenius_version" IN ('2.0', '3.1'));

ALTER TABLE "Comment" 
ADD CONSTRAINT "check_comment_type" 
CHECK ("comment_type" IN ('general', 'technical', 'creative', 'quality'));

-- 12. 새로운 열에 대한 설명 추가 (PostgreSQL 전용)
COMMENT ON COLUMN "Prompt"."project_id" IS 'CineGenius v3.1 프로젝트 UUID';
COMMENT ON COLUMN "Prompt"."cinegenius_version" IS '프롬프트 버전 (2.0 = Legacy, 3.1 = CineGenius)';
COMMENT ON COLUMN "Prompt"."project_config" IS 'v3.1 프로젝트 설정 (JSON)';
COMMENT ON COLUMN "Prompt"."user_input" IS 'v3.1 사용자 입력 (JSON)';
COMMENT ON COLUMN "Prompt"."generation_control" IS 'v3.1 생성 제어 (JSON)';
COMMENT ON COLUMN "Prompt"."ai_analysis" IS 'v3.1 AI 분석 결과 (JSON)';

COMMENT ON COLUMN "VideoAsset"."generation_metadata" IS '생성 메타데이터 (AI 모델, 파라미터 등)';
COMMENT ON COLUMN "VideoAsset"."quality_score" IS '자동 품질 평가 점수 (0.0-10.0)';

COMMENT ON COLUMN "Comment"."comment_type" IS '코멘트 유형 분류';
COMMENT ON COLUMN "Comment"."feedback_data" IS '구조화된 피드백 데이터';
COMMENT ON COLUMN "Comment"."rating" IS '5점 만점 평가 (1-5)';

-- 완료 메시지
-- 이 마이그레이션은 안전하게 롤백 가능합니다
-- 기존 데이터는 변경되지 않으며, 새로운 필드만 추가됩니다