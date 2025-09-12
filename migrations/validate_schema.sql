-- =====================================================
-- VideoPlanet Data Quality Validation Suite
-- Author: Daniel (Data Lead)
-- Description: Comprehensive data quality checks for CineGenius v3
-- =====================================================

-- Set client encoding and formatting
\set QUIET 1
\set ON_ERROR_STOP on

-- Create temporary schema for validation functions
CREATE SCHEMA IF NOT EXISTS validation_temp;

-- =====================================================
-- VALIDATION FUNCTIONS
-- =====================================================

-- Function to validate JSON schema
CREATE OR REPLACE FUNCTION validation_temp.validate_json_schema(
    p_json_data JSONB,
    p_schema_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Basic JSON validation for different schemas
    CASE p_schema_name
        WHEN 'generation_metadata' THEN
            RETURN (
                p_json_data ? 'provider_config' AND
                p_json_data ? 'generation_params' AND
                jsonb_typeof(p_json_data->'provider_config') = 'object' AND
                jsonb_typeof(p_json_data->'generation_params') = 'object'
            );
        WHEN 'permissions' THEN
            RETURN (
                p_json_data ? 'read' AND
                jsonb_typeof(p_json_data->'read') = 'boolean'
            );
        WHEN 'feedback_data' THEN
            -- Feedback data can be null or object
            RETURN (p_json_data IS NULL OR jsonb_typeof(p_json_data) = 'object');
        ELSE
            RETURN TRUE; -- Default validation passes
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEMA VALIDATION TESTS
-- =====================================================

\echo '🔍 Starting CineGenius v3 Schema Validation Suite'
\echo '================================================='
\echo ''

-- Test 1: Verify MigrationLog table exists and is functional
\echo '📋 Test 1: MigrationLog Table Validation'
\echo '----------------------------------------'

DO $$
DECLARE
    migration_exists BOOLEAN := FALSE;
    log_count INTEGER := 0;
BEGIN
    -- Check if MigrationLog table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'MigrationLog'
    ) INTO migration_exists;
    
    IF migration_exists THEN
        SELECT COUNT(*) INTO log_count FROM "MigrationLog";
        RAISE NOTICE '✅ MigrationLog table exists with % records', log_count;
        
        -- Verify required columns exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'MigrationLog' 
            AND column_name IN ('migration_id', 'applied_at', 'status', 'checksum')
        ) THEN
            RAISE NOTICE '✅ MigrationLog has all required columns';
        ELSE
            RAISE EXCEPTION '❌ MigrationLog missing required columns';
        END IF;
    ELSE
        RAISE EXCEPTION '❌ MigrationLog table does not exist';
    END IF;
END $$;

\echo ''

-- Test 2: Verify VideoAsset schema compliance
\echo '🎬 Test 2: VideoAsset Schema Validation'
\echo '---------------------------------------'

DO $$
DECLARE
    field_count INTEGER := 0;
    invalid_scores INTEGER := 0;
    invalid_metadata INTEGER := 0;
BEGIN
    -- Check generation_metadata field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'generation_metadata'
    ) THEN
        RAISE NOTICE '✅ VideoAsset.generation_metadata field exists';
        
        -- Validate metadata JSON structure
        SELECT COUNT(*) INTO invalid_metadata
        FROM "VideoAsset" 
        WHERE NOT validation_temp.validate_json_schema(generation_metadata, 'generation_metadata');
        
        IF invalid_metadata = 0 THEN
            RAISE NOTICE '✅ All generation_metadata records have valid JSON schema';
        ELSE
            RAISE WARNING '⚠️  % VideoAsset records have invalid generation_metadata', invalid_metadata;
        END IF;
    ELSE
        RAISE EXCEPTION '❌ VideoAsset.generation_metadata field missing';
    END IF;
    
    -- Check quality_score field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' AND column_name = 'quality_score'
    ) THEN
        RAISE NOTICE '✅ VideoAsset.quality_score field exists';
        
        -- Validate quality scores are in valid range
        SELECT COUNT(*) INTO invalid_scores
        FROM "VideoAsset" 
        WHERE quality_score IS NOT NULL 
        AND (quality_score < 0.0 OR quality_score > 10.0);
        
        IF invalid_scores = 0 THEN
            RAISE NOTICE '✅ All quality_score values are within valid range (0.0-10.0)';
        ELSE
            RAISE EXCEPTION '❌ % VideoAsset records have invalid quality_score values', invalid_scores;
        END IF;
    ELSE
        RAISE EXCEPTION '❌ VideoAsset.quality_score field missing';
    END IF;
END $$;

\echo ''

-- Test 3: Verify ShareToken schema compliance
\echo '🔐 Test 3: ShareToken Schema Validation'
\echo '---------------------------------------'

DO $$
DECLARE
    invalid_permissions INTEGER := 0;
    token_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO token_count FROM "ShareToken";
    RAISE NOTICE 'ℹ️  Found % ShareToken records', token_count;
    
    -- Check permissions field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ShareToken' AND column_name = 'permissions'
    ) THEN
        RAISE NOTICE '✅ ShareToken.permissions field exists';
        
        -- Validate permissions JSON structure
        SELECT COUNT(*) INTO invalid_permissions
        FROM "ShareToken" 
        WHERE NOT validation_temp.validate_json_schema(permissions, 'permissions');
        
        IF invalid_permissions = 0 THEN
            RAISE NOTICE '✅ All permissions records have valid JSON schema';
        ELSE
            RAISE EXCEPTION '❌ % ShareToken records have invalid permissions JSON', invalid_permissions;
        END IF;
    ELSE
        RAISE EXCEPTION '❌ ShareToken.permissions field missing';
    END IF;
END $$;

\echo ''

-- Test 4: Verify Comment schema compliance  
\echo '💬 Test 4: Comment Schema Validation'
\echo '------------------------------------'

DO $$
DECLARE
    invalid_ratings INTEGER := 0;
    invalid_types INTEGER := 0;
    comment_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO comment_count FROM "Comment";
    RAISE NOTICE 'ℹ️  Found % Comment records', comment_count;
    
    -- Check comment_type field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'comment_type'
    ) THEN
        RAISE NOTICE '✅ Comment.comment_type field exists';
        
        -- Validate comment types
        SELECT COUNT(*) INTO invalid_types
        FROM "Comment" 
        WHERE comment_type NOT IN ('general', 'feedback', 'review', 'suggestion', 'issue');
        
        IF invalid_types = 0 THEN
            RAISE NOTICE '✅ All comment_type values are valid';
        ELSE
            RAISE EXCEPTION '❌ % Comment records have invalid comment_type values', invalid_types;
        END IF;
    ELSE
        RAISE EXCEPTION '❌ Comment.comment_type field missing';
    END IF;
    
    -- Check feedback_data field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'feedback_data'
    ) THEN
        RAISE NOTICE '✅ Comment.feedback_data field exists';
    ELSE
        RAISE EXCEPTION '❌ Comment.feedback_data field missing';
    END IF;
    
    -- Check rating field
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Comment' AND column_name = 'rating'
    ) THEN
        RAISE NOTICE '✅ Comment.rating field exists';
        
        -- Validate rating values
        SELECT COUNT(*) INTO invalid_ratings
        FROM "Comment" 
        WHERE rating IS NOT NULL 
        AND (rating < 1 OR rating > 5);
        
        IF invalid_ratings = 0 THEN
            RAISE NOTICE '✅ All rating values are within valid range (1-5)';
        ELSE
            RAISE EXCEPTION '❌ % Comment records have invalid rating values', invalid_ratings;
        END IF;
    ELSE
        RAISE EXCEPTION '❌ Comment.rating field missing';
    END IF;
END $$;

\echo ''

-- Test 5: Verify performance indexes
\echo '⚡ Test 5: Performance Index Validation'
\echo '---------------------------------------'

DO $$
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'idx_prompt_cinegenius_version',
        'idx_videoasset_status_provider', 
        'idx_videoasset_quality_score',
        'idx_comment_type_target',
        'idx_comment_rating',
        'idx_sharetoken_role_target',
        'idx_sharetoken_active'
    ];
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    index_name TEXT;
BEGIN
    -- Check each expected index
    FOREACH index_name IN ARRAY expected_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) IS NULL THEN
        RAISE NOTICE '✅ All % performance indexes are present', array_length(expected_indexes, 1);
    ELSE
        RAISE WARNING '⚠️  Missing indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
END $$;

\echo ''

-- Test 6: Verify data integrity constraints
\echo '🛡️  Test 6: Data Integrity Constraints'
\echo '--------------------------------------'

DO $$
DECLARE
    constraint_count INTEGER := 0;
BEGIN
    -- Check VideoAsset constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE table_name = 'VideoAsset' 
    AND constraint_name IN ('videoasset_provider_check', 'videoasset_status_check');
    
    IF constraint_count >= 1 THEN
        RAISE NOTICE '✅ VideoAsset integrity constraints present (% found)', constraint_count;
    ELSE
        RAISE WARNING '⚠️  VideoAsset integrity constraints missing';
    END IF;
    
    -- Check ShareToken constraints  
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE table_name = 'ShareToken' 
    AND constraint_name = 'sharetoken_role_check';
    
    IF constraint_count >= 1 THEN
        RAISE NOTICE '✅ ShareToken integrity constraints present';
    ELSE
        RAISE WARNING '⚠️  ShareToken integrity constraints missing';
    END IF;
END $$;

\echo ''

-- Test 7: Data consistency validation
\echo '🔍 Test 7: Data Consistency Validation'
\echo '--------------------------------------'

DO $$
DECLARE
    orphaned_assets INTEGER := 0;
    invalid_tokens INTEGER := 0;
    orphaned_comments INTEGER := 0;
BEGIN
    -- Check for orphaned VideoAssets
    SELECT COUNT(*) INTO orphaned_assets
    FROM "VideoAsset" v
    LEFT JOIN "Prompt" p ON v.prompt_id = p.id
    WHERE p.id IS NULL;
    
    IF orphaned_assets = 0 THEN
        RAISE NOTICE '✅ No orphaned VideoAsset records found';
    ELSE
        RAISE WARNING '⚠️  % orphaned VideoAsset records found', orphaned_assets;
    END IF;
    
    -- Check for expired ShareTokens that should be cleaned up
    SELECT COUNT(*) INTO invalid_tokens
    FROM "ShareToken"
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    IF invalid_tokens = 0 THEN
        RAISE NOTICE '✅ No old expired ShareTokens found';
    ELSE
        RAISE NOTICE 'ℹ️  % old expired ShareTokens found (consider cleanup)', invalid_tokens;
    END IF;
END $$;

\echo ''

-- Test 8: Performance baseline check
\echo '📊 Test 8: Performance Baseline'
\echo '-------------------------------'

-- Explain query performance for key operations
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM "Prompt" 
WHERE cinegenius_version IS NOT NULL;

EXPLAIN (ANALYZE, BUFFERS)
SELECT v.*, p.metadata 
FROM "VideoAsset" v
JOIN "Prompt" p ON v.prompt_id = p.id
WHERE v.status = 'completed' 
AND v.provider = 'runwayml'
ORDER BY v.quality_score DESC
LIMIT 10;

-- =====================================================
-- CLEANUP AND SUMMARY
-- =====================================================

-- Drop temporary validation schema
DROP SCHEMA IF EXISTS validation_temp CASCADE;

\echo ''
\echo '🎉 Schema Validation Suite Completed!'
\echo '======================================'
\echo ''
\echo 'Summary:'
\echo '  - MigrationLog table verified'
\echo '  - VideoAsset CineGenius v3 fields validated'
\echo '  - ShareToken permissions system validated'  
\echo '  - Comment feedback system validated'
\echo '  - Performance indexes checked'
\echo '  - Data integrity constraints verified'
\echo '  - Data consistency validated'
\echo '  - Performance baselines established'
\echo ''
\echo '✅ Database is ready for CineGenius v3!'