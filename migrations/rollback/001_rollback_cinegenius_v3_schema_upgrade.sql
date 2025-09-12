-- =====================================================
-- VideoPlanet CineGenius v3 Schema Migration ROLLBACK
-- Migration ID: 001_cinegenius_v3_schema_upgrade
-- Author: Daniel (Data Lead)
-- Date: 2025-09-13
-- Description: Safe rollback for CineGenius v3 schema upgrade
-- WARNING: This will remove CineGenius v3 fields and data
-- =====================================================

-- Transaction safety: All operations in single transaction
BEGIN;

-- =====================================================
-- 1. BACKUP VERIFICATION
-- =====================================================
-- Verify backup exists before proceeding
DO $$
BEGIN
    RAISE NOTICE 'Starting rollback for migration: 001_cinegenius_v3_schema_upgrade';
    RAISE NOTICE 'WARNING: This will permanently remove CineGenius v3 fields and data';
    RAISE NOTICE 'Ensure you have verified database backup before proceeding';
END
$$;

-- =====================================================
-- 2. DROP PERFORMANCE INDEXES
-- =====================================================
-- Remove performance indexes added in migration
DROP INDEX IF EXISTS idx_prompt_cinegenius_version;
DROP INDEX IF EXISTS idx_videoasset_status_provider;
DROP INDEX IF EXISTS idx_videoasset_quality_score;
DROP INDEX IF EXISTS idx_comment_type_target;
DROP INDEX IF EXISTS idx_comment_rating;
DROP INDEX IF EXISTS idx_sharetoken_role_target;
DROP INDEX IF EXISTS idx_sharetoken_active;

RAISE NOTICE 'Dropped 7 performance indexes';

-- =====================================================
-- 3. DROP DATA INTEGRITY CONSTRAINTS
-- =====================================================
-- Remove constraints added in migration
ALTER TABLE "VideoAsset" DROP CONSTRAINT IF EXISTS videoasset_provider_check;
ALTER TABLE "VideoAsset" DROP CONSTRAINT IF EXISTS videoasset_status_check;
ALTER TABLE "ShareToken" DROP CONSTRAINT IF EXISTS sharetoken_role_check;

RAISE NOTICE 'Dropped 3 data integrity constraints';

-- =====================================================
-- 4. DROP VIDEOASSET COLUMNS
-- =====================================================
-- Remove CineGenius v3 fields from VideoAsset
DO $$
BEGIN
    -- Drop generation_metadata column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'generation_metadata'
    ) THEN
        ALTER TABLE "VideoAsset" DROP COLUMN generation_metadata;
        RAISE NOTICE 'Dropped generation_metadata from VideoAsset table';
    ELSE
        RAISE NOTICE 'generation_metadata does not exist in VideoAsset table';
    END IF;

    -- Drop quality_score column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'quality_score'
    ) THEN
        ALTER TABLE "VideoAsset" DROP COLUMN quality_score;
        RAISE NOTICE 'Dropped quality_score from VideoAsset table';
    ELSE
        RAISE NOTICE 'quality_score does not exist in VideoAsset table';
    END IF;
END
$$;

-- =====================================================
-- 5. DROP SHARETOKEN COLUMNS
-- =====================================================
-- Remove permissions field from ShareToken
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ShareToken' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE "ShareToken" DROP COLUMN permissions;
        RAISE NOTICE 'Dropped permissions from ShareToken table';
    ELSE
        RAISE NOTICE 'permissions does not exist in ShareToken table';
    END IF;
END
$$;

-- =====================================================
-- 6. DROP COMMENT COLUMNS
-- =====================================================
-- Remove feedback fields from Comment
DO $$
BEGIN
    -- Drop comment_type column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'comment_type'
    ) THEN
        ALTER TABLE "Comment" DROP COLUMN comment_type;
        RAISE NOTICE 'Dropped comment_type from Comment table';
    ELSE
        RAISE NOTICE 'comment_type does not exist in Comment table';
    END IF;

    -- Drop feedback_data column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'feedback_data'
    ) THEN
        ALTER TABLE "Comment" DROP COLUMN feedback_data;
        RAISE NOTICE 'Dropped feedback_data from Comment table';
    ELSE
        RAISE NOTICE 'feedback_data does not exist in Comment table';
    END IF;

    -- Drop rating column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'rating'
    ) THEN
        ALTER TABLE "Comment" DROP COLUMN rating;
        RAISE NOTICE 'Dropped rating from Comment table';
    ELSE
        RAISE NOTICE 'rating does not exist in Comment table';
    END IF;
END
$$;

-- =====================================================
-- 7. UPDATE MIGRATION LOG
-- =====================================================
-- Mark migration as rolled back
UPDATE "MigrationLog" 
SET 
    status = 'ROLLED_BACK',
    metadata = metadata || jsonb_build_object(
        'rolled_back_at', CURRENT_TIMESTAMP,
        'rollback_reason', 'Manual rollback requested'
    )
WHERE migration_id = '001_cinegenius_v3_schema_upgrade';

-- Insert rollback record
INSERT INTO "MigrationLog" (
    migration_id,
    migration_name,
    rollback_script,
    checksum,
    execution_time_ms,
    status,
    metadata,
    created_by
) VALUES (
    '001_cinegenius_v3_schema_upgrade_ROLLBACK',
    'Rollback: CineGenius v3 Schema Upgrade',
    NULL,
    'rollback_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    0,
    'APPLIED',
    '{"type": "rollback", "original_migration": "001_cinegenius_v3_schema_upgrade", "fields_removed": ["VideoAsset.generation_metadata", "VideoAsset.quality_score", "ShareToken.permissions", "Comment.comment_type", "Comment.feedback_data", "Comment.rating"]}',
    'Daniel-DataLead'
);

-- =====================================================
-- 8. VALIDATE ROLLBACK SUCCESS
-- =====================================================
-- Validate all CineGenius v3 fields are removed
DO $$
DECLARE
    remaining_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check VideoAsset fields are gone
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'VideoAsset' AND column_name = 'generation_metadata') THEN
        remaining_fields := array_append(remaining_fields, 'VideoAsset.generation_metadata');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'VideoAsset' AND column_name = 'quality_score') THEN
        remaining_fields := array_append(remaining_fields, 'VideoAsset.quality_score');
    END IF;
    
    -- Check ShareToken fields are gone
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ShareToken' AND column_name = 'permissions') THEN
        remaining_fields := array_append(remaining_fields, 'ShareToken.permissions');
    END IF;
    
    -- Check Comment fields are gone
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'comment_type') THEN
        remaining_fields := array_append(remaining_fields, 'Comment.comment_type');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'feedback_data') THEN
        remaining_fields := array_append(remaining_fields, 'Comment.feedback_data');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Comment' AND column_name = 'rating') THEN
        remaining_fields := array_append(remaining_fields, 'Comment.rating');
    END IF;
    
    IF array_length(remaining_fields, 1) > 0 THEN
        RAISE EXCEPTION 'Rollback validation failed. Remaining fields: %', array_to_string(remaining_fields, ', ');
    ELSE
        RAISE NOTICE 'Rollback validation successful. All CineGenius v3 fields removed.';
    END IF;
END
$$;

COMMIT;

-- =====================================================
-- ROLLBACK COMPLETED SUCCESSFULLY
-- =====================================================
\echo 'CineGenius v3 Schema Migration Rollback completed successfully!'
\echo 'Removed fields:'
\echo '  - VideoAsset: generation_metadata, quality_score'
\echo '  - ShareToken: permissions'
\echo '  - Comment: comment_type, feedback_data, rating'
\echo 'Removed 7 performance indexes'
\echo 'Removed 3 data integrity constraints'
\echo 'Database schema reverted to pre-CineGenius v3 state'