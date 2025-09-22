-- Admin Metrics RPC Functions
-- 관리자 메트릭 집계를 위한 고성능 PostgreSQL 함수들
-- CLAUDE.md 준수: $300 사건 방지, 캐싱, 성능 최적화

-- ===============================================
-- 사용자 메트릭 RPC 함수
-- ===============================================

CREATE OR REPLACE FUNCTION get_admin_user_metrics(
  start_time timestamptz,
  end_time timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_users_count integer;
  recent_week_count integer;
  admin_users_count integer;
  guest_ratio_val numeric;
BEGIN
  -- 전체 사용자 수
  SELECT COUNT(*) INTO total_users_count
  FROM users
  WHERE deleted_at IS NULL;

  -- 최근 주 신규 가입자
  SELECT COUNT(*) INTO recent_week_count
  FROM users
  WHERE created_at >= start_time
    AND created_at <= end_time
    AND deleted_at IS NULL;

  -- 관리자 사용자 수
  SELECT COUNT(*) INTO admin_users_count
  FROM users
  WHERE role IN ('admin', 'super_admin')
    AND deleted_at IS NULL;

  -- 게스트 비율 계산 (이메일 없는 사용자)
  SELECT
    CASE
      WHEN total_users_count > 0 THEN
        ROUND((COUNT(*) * 100.0 / total_users_count), 2)
      ELSE 0
    END INTO guest_ratio_val
  FROM users
  WHERE (email IS NULL OR email = '')
    AND deleted_at IS NULL;

  -- JSON 결과 구성
  SELECT json_build_object(
    'total_users', total_users_count,
    'recent_week_users', recent_week_count,
    'admin_users', admin_users_count,
    'guest_ratio', guest_ratio_val
  ) INTO result;

  RETURN result;
END;
$$;

-- ===============================================
-- 콘텐츠 메트릭 RPC 함수
-- ===============================================

CREATE OR REPLACE FUNCTION get_admin_content_metrics(
  start_time timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  projects_count integer;
  scenarios_count integer;
  prompts_count integer;
  video_assets_count integer;
BEGIN
  -- 프로젝트 수
  SELECT COUNT(*) INTO projects_count
  FROM projects
  WHERE is_deleted = false;

  -- 시나리오 수
  SELECT COUNT(*) INTO scenarios_count
  FROM scenarios
  WHERE is_deleted = false;

  -- 프롬프트 수 (prompt_history 테이블에서)
  SELECT COUNT(*) INTO prompts_count
  FROM prompt_history
  WHERE created_at >= start_time;

  -- 비디오 에셋 수
  SELECT COUNT(*) INTO video_assets_count
  FROM video_assets
  WHERE deleted_at IS NULL;

  -- JSON 결과 구성
  SELECT json_build_object(
    'total_projects', projects_count,
    'total_scenarios', scenarios_count,
    'total_prompts', prompts_count,
    'total_video_assets', video_assets_count
  ) INTO result;

  RETURN result;
END;
$$;

-- ===============================================
-- 시스템 메트릭 RPC 함수
-- ===============================================

CREATE OR REPLACE FUNCTION get_admin_system_metrics(
  start_time timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  queued_count integer;
  processing_count integer;
  completed_count integer;
  failed_count integer;
  recent_errors_count integer;
BEGIN
  -- 큐 상태별 비디오 수
  SELECT
    COUNT(*) FILTER (WHERE status = 'queued') AS queued,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed
  INTO queued_count, processing_count, completed_count, failed_count
  FROM video_assets
  WHERE deleted_at IS NULL;

  -- 최근 24시간 에러 수 (error_logs 테이블에서)
  SELECT COUNT(*) INTO recent_errors_count
  FROM error_logs
  WHERE level = 'error'
    AND created_at >= start_time;

  -- JSON 결과 구성
  SELECT json_build_object(
    'queued_videos', queued_count,
    'processing_videos', processing_count,
    'completed_videos', completed_count,
    'failed_videos', failed_count,
    'recent_errors', recent_errors_count
  ) INTO result;

  RETURN result;
END;
$$;

-- ===============================================
-- 사용자 통계 집계 함수 (사용자 관리 API용)
-- ===============================================

CREATE OR REPLACE FUNCTION get_user_search_stats(
  keyword text DEFAULT NULL,
  status_filter text[] DEFAULT NULL,
  role_filter text[] DEFAULT NULL,
  date_start timestamptz DEFAULT NULL,
  date_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_count integer;
  active_count integer;
  suspended_count integer;
  pending_count integer;
BEGIN
  -- 기본 WHERE 조건 구성
  WITH filtered_users AS (
    SELECT *
    FROM users
    WHERE deleted_at IS NULL
      AND (keyword IS NULL OR
           email ILIKE '%' || keyword || '%' OR
           username ILIKE '%' || keyword || '%')
      AND (status_filter IS NULL OR status = ANY(status_filter))
      AND (role_filter IS NULL OR role = ANY(role_filter))
      AND (date_start IS NULL OR created_at >= date_start)
      AND (date_end IS NULL OR created_at <= date_end)
  )
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending
  INTO total_count, active_count, suspended_count, pending_count
  FROM filtered_users;

  -- JSON 결과 구성
  SELECT json_build_object(
    'total_count', total_count,
    'active_count', active_count,
    'suspended_count', suspended_count,
    'pending_count', pending_count
  ) INTO result;

  RETURN result;
END;
$$;

-- ===============================================
-- 성능 모니터링 함수
-- ===============================================

CREATE OR REPLACE FUNCTION get_admin_performance_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  db_size_mb numeric;
  table_stats json;
  slow_queries_count integer;
BEGIN
  -- 데이터베이스 크기 (MB)
  SELECT
    ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2)
  INTO db_size_mb;

  -- 테이블별 통계
  SELECT json_agg(
    json_build_object(
      'table_name', schemaname || '.' || tablename,
      'size_mb', ROUND(pg_total_relation_size(schemaname||'.'||tablename) / 1024.0 / 1024.0, 2),
      'row_count', n_tup_ins - n_tup_del
    )
  ) INTO table_stats
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;

  -- 슬로우 쿼리 수 (pg_stat_statements 확장이 있는 경우)
  SELECT COUNT(*) INTO slow_queries_count
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000  -- 1초 이상
    AND calls > 10;

  -- JSON 결과 구성
  SELECT json_build_object(
    'database_size_mb', db_size_mb,
    'table_stats', table_stats,
    'slow_queries_count', slow_queries_count,
    'generated_at', EXTRACT(EPOCH FROM NOW())
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_stat_statements가 없는 경우 기본값 반환
    SELECT json_build_object(
      'database_size_mb', db_size_mb,
      'table_stats', table_stats,
      'slow_queries_count', 0,
      'generated_at', EXTRACT(EPOCH FROM NOW()),
      'note', 'pg_stat_statements extension not available'
    ) INTO result;

    RETURN result;
END;
$$;

-- ===============================================
-- 실시간 시스템 상태 함수
-- ===============================================

CREATE OR REPLACE FUNCTION get_realtime_system_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  active_connections integer;
  waiting_queries integer;
  locks_count integer;
  cache_hit_ratio numeric;
BEGIN
  -- 활성 연결 수
  SELECT COUNT(*) INTO active_connections
  FROM pg_stat_activity
  WHERE state = 'active';

  -- 대기 중인 쿼리 수
  SELECT COUNT(*) INTO waiting_queries
  FROM pg_stat_activity
  WHERE wait_event IS NOT NULL;

  -- 락 수
  SELECT COUNT(*) INTO locks_count
  FROM pg_locks
  WHERE NOT granted;

  -- 캐시 히트 비율
  SELECT
    ROUND(
      (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2
    ) INTO cache_hit_ratio
  FROM pg_statio_user_tables;

  -- JSON 결과 구성
  SELECT json_build_object(
    'active_connections', active_connections,
    'waiting_queries', waiting_queries,
    'locks_count', locks_count,
    'cache_hit_ratio', COALESCE(cache_hit_ratio, 0),
    'timestamp', EXTRACT(EPOCH FROM NOW())
  ) INTO result;

  RETURN result;
END;
$$;

-- ===============================================
-- 인덱스 및 성능 설정
-- ===============================================

-- 사용자 테이블 인덱스 (검색 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_search
ON users USING gin(email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_search
ON users USING gin(username gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status_role
ON users (status, role) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at_desc
ON users (created_at DESC) WHERE deleted_at IS NULL;

-- 프로젝트 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_status
ON projects (user_id, status) WHERE is_deleted = false;

-- 비디오 에셋 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_assets_status_provider
ON video_assets (status, provider) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_assets_created_at
ON video_assets (created_at DESC) WHERE deleted_at IS NULL;

-- 에러 로그 테이블 인덱스 (만약 존재한다면)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_error_logs_level_created
ON error_logs (level, created_at DESC);

-- ===============================================
-- RPC 함수 권한 설정
-- ===============================================

-- 관리자만 실행 가능하도록 권한 설정
REVOKE EXECUTE ON FUNCTION get_admin_user_metrics FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_content_metrics FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_system_metrics FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_search_stats FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_performance_metrics FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_realtime_system_status FROM PUBLIC;

-- 필요시 특정 역할에 권한 부여
-- GRANT EXECUTE ON FUNCTION get_admin_user_metrics TO admin_role;

-- ===============================================
-- 함수 설명 (PostgreSQL 메타데이터)
-- ===============================================

COMMENT ON FUNCTION get_admin_user_metrics IS '관리자 대시보드용 사용자 메트릭 집계 함수';
COMMENT ON FUNCTION get_admin_content_metrics IS '관리자 대시보드용 콘텐츠 메트릭 집계 함수';
COMMENT ON FUNCTION get_admin_system_metrics IS '관리자 대시보드용 시스템 메트릭 집계 함수';
COMMENT ON FUNCTION get_user_search_stats IS '사용자 검색 통계 집계 함수';
COMMENT ON FUNCTION get_admin_performance_metrics IS '데이터베이스 성능 메트릭 함수';
COMMENT ON FUNCTION get_realtime_system_status IS '실시간 시스템 상태 모니터링 함수';