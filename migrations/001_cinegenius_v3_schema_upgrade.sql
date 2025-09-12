-- =====================================================
-- VideoPlanet CineGenius v3 Schema Migration
-- Migration ID: 001_cinegenius_v3_schema_upgrade
-- Author: Daniel (Data Lead)
-- Date: 2025-09-13
-- Description: Safe schema upgrade for CineGenius v3 compatibility
-- =====================================================

-- Transaction safety: All operations in single transaction
BEGIN;

-- =====================================================
-- 1. CREATE MIGRATION LOG TABLE
-- =====================================================
-- Contract: MigrationLog table for version control and rollback capability
CREATE TABLE IF NOT EXISTS "MigrationLog" (
    id SERIAL PRIMARY KEY,
    migration_id VARCHAR(100) NOT NULL UNIQUE,
    migration_name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rollback_script TEXT,
    checksum VARCHAR(64) NOT NULL,
    execution_time_ms INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'ROLLED_BACK', 'FAILED')),
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_migration_log_applied_at ON "MigrationLog"(applied_at);
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON "MigrationLog"(status);

-- =====================================================
-- 2. VIDEOASSET TABLE - ADD CINEGENIUS V3 FIELDS
-- =====================================================
-- Contract: Backward compatible field additions with safe defaults
DO $$
BEGIN
    -- Add generation_metadata field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'generation_metadata'
    ) THEN
        ALTER TABLE "VideoAsset" 
        ADD COLUMN generation_metadata JSONB DEFAULT '{}' NOT NULL;
        
        RAISE NOTICE 'Added generation_metadata to VideoAsset table';
    ELSE
        RAISE NOTICE 'generation_metadata already exists in VideoAsset table';
    END IF;

    -- Add quality_score field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'quality_score'
    ) THEN
        ALTER TABLE "VideoAsset" 
        ADD COLUMN quality_score DECIMAL(3,2) DEFAULT 0.0 
        CHECK (quality_score >= 0.0 AND quality_score <= 10.0);
        
        RAISE NOTICE 'Added quality_score to VideoAsset table';
    ELSE
        RAISE NOTICE 'quality_score already exists in VideoAsset table';
    END IF;
END
$$;

-- =====================================================
-- 3. SHARETOKEN TABLE - ADD PERMISSIONS FIELD
-- =====================================================
-- Contract: Permissions field for granular access control
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ShareToken' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE "ShareToken" 
        ADD COLUMN permissions JSONB DEFAULT '{"read": true, "write": false, "share": false}' NOT NULL;
        
        RAISE NOTICE 'Added permissions to ShareToken table';
    ELSE
        RAISE NOTICE 'permissions already exists in ShareToken table';
    END IF;
END
$$;

-- =====================================================
-- 4. COMMENT TABLE - ADD FEEDBACK FIELDS
-- =====================================================
-- Contract: Enhanced comment system for feedback and ratings
DO $$
BEGIN
    -- Add comment_type field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'comment_type'
    ) THEN
        ALTER TABLE "Comment" 
        ADD COLUMN comment_type TEXT DEFAULT 'general' 
        CHECK (comment_type IN ('general', 'feedback', 'review', 'suggestion', 'issue'));
        
        RAISE NOTICE 'Added comment_type to Comment table';
    ELSE
        RAISE NOTICE 'comment_type already exists in Comment table';
    END IF;

    -- Add feedback_data field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'feedback_data'
    ) THEN
        ALTER TABLE "Comment" 
        ADD COLUMN feedback_data JSONB DEFAULT NULL;
        
        RAISE NOTICE 'Added feedback_data to Comment table';
    ELSE
        RAISE NOTICE 'feedback_data already exists in Comment table';
    END IF;

    -- Add rating field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'rating'
    ) THEN
        ALTER TABLE "Comment" 
        ADD COLUMN rating INTEGER DEFAULT NULL 
        CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
        
        RAISE NOTICE 'Added rating to Comment table';
    ELSE
        RAISE NOTICE 'rating already exists in Comment table';
    END IF;
END
$$;

-- =====================================================
-- 5. PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================
-- Contract: Performance indexes for CineGenius v3 query patterns

-- Index for Prompt queries by cinegenius_version
CREATE INDEX IF NOT EXISTS idx_prompt_cinegenius_version 
ON "Prompt"(cinegenius_version) 
WHERE cinegenius_version IS NOT NULL;

-- Index for VideoAsset queries by status and provider
CREATE INDEX IF NOT EXISTS idx_videoasset_status_provider 
ON "VideoAsset"(status, provider);

-- Index for VideoAsset queries by quality_score (for filtering)
CREATE INDEX IF NOT EXISTS idx_videoasset_quality_score 
ON "VideoAsset"(quality_score DESC) 
WHERE quality_score > 0.0;

-- Index for Comment queries by type and target
CREATE INDEX IF NOT EXISTS idx_comment_type_target 
ON "Comment"(comment_type, "targetType", "targetId");

-- Index for Comment queries by rating
CREATE INDEX IF NOT EXISTS idx_comment_rating 
ON "Comment"(rating DESC) 
WHERE rating IS NOT NULL;

-- Index for ShareToken queries by role and target
CREATE INDEX IF NOT EXISTS idx_sharetoken_role_target 
ON "ShareToken"(role, "targetType", "targetId");

-- Composite index for ShareTokens (without WHERE clause to avoid IMMUTABLE issue)
CREATE INDEX IF NOT EXISTS idx_sharetoken_active 
ON "ShareToken"(token, expires_at);

-- =====================================================
-- 6. DATA INTEGRITY CONSTRAINTS
-- =====================================================
-- Contract: Additional constraints for data quality

-- Ensure VideoAsset has valid provider values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'VideoAsset' 
        AND constraint_name = 'videoasset_provider_check'
    ) THEN
        ALTER TABLE "VideoAsset" 
        ADD CONSTRAINT videoasset_provider_check 
        CHECK (provider IN ('runwayml', 'pika', 'stable-video', 'cogvideo', 'local'));
        
        RAISE NOTICE 'Added provider constraint to VideoAsset table';
    END IF;
END
$$;

-- Ensure VideoAsset has valid status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'VideoAsset' 
        AND constraint_name = 'videoasset_status_check'
    ) THEN
        ALTER TABLE "VideoAsset" 
        ADD CONSTRAINT videoasset_status_check 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));
        
        RAISE NOTICE 'Added status constraint to VideoAsset table';
    END IF;
END
$$;

-- Ensure ShareToken has valid role values (first migrate existing data)
DO $$
BEGIN
    -- Migrate legacy 'commenter' role to 'viewer'
    UPDATE "ShareToken" SET role = 'viewer' WHERE role = 'commenter';
    
    RAISE NOTICE 'Migrated legacy role values in ShareToken';
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'ShareToken' 
        AND constraint_name = 'sharetoken_role_check'
    ) THEN
        ALTER TABLE "ShareToken" 
        ADD CONSTRAINT sharetoken_role_check 
        CHECK (role IN ('viewer', 'editor', 'admin', 'owner', 'commenter'));
        
        RAISE NOTICE 'Added role constraint to ShareToken table';
    END IF;
END
$$;

-- =====================================================
-- 7. LOG MIGRATION EXECUTION
-- =====================================================
-- Record this migration in the log
INSERT INTO "MigrationLog" (
    migration_id,
    migration_name,
    rollback_script,
    checksum,
    execution_time_ms,
    metadata,
    created_by
) VALUES (
    '001_cinegenius_v3_schema_upgrade',
    'CineGenius v3 Schema Upgrade with VideoAsset, ShareToken, Comment enhancements',
    'migrations/rollback/001_rollback_cinegenius_v3_schema_upgrade.sql',
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    0, -- Will be updated by monitoring
    '{"version": "v3.0", "tables_modified": ["VideoAsset", "ShareToken", "Comment"], "indexes_added": 7, "constraints_added": 3}',
    'Daniel-DataLead'
) ON CONFLICT (migration_id) DO NOTHING;

-- =====================================================
-- 8. VALIDATE MIGRATION SUCCESS
-- =====================================================
-- Validate all expected fields exist
DO $$
DECLARE
    missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check VideoAsset fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'VideoAsset' AND column_name = 'generation_metadata') THEN
        missing_fields := array_append(missing_fields, 'VideoAsset.generation_metadata');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'VideoAsset' AND column_name = 'quality_score') THEN
        missing_fields := array_append(missing_fields, 'VideoAsset.quality_score');
    END IF;
    
    -- Check ShareToken fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ShareToken' AND column_name = 'permissions') THEN
        missing_fields := array_append(missing_fields, 'ShareToken.permissions');
    END IF;
    
    -- Check Comment fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'comment_type') THEN
        missing_fields := array_append(missing_fields, 'Comment.comment_type');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'feedback_data') THEN
        missing_fields := array_append(missing_fields, 'Comment.feedback_data');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'rating') THEN
        missing_fields := array_append(missing_fields, 'Comment.rating');
    END IF;
    
    IF array_length(missing_fields, 1) > 0 THEN
        RAISE EXCEPTION 'Migration validation failed. Missing fields: %', array_to_string(missing_fields, ', ');
    ELSE
        RAISE NOTICE 'Migration validation successful. All expected fields present.';
    END IF;
END
$$;

-- =====================================================
-- 9. UPDATE EXISTING DATA (DATA MIGRATION)
-- =====================================================
-- Safe data migration for existing records
-- Update existing VideoAssets with default generation_metadata structure
UPDATE "VideoAsset" 
SET generation_metadata = jsonb_build_object(
    'provider_config', '{}',
    'generation_params', '{}',
    'ai_analysis', '{}',
    'processing_info', '{}'
)
WHERE generation_metadata = '{}';

-- Update existing ShareTokens with appropriate permissions based on role
UPDATE "ShareToken" 
SET permissions = CASE 
    WHEN role IN ('viewer', 'commenter') THEN '{"read": true, "write": false, "share": false, "comment": true}'::jsonb
    WHEN role = 'editor' THEN '{"read": true, "write": true, "share": false, "comment": true}'::jsonb
    WHEN role = 'admin' THEN '{"read": true, "write": true, "share": true, "comment": true}'::jsonb
    WHEN role = 'owner' THEN '{"read": true, "write": true, "share": true, "delete": true, "comment": true}'::jsonb
    ELSE '{"read": true, "write": false, "share": false, "comment": false}'::jsonb
END
WHERE permissions = '{"read": true, "write": false, "share": false}';

COMMIT;

-- =====================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- =====================================================
\echo 'CineGenius v3 Schema Migration completed successfully!'
\echo 'Added fields:'
\echo '  - VideoAsset: generation_metadata, quality_score'
\echo '  - ShareToken: permissions'
\echo '  - Comment: comment_type, feedback_data, rating'
\echo 'Added 7 performance indexes'
\echo 'Added 3 data integrity constraints'
\echo 'Created MigrationLog table for version control'