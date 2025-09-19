-- Migration: Add missing fields for FSD Architecture compliance
-- Date: 2025-01-18
-- Purpose: Fix Prisma schema inconsistencies with infrastructure layer

-- 1. Add projectId to Scenario model
ALTER TABLE "Scenario" ADD COLUMN "project_id" TEXT;
ALTER TABLE "Scenario" ADD CONSTRAINT "fk_scenario_project"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id");

-- 2. Create Video model (separate from VideoGeneration)
CREATE TABLE "Video" (
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
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fk_video_project" FOREIGN KEY ("project_id") REFERENCES "Project"("id")
);

-- 3. Add missing fields to Prompt model for infrastructure compatibility
ALTER TABLE "Prompt" ADD COLUMN "final_prompt" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "keywords" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "source" TEXT DEFAULT 'user';
ALTER TABLE "Prompt" ADD COLUMN "status" TEXT DEFAULT 'draft';
ALTER TABLE "Prompt" ADD COLUMN "storage_status" TEXT DEFAULT 'pending';
ALTER TABLE "Prompt" ADD COLUMN "storage" TEXT;

-- 4. Add missing fields to Scenario model for infrastructure compatibility
ALTER TABLE "Scenario" ADD COLUMN "story" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "genre" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "tone" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "target" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "format" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "tempo" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "development_method" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "development_intensity" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "duration_sec" INTEGER;
ALTER TABLE "Scenario" ADD COLUMN "source" TEXT DEFAULT 'user';
ALTER TABLE "Scenario" ADD COLUMN "status" TEXT DEFAULT 'draft';
ALTER TABLE "Scenario" ADD COLUMN "storage_status" TEXT DEFAULT 'pending';
ALTER TABLE "Scenario" ADD COLUMN "storage" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "metadata" TEXT;

-- 5. Create indexes for performance
CREATE INDEX "idx_scenario_project_id" ON "Scenario"("project_id");
CREATE INDEX "idx_video_project_id" ON "Video"("project_id");
CREATE INDEX "idx_video_status" ON "Video"("status");
CREATE INDEX "idx_prompt_status" ON "Prompt"("status");
CREATE INDEX "idx_scenario_status" ON "Scenario"("status");

-- 6. Comments for documentation
COMMENT ON TABLE "Video" IS 'FSD entities/planning Video domain model';
COMMENT ON COLUMN "Scenario"."project_id" IS 'Foreign key to Project for FSD architecture compliance';
COMMENT ON COLUMN "Video"."storage" IS 'JSON field for dual storage status tracking';