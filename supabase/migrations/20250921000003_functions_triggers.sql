-- Supabase Functions & Triggers
-- Created: 2025-09-21
-- Description: 영상 상태 전환 자동화, 버전 생성 트리거, 에셋 정리 스케줄러, 재시도 카운트 자동 기록

-- ===========================================
-- 1. 공통 유틸리티 함수
-- ===========================================

-- Updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Soft Delete 함수
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- DELETE 대신 is_deleted = TRUE로 설정
    UPDATE users SET is_deleted = TRUE, deleted_at = NOW() WHERE id = OLD.id;
    RETURN NULL; -- DELETE 작업을 취소
END;
$$ LANGUAGE plpgsql;

-- 사용량 증가 함수
CREATE OR REPLACE FUNCTION increment_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.usage_count = COALESCE(OLD.usage_count, 0) + 1;
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 2. 영상 생성 상태 관리 함수
-- ===========================================

-- 영상 생성 상태 전환 함수
CREATE OR REPLACE FUNCTION transition_video_generation_status(
    generation_id UUID,
    new_status video_generation_status,
    error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status video_generation_status;
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- 현재 상태 조회
    SELECT status INTO current_status
    FROM video_generations
    WHERE id = generation_id;

    IF current_status IS NULL THEN
        RAISE EXCEPTION 'Video generation not found: %', generation_id;
    END IF;

    -- 상태 전환 규칙 검증
    CASE current_status
        WHEN 'pending' THEN
            valid_transition := new_status IN ('processing', 'cancelled', 'failed');
        WHEN 'processing' THEN
            valid_transition := new_status IN ('completed', 'failed', 'cancelled');
        WHEN 'completed' THEN
            valid_transition := new_status IN ('failed'); -- 재처리 케이스
        WHEN 'failed' THEN
            valid_transition := new_status IN ('pending', 'cancelled'); -- 재시도 케이스
        WHEN 'cancelled' THEN
            valid_transition := new_status IN ('pending'); -- 재시도 케이스
    END CASE;

    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', current_status, new_status;
    END IF;

    -- 상태 업데이트
    UPDATE video_generations
    SET
        status = new_status,
        last_error_message = CASE WHEN new_status = 'failed' THEN error_message ELSE NULL END,
        completed_at = CASE WHEN new_status = 'completed' THEN NOW() ELSE NULL END,
        failed_at = CASE WHEN new_status = 'failed' THEN NOW() ELSE NULL END,
        progress_percentage = CASE
            WHEN new_status = 'completed' THEN 100
            WHEN new_status = 'failed' THEN 0
            WHEN new_status = 'cancelled' THEN 0
            ELSE progress_percentage
        END
    WHERE id = generation_id;

    -- 재시도 횟수 증가 (실패 시)
    IF new_status = 'failed' THEN
        UPDATE video_generations
        SET retry_count = retry_count + 1
        WHERE id = generation_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 자동 재시도 함수
CREATE OR REPLACE FUNCTION auto_retry_failed_generations()
RETURNS INTEGER AS $$
DECLARE
    retry_count INTEGER := 0;
    generation_record RECORD;
BEGIN
    -- 재시도 가능한 실패 건들 조회
    FOR generation_record IN
        SELECT id, retry_count, max_retries
        FROM video_generations
        WHERE status = 'failed'
        AND retry_count < max_retries
        AND failed_at < NOW() - INTERVAL '5 minutes' -- 5분 후 재시도
        AND is_deleted = FALSE
    LOOP
        -- 상태를 pending으로 변경
        PERFORM transition_video_generation_status(generation_record.id, 'pending');
        retry_count := retry_count + 1;
    END LOOP;

    RETURN retry_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 3. 버전 관리 함수
-- ===========================================

-- 자동 버전 생성 함수
CREATE OR REPLACE FUNCTION create_version_snapshot(
    entity_type TEXT,
    entity_id UUID,
    user_id UUID,
    title TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_version_id UUID;
    current_version INTEGER;
    snapshot_data JSONB;
BEGIN
    -- 현재 버전 번호 조회
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO current_version
    FROM versions
    WHERE entity_type = entity_type AND entity_id = entity_id;

    -- 엔티티별 스냅샷 데이터 수집
    CASE entity_type
        WHEN 'project' THEN
            SELECT to_jsonb(p.*) INTO snapshot_data
            FROM projects p WHERE p.id = entity_id;
        WHEN 'story' THEN
            SELECT to_jsonb(s.*) INTO snapshot_data
            FROM stories s WHERE s.id = entity_id;
        WHEN 'scenario' THEN
            SELECT to_jsonb(sc.*) INTO snapshot_data
            FROM scenarios sc WHERE sc.id = entity_id;
        ELSE
            RAISE EXCEPTION 'Unsupported entity type: %', entity_type;
    END CASE;

    -- 버전 레코드 생성
    INSERT INTO versions (
        entity_type,
        entity_id,
        user_id,
        version_number,
        title,
        description,
        snapshot_data
    )
    VALUES (
        entity_type,
        entity_id,
        user_id,
        current_version,
        COALESCE(title, entity_type || ' v' || current_version),
        description,
        snapshot_data
    )
    RETURNING id INTO new_version_id;

    RETURN new_version_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 4. 에셋 관리 함수
-- ===========================================

-- 고아 에셋 정리 함수
CREATE OR REPLACE FUNCTION cleanup_orphaned_assets()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
    asset_record RECORD;
BEGIN
    -- 30일 이상 사용되지 않은 임시 에셋 정리
    FOR asset_record IN
        SELECT id, file_path
        FROM assets
        WHERE project_id IS NULL
        AND usage_count = 0
        AND created_at < NOW() - INTERVAL '30 days'
        AND is_deleted = FALSE
    LOOP
        -- Soft Delete
        UPDATE assets
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id = asset_record.id;

        cleanup_count := cleanup_count + 1;
    END LOOP;

    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- 스토리지 사용량 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_storage_usage(user_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    total_usage BIGINT;
BEGIN
    -- 사용자의 총 스토리지 사용량 계산
    SELECT COALESCE(SUM(file_size), 0)
    INTO total_usage
    FROM assets
    WHERE user_id = user_uuid
    AND is_deleted = FALSE;

    -- 사용자 테이블 업데이트
    UPDATE users
    SET storage_usage_bytes = total_usage
    WHERE id = user_uuid;

    RETURN total_usage;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 5. API 사용량 및 비용 추적 함수
-- ===========================================

-- API 호출 기록 함수 ($300 사건 방지)
CREATE OR REPLACE FUNCTION record_api_call(
    user_uuid UUID,
    api_endpoint TEXT,
    estimated_cost DECIMAL DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
    current_daily_calls INTEGER;
    current_monthly_calls INTEGER;
    user_monthly_limit INTEGER;
BEGIN
    -- 현재 사용량 조회
    SELECT api_calls_today, api_calls_this_month
    INTO current_daily_calls, current_monthly_calls
    FROM users
    WHERE id = user_uuid;

    -- 사용자 월간 한도 조회
    SELECT monthly_api_limit
    INTO user_monthly_limit
    FROM profiles
    WHERE user_id = user_uuid;

    -- 한도 체크
    IF current_monthly_calls >= COALESCE(user_monthly_limit, 100) THEN
        RAISE EXCEPTION 'API monthly limit exceeded: %', user_monthly_limit;
    END IF;

    -- 일일 한도 체크 (일반 사용자 100회, Pro 1000회)
    IF current_daily_calls >= 100 THEN
        RAISE EXCEPTION 'API daily limit exceeded: 100';
    END IF;

    -- 사용량 증가
    UPDATE users
    SET
        api_calls_today = api_calls_today + 1,
        api_calls_this_month = api_calls_this_month + 1
    WHERE id = user_uuid;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 일일 사용량 리셋 함수
CREATE OR REPLACE FUNCTION reset_daily_api_usage()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    UPDATE users
    SET api_calls_today = 0
    WHERE api_calls_today > 0;

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- 월간 사용량 리셋 함수
CREATE OR REPLACE FUNCTION reset_monthly_api_usage()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    UPDATE users
    SET api_calls_this_month = 0
    WHERE api_calls_this_month > 0;

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 6. TRIGGERS 생성
-- ===========================================

-- Updated_at 자동 업데이트 트리거
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_generations_updated_at
    BEFORE UPDATE ON video_generations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedbacks_updated_at
    BEFORE UPDATE ON feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_policies_updated_at
    BEFORE UPDATE ON brand_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 에셋 사용량 업데이트 트리거
CREATE TRIGGER update_asset_usage
    BEFORE UPDATE ON assets
    FOR EACH ROW
    WHEN (OLD.usage_count != NEW.usage_count)
    EXECUTE FUNCTION increment_usage_count();

-- 에셋 생성/삭제 시 스토리지 사용량 업데이트 트리거
CREATE OR REPLACE FUNCTION trigger_update_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_user_storage_usage(NEW.user_id);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_deleted != NEW.is_deleted THEN
            PERFORM update_user_storage_usage(NEW.user_id);
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_user_storage_usage(OLD.user_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_storage_usage_trigger
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_storage_usage();

-- 프로젝트 생성 시 자동 버전 생성 트리거
CREATE OR REPLACE FUNCTION trigger_create_initial_version()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM create_version_snapshot(
            TG_TABLE_NAME::TEXT,
            NEW.id,
            NEW.user_id,
            'Initial version',
            'Automatically created initial version'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_initial_version_trigger
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_initial_version();

CREATE TRIGGER stories_initial_version_trigger
    AFTER INSERT ON stories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_initial_version();

-- ===========================================
-- 7. 스케줄링 함수 (cron jobs용)
-- ===========================================

-- 종합 정리 작업
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    orphaned_count INTEGER;
    retry_count INTEGER;
BEGIN
    -- 1. 고아 에셋 정리
    SELECT cleanup_orphaned_assets() INTO orphaned_count;
    result := result || format('Cleaned up %s orphaned assets. ', orphaned_count);

    -- 2. 실패한 영상 생성 재시도
    SELECT auto_retry_failed_generations() INTO retry_count;
    result := result || format('Retried %s failed video generations. ', retry_count);

    -- 3. 일일 API 사용량 리셋 (매일 00:00 KST)
    IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') = 0 THEN
        PERFORM reset_daily_api_usage();
        result := result || 'Reset daily API usage. ';
    END IF;

    -- 4. 월간 API 사용량 리셋 (매월 1일 00:00 KST)
    IF EXTRACT(DAY FROM NOW() AT TIME ZONE 'Asia/Seoul') = 1
       AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') = 0 THEN
        PERFORM reset_monthly_api_usage();
        result := result || 'Reset monthly API usage. ';
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 성능 통계 수집 함수
CREATE OR REPLACE FUNCTION collect_performance_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE),
        'total_projects', (SELECT COUNT(*) FROM projects WHERE is_deleted = FALSE),
        'active_video_generations', (SELECT COUNT(*) FROM video_generations WHERE status IN ('pending', 'processing')),
        'total_storage_usage_gb', (SELECT ROUND(SUM(storage_usage_bytes)::NUMERIC / 1024 / 1024 / 1024, 2) FROM users),
        'daily_api_calls', (SELECT SUM(api_calls_today) FROM users),
        'monthly_api_calls', (SELECT SUM(api_calls_this_month) FROM users),
        'last_updated', NOW()
    ) INTO stats;

    RETURN stats;
END;
$$ LANGUAGE plpgsql;