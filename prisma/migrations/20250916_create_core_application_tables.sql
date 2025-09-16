-- VideoPlanet 핵심 애플리케이션 테이블 생성 마이그레이션
-- Created: 2025-09-16
-- Description: 프로젝트, 스토리, 씬, 시나리오, 프롬프트, 영상 자산, 타임라인 테이블 생성

-- =====================================================
-- 1. PROJECT TABLE (프로젝트 관리)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "tags" JSONB,
    "scenario" TEXT,
    "prompt" TEXT,
    "video" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Project_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 프로젝트 인덱스
CREATE INDEX IF NOT EXISTS "idx_project_user_id" ON "Project"("user_id");
CREATE INDEX IF NOT EXISTS "idx_project_status" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "idx_project_created_at" ON "Project"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_project_updated_at" ON "Project"("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_project_user_status" ON "Project"("user_id", "status");

-- 프로젝트 상태 체크 제약조건
ALTER TABLE "Project" ADD CONSTRAINT "check_project_status"
CHECK ("status" IN ('draft', 'active', 'completed', 'archived', 'failed'));

-- =====================================================
-- 2. STORY TABLE (스토리 템플릿)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "one_line_story" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "tone" TEXT,
    "target" TEXT,
    "structure" JSONB,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Story_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 스토리 인덱스
CREATE INDEX IF NOT EXISTS "idx_story_user_id" ON "Story"("user_id");
CREATE INDEX IF NOT EXISTS "idx_story_genre" ON "Story"("genre");
CREATE INDEX IF NOT EXISTS "idx_story_created_at" ON "Story"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_story_user_genre" ON "Story"("user_id", "genre");

-- =====================================================
-- 3. SCENE TABLE (씬 구성)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Scene" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" JSONB NOT NULL,
    "thumbnail_url" TEXT,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Scene_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 씬 인덱스
CREATE INDEX IF NOT EXISTS "idx_scene_project_id" ON "Scene"("project_id");
CREATE INDEX IF NOT EXISTS "idx_scene_order" ON "Scene"("project_id", "order");
CREATE INDEX IF NOT EXISTS "idx_scene_status" ON "Scene"("status");
CREATE INDEX IF NOT EXISTS "idx_scene_ai_generated" ON "Scene"("ai_generated");
CREATE INDEX IF NOT EXISTS "idx_scene_duration" ON "Scene"("duration");

-- 씬 상태 체크 제약조건
ALTER TABLE "Scene" ADD CONSTRAINT "check_scene_status"
CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- 씬 순서 및 지속시간 체크 제약조건
ALTER TABLE "Scene" ADD CONSTRAINT "check_scene_order" CHECK ("order" >= 0);
ALTER TABLE "Scene" ADD CONSTRAINT "check_scene_duration" CHECK ("duration" > 0);

-- =====================================================
-- 4. SCENARIO TABLE (시나리오)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Scenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "structure4" JSONB,
    "shots12" JSONB,
    "pdf_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Scenario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 시나리오 인덱스
CREATE INDEX IF NOT EXISTS "idx_scenario_user_id" ON "Scenario"("user_id");
CREATE INDEX IF NOT EXISTS "idx_scenario_version" ON "Scenario"("version");
CREATE INDEX IF NOT EXISTS "idx_scenario_created_at" ON "Scenario"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_scenario_title" ON "Scenario"("title");

-- 시나리오 버전 체크 제약조건
ALTER TABLE "Scenario" ADD CONSTRAINT "check_scenario_version" CHECK ("version" >= 1);

-- =====================================================
-- 5. PROMPT TABLE (프롬프트 관리)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Prompt" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "negative" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "ai_analysis" JSONB,
    "cinegenius_version" TEXT DEFAULT '2.0',
    "generation_control" JSONB,
    "project_config" JSONB,
    "project_id" TEXT,
    "user_input" JSONB,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Prompt_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prompt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 프롬프트 인덱스
CREATE INDEX IF NOT EXISTS "idx_prompt_scenario_id" ON "Prompt"("scenario_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_user_id" ON "Prompt"("user_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_version" ON "Prompt"("version");
CREATE INDEX IF NOT EXISTS "idx_prompt_cinegenius_version" ON "Prompt"("cinegenius_version");
CREATE INDEX IF NOT EXISTS "idx_prompt_project_id" ON "Prompt"("project_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_user_id_version" ON "Prompt"("user_id", "cinegenius_version");
CREATE INDEX IF NOT EXISTS "idx_prompt_created_at" ON "Prompt"("created_at" DESC);

-- 프롬프트 체크 제약조건
ALTER TABLE "Prompt" ADD CONSTRAINT "check_prompt_version" CHECK ("version" >= 1);
ALTER TABLE "Prompt" ADD CONSTRAINT "check_cinegenius_version"
CHECK ("cinegenius_version" IN ('2.0', '3.1'));

-- =====================================================
-- 6. VIDEO_ASSET TABLE (영상 자산)
-- =====================================================
CREATE TABLE IF NOT EXISTS "VideoAsset" (
    "id" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "url" TEXT,
    "codec" TEXT,
    "duration" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "generation_metadata" JSONB DEFAULT '{}',
    "quality_score" DECIMAL(3,2) DEFAULT 0.0,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VideoAsset_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoAsset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 영상 자산 인덱스
CREATE INDEX IF NOT EXISTS "idx_videoasset_prompt_id" ON "VideoAsset"("prompt_id");
CREATE INDEX IF NOT EXISTS "idx_videoasset_user_id" ON "VideoAsset"("user_id");
CREATE INDEX IF NOT EXISTS "idx_videoasset_status_provider" ON "VideoAsset"("status", "provider");
CREATE INDEX IF NOT EXISTS "idx_videoasset_provider" ON "VideoAsset"("provider");
CREATE INDEX IF NOT EXISTS "idx_videoasset_status" ON "VideoAsset"("status");
CREATE INDEX IF NOT EXISTS "idx_videoasset_quality_score" ON "VideoAsset"("quality_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_videoasset_created_at" ON "VideoAsset"("created_at" DESC);

-- 영상 자산 체크 제약조건
ALTER TABLE "VideoAsset" ADD CONSTRAINT "check_videoasset_status"
CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

ALTER TABLE "VideoAsset" ADD CONSTRAINT "check_videoasset_provider"
CHECK ("provider" IN ('seedance', 'openai', 'runways', 'luma', 'stable_video'));

ALTER TABLE "VideoAsset" ADD CONSTRAINT "check_videoasset_version" CHECK ("version" >= 1);
ALTER TABLE "VideoAsset" ADD CONSTRAINT "check_videoasset_duration" CHECK ("duration" IS NULL OR "duration" > 0);
ALTER TABLE "VideoAsset" ADD CONSTRAINT "check_quality_score" CHECK ("quality_score" >= 0.0 AND "quality_score" <= 10.0);

-- =====================================================
-- 7. TIMELINE TABLE (타임라인)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Timeline" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "total_duration" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beads" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Timeline_project_id_key" UNIQUE ("project_id"),
    CONSTRAINT "Timeline_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 타임라인 인덱스
CREATE INDEX IF NOT EXISTS "idx_timeline_project_id" ON "Timeline"("project_id");
CREATE INDEX IF NOT EXISTS "idx_timeline_total_duration" ON "Timeline"("total_duration");
CREATE INDEX IF NOT EXISTS "idx_timeline_updated_at" ON "Timeline"("updated_at" DESC);

-- 타임라인 체크 제약조건
ALTER TABLE "Timeline" ADD CONSTRAINT "check_timeline_total_duration" CHECK ("total_duration" >= 0);

-- =====================================================
-- 8. VIDEO_GENERATION TABLE (영상 생성 작업)
-- =====================================================
CREATE TABLE IF NOT EXISTS "video_generations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "seedance_job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "video_url" TEXT,
    "thumbnail_url" TEXT,
    "prompt" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "video_generations_seedance_job_id_key" UNIQUE ("seedance_job_id"),
    CONSTRAINT "video_generations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 영상 생성 인덱스
CREATE INDEX IF NOT EXISTS "idx_video_generations_project_id" ON "video_generations"("project_id");
CREATE INDEX IF NOT EXISTS "idx_video_generations_status" ON "video_generations"("status");
CREATE INDEX IF NOT EXISTS "idx_video_generations_seedance_job_id" ON "video_generations"("seedance_job_id");
CREATE INDEX IF NOT EXISTS "idx_video_generations_created_at" ON "video_generations"("created_at" DESC);

-- 영상 생성 체크 제약조건
ALTER TABLE "video_generations" ADD CONSTRAINT "check_video_generation_status"
CHECK ("status" IN ('queued', 'processing', 'completed', 'failed'));

ALTER TABLE "video_generations" ADD CONSTRAINT "check_video_generation_duration" CHECK ("duration" > 0);

-- =====================================================
-- 9. PRESET TABLE (프리셋)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "data" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB NOT NULL,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Preset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 프리셋 인덱스
CREATE INDEX IF NOT EXISTS "idx_preset_user_id" ON "Preset"("user_id");
CREATE INDEX IF NOT EXISTS "idx_preset_category" ON "Preset"("category");
CREATE INDEX IF NOT EXISTS "idx_preset_is_public" ON "Preset"("is_public");
CREATE INDEX IF NOT EXISTS "idx_preset_rating" ON "Preset"("rating" DESC);
CREATE INDEX IF NOT EXISTS "idx_preset_downloads" ON "Preset"("downloads" DESC);
CREATE INDEX IF NOT EXISTS "idx_preset_created_at" ON "Preset"("created_at" DESC);

-- 프리셋 체크 제약조건
ALTER TABLE "Preset" ADD CONSTRAINT "check_preset_downloads" CHECK ("downloads" >= 0);
ALTER TABLE "Preset" ADD CONSTRAINT "check_preset_rating" CHECK ("rating" >= 0.0 AND "rating" <= 5.0);

-- =====================================================
-- 10. STORY_TEMPLATE TABLE (스토리 템플릿)
-- =====================================================
CREATE TABLE IF NOT EXISTS "story_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "thumbnail_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "story_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 스토리 템플릿 인덱스
CREATE INDEX IF NOT EXISTS "idx_story_templates_category" ON "story_templates"("category");
CREATE INDEX IF NOT EXISTS "idx_story_templates_user_id" ON "story_templates"("user_id");
CREATE INDEX IF NOT EXISTS "idx_story_templates_is_public" ON "story_templates"("is_public");
CREATE INDEX IF NOT EXISTS "idx_story_templates_downloads" ON "story_templates"("downloads" DESC);

-- 스토리 템플릿 체크 제약조건
ALTER TABLE "story_templates" ADD CONSTRAINT "check_story_template_downloads" CHECK ("downloads" >= 0);

-- =====================================================
-- 11. 추가 보조 테이블들
-- =====================================================

-- SHARE_TOKEN TABLE (공유 토큰)
CREATE TABLE IF NOT EXISTS "ShareToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nickname" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{"read": true, "share": false, "write": false}',

    CONSTRAINT "ShareToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShareToken_token_key" UNIQUE ("token"),
    CONSTRAINT "ShareToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 공유 토큰 인덱스
CREATE INDEX IF NOT EXISTS "idx_sharetoken_active" ON "ShareToken"("token", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_sharetoken_role_target" ON "ShareToken"("role", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "idx_sharetoken_user_id" ON "ShareToken"("user_id");

-- COMMENT TABLE (코멘트)
CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "author" TEXT,
    "text" TEXT NOT NULL,
    "timecode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "comment_type" TEXT DEFAULT 'general',
    "feedback_data" JSONB,
    "rating" INTEGER,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 코멘트 인덱스
CREATE INDEX IF NOT EXISTS "idx_comment_type_target" ON "Comment"("comment_type", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "Comment"("user_id");
CREATE INDEX IF NOT EXISTS "idx_comment_created_at" ON "Comment"("created_at" DESC);

-- 코멘트 체크 제약조건
ALTER TABLE "Comment" ADD CONSTRAINT "check_comment_type"
CHECK ("comment_type" IN ('general', 'technical', 'creative', 'quality'));

ALTER TABLE "Comment" ADD CONSTRAINT "check_comment_rating"
CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));

-- UPLOAD TABLE (업로드)
CREATE TABLE IF NOT EXISTS "Upload" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Upload_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 업로드 인덱스
CREATE INDEX IF NOT EXISTS "idx_upload_user_id" ON "Upload"("user_id");
CREATE INDEX IF NOT EXISTS "idx_upload_filename" ON "Upload"("filename");
CREATE INDEX IF NOT EXISTS "idx_upload_mimetype" ON "Upload"("mimetype");
CREATE INDEX IF NOT EXISTS "idx_upload_created_at" ON "Upload"("created_at" DESC);

-- 업로드 체크 제약조건
ALTER TABLE "Upload" ADD CONSTRAINT "check_upload_size" CHECK ("size" > 0);

-- =====================================================
-- 12. 트리거 함수 생성 (자동 updated_at 업데이트)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 updated_at 트리거 추가
CREATE TRIGGER update_project_updated_at BEFORE UPDATE ON "Project" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_story_updated_at BEFORE UPDATE ON "Story" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scene_updated_at BEFORE UPDATE ON "Scene" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scenario_updated_at BEFORE UPDATE ON "Scenario" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompt_updated_at BEFORE UPDATE ON "Prompt" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videoasset_updated_at BEFORE UPDATE ON "VideoAsset" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timeline_updated_at BEFORE UPDATE ON "Timeline" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_generations_updated_at BEFORE UPDATE ON "video_generations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_preset_updated_at BEFORE UPDATE ON "Preset" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_story_templates_updated_at BEFORE UPDATE ON "story_templates" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_upload_updated_at BEFORE UPDATE ON "Upload" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 13. 테이블 코멘트 추가
-- =====================================================
COMMENT ON TABLE "Project" IS '프로젝트 관리 테이블 - 영상 제작 프로젝트의 메타데이터';
COMMENT ON TABLE "Story" IS '스토리 테이블 - 영상 스토리 템플릿 및 구조';
COMMENT ON TABLE "Scene" IS '씬 테이블 - 프로젝트 내 개별 씬 정보';
COMMENT ON TABLE "Scenario" IS '시나리오 테이블 - 영상 시나리오 및 스크립트';
COMMENT ON TABLE "Prompt" IS '프롬프트 테이블 - AI 영상 생성용 프롬프트';
COMMENT ON TABLE "VideoAsset" IS '영상 자산 테이블 - 생성된 영상 파일 정보';
COMMENT ON TABLE "Timeline" IS '타임라인 테이블 - 프로젝트 타임라인 편집 데이터';
COMMENT ON TABLE "video_generations" IS '영상 생성 작업 테이블 - SeeDance API 작업 추적';
COMMENT ON TABLE "Preset" IS '프리셋 테이블 - 사용자 정의 설정 템플릿';
COMMENT ON TABLE "story_templates" IS '스토리 템플릿 테이블 - 재사용 가능한 스토리 구조';

-- =====================================================
-- 14. 마이그레이션 완료 로그
-- =====================================================
INSERT INTO "MigrationLog" (
    "migration_id",
    "migration_name",
    "applied_at",
    "execution_time_ms",
    "status",
    "created_by"
) VALUES (
    '20250916_create_core_application_tables',
    'Create core application tables with proper indexes and constraints',
    CURRENT_TIMESTAMP,
    0,
    'APPLIED',
    'system'
);

-- 마이그레이션 완료 메시지
-- 이 마이그레이션은 VideoPlanet의 핵심 애플리케이션 테이블들을 생성합니다.
-- 모든 테이블은 적절한 인덱스, 외래키, 체크 제약조건을 포함하여 성능과 데이터 무결성을 보장합니다.