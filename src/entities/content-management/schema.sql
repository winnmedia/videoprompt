-- Content Management System Schema Extension
-- CLAUDE.md 준수: 콘텐츠 관리 대시보드 지원을 위한 Supabase 스키마 확장

-- ==============================================
-- Content Items 통합 테이블
-- ==============================================

-- 모든 콘텐츠 타입을 통합 관리하는 메인 테이블
CREATE TABLE IF NOT EXISTS content_items (
    -- 기본 식별자
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 콘텐츠 분류
    type VARCHAR(20) NOT NULL CHECK (type IN ('scenario', 'prompt', 'image', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'processing', 'failed', 'deleted')),
    usage_type VARCHAR(20) NOT NULL DEFAULT 'instance' CHECK (usage_type IN ('template', 'instance', 'variation', 'archive')),

    -- 기본 메타데이터
    title VARCHAR(200) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',

    -- 관계 정보
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES content_items(id) ON DELETE SET NULL, -- 원본/변형 관계

    -- 사용 통계
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- 콘텐츠 데이터 (JSONB로 타입별 데이터 저장)
    content_data JSONB NOT NULL,

    -- 버전 관리
    version INTEGER NOT NULL DEFAULT 1,
    checksum VARCHAR(64) NOT NULL, -- 콘텐츠 변경 감지용 해시

    -- 시간 정보
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- 소프트 삭제
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    -- 인덱스 최적화를 위한 제약조건
    CONSTRAINT content_items_title_length CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
    CONSTRAINT content_items_description_length CHECK (description IS NULL OR LENGTH(description) <= 1000),
    CONSTRAINT content_items_tags_count CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 10)
);

-- ==============================================
-- 인덱스 생성
-- ==============================================

-- 기본 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_user_id ON content_items(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_project_id ON content_items(project_id) WHERE NOT is_deleted;

-- 복합 인덱스 (필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_content_items_user_type ON content_items(user_id, type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_project_type ON content_items(project_id, type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_status_type ON content_items(status, type) WHERE NOT is_deleted;

-- 시간 기반 인덱스
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_updated_at ON content_items(updated_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_content_items_last_used_at ON content_items(last_used_at DESC) WHERE NOT is_deleted AND last_used_at IS NOT NULL;

-- 사용 통계 인덱스
CREATE INDEX IF NOT EXISTS idx_content_items_usage_count ON content_items(usage_count DESC) WHERE NOT is_deleted;

-- 태그 검색 인덱스 (GIN 인덱스 사용)
CREATE INDEX IF NOT EXISTS idx_content_items_tags ON content_items USING GIN(tags) WHERE NOT is_deleted;

-- 전문 검색 인덱스 (제목, 설명)
CREATE INDEX IF NOT EXISTS idx_content_items_text_search ON content_items USING GIN(
    to_tsvector('korean', COALESCE(title, '') || ' ' || COALESCE(description, ''))
) WHERE NOT is_deleted;

-- JSONB 콘텐츠 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_content_items_content_data ON content_items USING GIN(content_data) WHERE NOT is_deleted;

-- 계층 구조 인덱스 (부모-자식 관계)
CREATE INDEX IF NOT EXISTS idx_content_items_parent_id ON content_items(parent_id) WHERE NOT is_deleted AND parent_id IS NOT NULL;

-- ==============================================
-- 트리거 함수 생성
-- ==============================================

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_content_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 사용 횟수 증가 트리거 함수
CREATE OR REPLACE FUNCTION increment_content_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.usage_count = NEW.usage_count + 1;
    NEW.last_used_at = NOW();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 체크섬 검증 트리거 함수
CREATE OR REPLACE FUNCTION validate_content_checksum()
RETURNS TRIGGER AS $$
BEGIN
    -- 체크섬이 변경되었는지 확인
    IF OLD.content_data IS DISTINCT FROM NEW.content_data THEN
        -- 콘텐츠가 변경되면 버전 증가
        NEW.version = OLD.version + 1;
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 트리거 생성
-- ==============================================

-- updated_at 자동 업데이트
CREATE TRIGGER trigger_content_items_updated_at
    BEFORE UPDATE ON content_items
    FOR EACH ROW
    EXECUTE FUNCTION update_content_items_updated_at();

-- 콘텐츠 변경 시 버전 관리
CREATE TRIGGER trigger_content_items_version
    BEFORE UPDATE ON content_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_content_checksum();

-- ==============================================
-- RLS (Row Level Security) 정책
-- ==============================================

-- RLS 활성화
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 콘텐츠만 접근 가능
CREATE POLICY "Users can access their own content" ON content_items
    FOR ALL USING (auth.uid() = user_id);

-- 프로젝트 공유 시 읽기 권한
CREATE POLICY "Shared project content read access" ON content_items
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.is_public = true
            OR auth.uid() = ANY(p.collaborators)
        )
    );

-- 관리자는 모든 콘텐츠 접근 가능
CREATE POLICY "Admin full access" ON content_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- ==============================================
-- 콘텐츠 매핑 뷰 생성
-- ==============================================

-- 시나리오 콘텐츠 뷰
CREATE OR REPLACE VIEW scenario_content_items AS
SELECT
    id,
    title,
    description,
    tags,
    project_id,
    user_id,
    parent_id,
    usage_count,
    last_used_at,
    (content_data->>'story') as story,
    (content_data->'scenes') as scenes,
    (content_data->>'tone') as tone,
    (content_data->>'genre') as genre,
    (content_data->>'duration')::numeric as duration,
    (content_data->>'characterCount')::integer as character_count,
    version,
    checksum,
    created_at,
    updated_at,
    status,
    usage_type
FROM content_items
WHERE type = 'scenario' AND NOT is_deleted;

-- 프롬프트 콘텐츠 뷰
CREATE OR REPLACE VIEW prompt_content_items AS
SELECT
    id,
    title,
    description,
    tags,
    project_id,
    user_id,
    parent_id,
    usage_count,
    last_used_at,
    (content_data->>'template') as template,
    (content_data->'variables') as variables,
    (content_data->>'category') as category,
    (content_data->>'instructions') as instructions,
    (content_data->'examples') as examples,
    version,
    checksum,
    created_at,
    updated_at,
    status,
    usage_type
FROM content_items
WHERE type = 'prompt' AND NOT is_deleted;

-- 이미지 콘텐츠 뷰
CREATE OR REPLACE VIEW image_content_items AS
SELECT
    id,
    title,
    description,
    tags,
    project_id,
    user_id,
    parent_id,
    usage_count,
    last_used_at,
    (content_data->>'url') as url,
    (content_data->>'thumbnailUrl') as thumbnail_url,
    (content_data->>'prompt') as prompt,
    (content_data->>'style') as style,
    (content_data->'resolution') as resolution,
    (content_data->>'fileSize')::bigint as file_size,
    (content_data->>'format') as format,
    version,
    checksum,
    created_at,
    updated_at,
    status,
    usage_type
FROM content_items
WHERE type = 'image' AND NOT is_deleted;

-- 비디오 콘텐츠 뷰
CREATE OR REPLACE VIEW video_content_items AS
SELECT
    id,
    title,
    description,
    tags,
    project_id,
    user_id,
    parent_id,
    usage_count,
    last_used_at,
    (content_data->>'url') as url,
    (content_data->>'thumbnailUrl') as thumbnail_url,
    (content_data->>'prompt') as prompt,
    (content_data->>'duration')::numeric as duration,
    (content_data->'resolution') as resolution,
    (content_data->>'fileSize')::bigint as file_size,
    (content_data->>'format') as format,
    (content_data->>'provider') as provider,
    version,
    checksum,
    created_at,
    updated_at,
    status,
    usage_type
FROM content_items
WHERE type = 'video' AND NOT is_deleted;

-- ==============================================
-- 유틸리티 함수들
-- ==============================================

-- 콘텐츠 사용 증가 함수
CREATE OR REPLACE FUNCTION increment_content_item_usage(content_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE content_items
    SET
        usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = content_item_id AND NOT is_deleted;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 콘텐츠 검색 함수 (전문 검색)
CREATE OR REPLACE FUNCTION search_content_items(
    search_query TEXT,
    content_types TEXT[] DEFAULT NULL,
    user_filter UUID DEFAULT NULL,
    project_filter UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    type VARCHAR(20),
    title VARCHAR(200),
    description TEXT,
    tags TEXT[],
    project_id UUID,
    user_id UUID,
    usage_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ci.id,
        ci.type,
        ci.title,
        ci.description,
        ci.tags,
        ci.project_id,
        ci.user_id,
        ci.usage_count,
        ci.created_at,
        ci.updated_at,
        ts_rank(
            to_tsvector('korean', COALESCE(ci.title, '') || ' ' || COALESCE(ci.description, '')),
            plainto_tsquery('korean', search_query)
        ) as rank
    FROM content_items ci
    WHERE
        NOT ci.is_deleted
        AND (content_types IS NULL OR ci.type = ANY(content_types))
        AND (user_filter IS NULL OR ci.user_id = user_filter)
        AND (project_filter IS NULL OR ci.project_id = project_filter)
        AND (
            to_tsvector('korean', COALESCE(ci.title, '') || ' ' || COALESCE(ci.description, ''))
            @@ plainto_tsquery('korean', search_query)
            OR ci.tags && ARRAY[search_query]
        )
    ORDER BY rank DESC, ci.updated_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 콘텐츠 통계 함수
CREATE OR REPLACE FUNCTION get_content_stats(user_filter UUID DEFAULT NULL)
RETURNS TABLE (
    total_items BIGINT,
    scenarios BIGINT,
    prompts BIGINT,
    images BIGINT,
    videos BIGINT,
    active_items BIGINT,
    total_usage BIGINT,
    most_used_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE type = 'scenario') as scenarios,
        COUNT(*) FILTER (WHERE type = 'prompt') as prompts,
        COUNT(*) FILTER (WHERE type = 'image') as images,
        COUNT(*) FILTER (WHERE type = 'video') as videos,
        COUNT(*) FILTER (WHERE status = 'active') as active_items,
        SUM(usage_count) as total_usage,
        (
            SELECT type
            FROM content_items
            WHERE NOT is_deleted
            AND (user_filter IS NULL OR user_id = user_filter)
            GROUP BY type
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as most_used_type
    FROM content_items
    WHERE
        NOT is_deleted
        AND (user_filter IS NULL OR user_id = user_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 콘텐츠 변형 생성 함수
CREATE OR REPLACE FUNCTION create_content_variation(
    original_id UUID,
    new_title TEXT,
    new_description TEXT DEFAULT NULL,
    content_modifications JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    original_content content_items%ROWTYPE;
    new_content_data JSONB;
BEGIN
    -- 원본 콘텐츠 조회
    SELECT * INTO original_content FROM content_items WHERE id = original_id AND NOT is_deleted;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original content item not found';
    END IF;

    -- 새로운 콘텐츠 데이터 생성 (원본 + 수정사항)
    new_content_data = original_content.content_data || content_modifications;

    -- 새로운 콘텐츠 아이템 생성
    INSERT INTO content_items (
        type,
        status,
        usage_type,
        title,
        description,
        tags,
        project_id,
        user_id,
        parent_id,
        content_data,
        checksum
    ) VALUES (
        original_content.type,
        'draft',
        'variation',
        new_title,
        COALESCE(new_description, original_content.description),
        original_content.tags,
        original_content.project_id,
        original_content.user_id,
        original_id,
        new_content_data,
        md5(new_content_data::text)
    ) RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 콘텐츠 아카이브 함수 (90일 이상 미사용)
CREATE OR REPLACE FUNCTION archive_unused_content(days_threshold INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE content_items
    SET
        status = 'archived',
        updated_at = NOW()
    WHERE
        NOT is_deleted
        AND status = 'active'
        AND (
            last_used_at IS NULL
            OR last_used_at < NOW() - INTERVAL '1 day' * days_threshold
        )
        AND created_at < NOW() - INTERVAL '1 day' * days_threshold;

    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 기존 데이터 마이그레이션 도우미 함수
-- ==============================================

-- 기존 시나리오를 content_items로 마이그레이션하는 함수
CREATE OR REPLACE FUNCTION migrate_scenarios_to_content_items()
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    scenario_record RECORD;
BEGIN
    -- 기존 scenarios 테이블이 있다고 가정하고 마이그레이션
    -- 실제 구현시 기존 테이블 구조에 맞게 수정 필요

    FOR scenario_record IN
        SELECT * FROM scenarios WHERE NOT is_deleted
    LOOP
        INSERT INTO content_items (
            id,
            type,
            status,
            usage_type,
            title,
            description,
            tags,
            project_id,
            user_id,
            content_data,
            checksum,
            created_at,
            updated_at
        ) VALUES (
            scenario_record.id,
            'scenario',
            'active',
            'instance',
            scenario_record.title,
            scenario_record.description,
            COALESCE(scenario_record.tags, '{}'),
            scenario_record.project_id,
            scenario_record.user_id,
            jsonb_build_object(
                'story', scenario_record.story,
                'scenes', COALESCE(scenario_record.scenes, '[]'::jsonb),
                'tone', scenario_record.tone,
                'genre', scenario_record.genre,
                'duration', scenario_record.duration,
                'characterCount', scenario_record.character_count
            ),
            md5(scenario_record.story || COALESCE(scenario_record.description, '')),
            scenario_record.created_at,
            scenario_record.updated_at
        ) ON CONFLICT (id) DO NOTHING;

        migrated_count := migrated_count + 1;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 데이터베이스 코멘트 추가
COMMENT ON TABLE content_items IS '통합 콘텐츠 관리 테이블 - 시나리오, 프롬프트, 이미지, 비디오를 통합 관리';
COMMENT ON COLUMN content_items.type IS '콘텐츠 타입: scenario, prompt, image, video';
COMMENT ON COLUMN content_items.status IS '콘텐츠 상태: draft, active, archived, processing, failed, deleted';
COMMENT ON COLUMN content_items.usage_type IS '사용 용도: template(템플릿), instance(인스턴스), variation(변형), archive(아카이브)';
COMMENT ON COLUMN content_items.content_data IS '타입별 콘텐츠 데이터를 저장하는 JSONB 필드';
COMMENT ON COLUMN content_items.parent_id IS '원본 콘텐츠 ID (변형/파생 콘텐츠인 경우)';
COMMENT ON COLUMN content_items.checksum IS '콘텐츠 변경 감지를 위한 해시값';

-- 함수 코멘트 추가
COMMENT ON FUNCTION search_content_items IS '전문 검색 및 필터링을 지원하는 콘텐츠 검색 함수';
COMMENT ON FUNCTION get_content_stats IS '사용자별 콘텐츠 통계 조회 함수';
COMMENT ON FUNCTION create_content_variation IS '기존 콘텐츠의 변형 버전 생성 함수';
COMMENT ON FUNCTION archive_unused_content IS '장기간 미사용 콘텐츠 자동 아카이브 함수';