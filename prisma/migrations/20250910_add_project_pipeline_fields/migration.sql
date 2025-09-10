-- Migration to add scenario, prompt, video fields to Project table
-- for data persistence in story generation pipeline

-- Add new fields for project pipeline data
ALTER TABLE "Project" ADD COLUMN "scenario" TEXT;
ALTER TABLE "Project" ADD COLUMN "prompt" TEXT;  
ALTER TABLE "Project" ADD COLUMN "video" TEXT;

-- Update status field to use new enum values
-- (existing values will remain as they are)

-- Make tags field nullable for new simplified projects
ALTER TABLE "Project" ALTER COLUMN "tags" DROP NOT NULL;