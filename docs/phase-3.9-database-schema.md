# Phase 3.9 데이터베이스 스키마 확장 설계

## 📋 개요

Phase 3.9 영상 피드백 기능 확장을 위한 Supabase PostgreSQL 데이터베이스 스키마 설계

## 🗄️ 데이터베이스 스키마 확장

### 1. 버전 관리 테이블

#### 1.1 video_versions 테이블
```sql
CREATE TABLE video_versions (
    -- 기본 식별자
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    slot video_slot_enum NOT NULL, -- v1, v2, v3
    version_number INTEGER NOT NULL,

    -- 업로더 정보
    uploader_id UUID NOT NULL REFERENCES auth.users(id),
    uploader_name TEXT NOT NULL,
    uploader_type participant_type_enum NOT NULL,

    -- 파일 정보
    original_filename TEXT NOT NULL,
    file_hash TEXT NOT NULL, -- SHA-256
    file_size BIGINT NOT NULL, -- bytes
    file_url TEXT NOT NULL, -- Supabase Storage URL

    -- 비디오 메타데이터
    duration REAL NOT NULL, -- seconds
    codec TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    thumbnail_url TEXT,

    -- 상태 관리
    is_active BOOLEAN NOT NULL DEFAULT false,
    replace_reason TEXT,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    -- 제약 조건
    UNIQUE(session_id, slot, version_number),
    UNIQUE(file_hash), -- 중복 파일 방지
    CHECK(file_size > 0 AND file_size <= 314572800), -- 300MB 제한
    CHECK(duration > 0),
    CHECK(width > 0 AND height > 0),
    CHECK(version_number > 0)
);

-- 인덱스
CREATE INDEX idx_video_versions_session_slot ON video_versions(session_id, slot);
CREATE INDEX idx_video_versions_active ON video_versions(session_id, slot, is_active) WHERE is_active = true;
CREATE INDEX idx_video_versions_hash ON video_versions(file_hash);
CREATE INDEX idx_video_versions_uploader ON video_versions(uploader_id);
```

#### 1.2 video_slot_enum 타입
```sql
CREATE TYPE video_slot_enum AS ENUM ('v1', 'v2', 'v3');
```

### 2. 스레드 댓글 확장

#### 2.1 기존 feedback_comments 테이블 확장
```sql
-- 기존 테이블에 컬럼 추가
ALTER TABLE feedback_comments
ADD COLUMN parent_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
ADD COLUMN depth INTEGER NOT NULL DEFAULT 0,
ADD COLUMN thread_id UUID, -- 루트 댓글 ID
ADD COLUMN version_id UUID REFERENCES video_versions(id) ON DELETE SET NULL,
ADD COLUMN mentions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;

-- 제약 조건 추가
ALTER TABLE feedback_comments
ADD CONSTRAINT chk_comment_depth CHECK (depth >= 0 AND depth <= 3),
ADD CONSTRAINT chk_mentions_array CHECK (jsonb_typeof(mentions) = 'array');

-- 인덱스 추가
CREATE INDEX idx_feedback_comments_parent ON feedback_comments(parent_id);
CREATE INDEX idx_feedback_comments_thread ON feedback_comments(thread_id);
CREATE INDEX idx_feedback_comments_version ON feedback_comments(version_id);
CREATE INDEX idx_feedback_comments_depth ON feedback_comments(depth);
CREATE INDEX idx_feedback_comments_mentions ON feedback_comments USING GIN(mentions);

-- 트리거: thread_id 자동 설정
CREATE OR REPLACE FUNCTION set_comment_thread_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        -- 루트 댓글인 경우 자신의 ID를 thread_id로 설정
        NEW.thread_id := NEW.id;
    ELSE
        -- 대댓글인 경우 부모의 thread_id 상속
        SELECT thread_id INTO NEW.thread_id
        FROM feedback_comments
        WHERE id = NEW.parent_id;

        -- 깊이 계산
        SELECT depth + 1 INTO NEW.depth
        FROM feedback_comments
        WHERE id = NEW.parent_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_comment_thread_id
    BEFORE INSERT ON feedback_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_comment_thread_id();
```

#### 2.2 comment_edit_history 테이블
```sql
CREATE TABLE comment_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES feedback_comments(id) ON DELETE CASCADE,
    previous_content TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT,
    edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_comment_edit_history_comment ON comment_edit_history(comment_id);
CREATE INDEX idx_comment_edit_history_date ON comment_edit_history(edited_at);
```

#### 2.3 comment_attachments 테이블
```sql
CREATE TABLE comment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES feedback_comments(id) ON DELETE CASCADE,
    type attachment_type_enum NOT NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 첨부 파일 타입
CREATE TYPE attachment_type_enum AS ENUM ('screenshot', 'file', 'link');

-- 인덱스
CREATE INDEX idx_comment_attachments_comment ON comment_attachments(comment_id);
CREATE INDEX idx_comment_attachments_type ON comment_attachments(type);
```

### 3. 감정 반응 확장

#### 3.1 기존 emotion_reactions 테이블 확장
```sql
-- 기존 테이블에 컬럼 추가 (타임코드 반응 지원)
ALTER TABLE emotion_reactions
ADD COLUMN timecode_seconds REAL,
ADD COLUMN user_name TEXT NOT NULL DEFAULT 'Unknown User';

-- 제약 조건: 댓글 반응 또는 타임코드 반응 중 하나만
ALTER TABLE emotion_reactions
ADD CONSTRAINT chk_reaction_target
CHECK (
    (comment_id IS NOT NULL AND timecode_seconds IS NULL) OR
    (comment_id IS NULL AND timecode_seconds IS NOT NULL)
);

-- 인덱스
CREATE INDEX idx_emotion_reactions_timecode ON emotion_reactions(session_id, timecode_seconds)
WHERE timecode_seconds IS NOT NULL;
```

### 4. 고급 공유 시스템

#### 4.1 share_permissions 테이블
```sql
CREATE TABLE share_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- 권한 설정
    access_level access_level_enum NOT NULL,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    allowed_domains JSONB DEFAULT '[]'::jsonb,
    requires_auth BOOLEAN NOT NULL DEFAULT false,

    -- 상태
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,

    -- 제약 조건
    CHECK(max_uses IS NULL OR max_uses > 0),
    CHECK(used_count >= 0),
    CHECK(jsonb_typeof(allowed_domains) = 'array')
);

-- 액세스 레벨 타입
CREATE TYPE access_level_enum AS ENUM ('view', 'comment', 'react', 'edit', 'admin');

-- 인덱스
CREATE INDEX idx_share_permissions_session ON share_permissions(session_id);
CREATE INDEX idx_share_permissions_active ON share_permissions(is_active) WHERE is_active = true;
CREATE INDEX idx_share_permissions_expires ON share_permissions(expires_at) WHERE expires_at IS NOT NULL;
```

#### 4.2 share_tokens 테이블
```sql
CREATE TABLE share_tokens (
    token TEXT PRIMARY KEY, -- 32자 토큰
    permission_id UUID NOT NULL REFERENCES share_permissions(id) ON DELETE CASCADE,
    short_url TEXT UNIQUE,
    full_url TEXT NOT NULL,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_share_tokens_permission ON share_tokens(permission_id);
CREATE INDEX idx_share_tokens_short_url ON share_tokens(short_url) WHERE short_url IS NOT NULL;
```

#### 4.3 share_access_logs 테이블
```sql
CREATE TABLE share_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL REFERENCES share_tokens(token) ON DELETE CASCADE,

    -- 접근 정보
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent TEXT,
    ip_address INET,
    country TEXT,
    city TEXT,
    referrer TEXT,

    -- 사용자 정보 (로그인한 경우)
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,

    -- 액세스 결과
    access_granted BOOLEAN NOT NULL,
    denial_reason TEXT
);

-- 인덱스
CREATE INDEX idx_share_access_logs_token ON share_access_logs(token);
CREATE INDEX idx_share_access_logs_date ON share_access_logs(accessed_at);
CREATE INDEX idx_share_access_logs_ip ON share_access_logs(ip_address);
CREATE INDEX idx_share_access_logs_user ON share_access_logs(user_id) WHERE user_id IS NOT NULL;
```

### 5. 스크린샷 관리

#### 5.1 screenshots 테이블
```sql
CREATE TABLE screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES video_versions(id) ON DELETE CASCADE,

    -- 캡처 정보
    timecode_seconds REAL NOT NULL,
    timecode_formatted TEXT NOT NULL,

    -- 파일 정보
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size BIGINT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    format screenshot_format_enum NOT NULL,
    quality INTEGER NOT NULL,

    -- 메타데이터
    project_slug TEXT NOT NULL,
    include_timestamp BOOLEAN NOT NULL DEFAULT true,
    include_project_info BOOLEAN NOT NULL DEFAULT true,

    -- 생성 정보
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 제약 조건
    CHECK(timecode_seconds >= 0),
    CHECK(file_size > 0),
    CHECK(width > 0 AND height > 0),
    CHECK(quality >= 1 AND quality <= 100)
);

-- 스크린샷 형식 타입
CREATE TYPE screenshot_format_enum AS ENUM ('jpg', 'png', 'webp');

-- 인덱스
CREATE INDEX idx_screenshots_session ON screenshots(session_id);
CREATE INDEX idx_screenshots_version ON screenshots(version_id);
CREATE INDEX idx_screenshots_timecode ON screenshots(session_id, timecode_seconds);
CREATE INDEX idx_screenshots_creator ON screenshots(created_by);
CREATE INDEX idx_screenshots_date ON screenshots(created_at);
```

### 6. 스레드 통계 (Materialized View)

#### 6.1 comment_thread_stats 구체화된 뷰
```sql
CREATE MATERIALIZED VIEW comment_thread_stats AS
SELECT
    c.thread_id,
    c.session_id,
    COUNT(*) as total_comments,
    COUNT(DISTINCT c.author_id) as participant_count,
    SUM(CASE WHEN er.id IS NOT NULL THEN 1 ELSE 0 END) as total_reactions,
    MAX(c.created_at) as last_activity,
    BOOL_OR(c.is_resolved) as is_resolved,
    MIN(CASE WHEN c.is_resolved THEN c.updated_at END) as resolved_at,
    MIN(CASE WHEN c.is_resolved THEN c.author_id END) as resolved_by
FROM feedback_comments c
LEFT JOIN emotion_reactions er ON er.comment_id = c.id
WHERE c.thread_id IS NOT NULL
GROUP BY c.thread_id, c.session_id;

-- 인덱스
CREATE UNIQUE INDEX idx_comment_thread_stats_thread ON comment_thread_stats(thread_id);
CREATE INDEX idx_comment_thread_stats_session ON comment_thread_stats(session_id);

-- 새로고침 함수
CREATE OR REPLACE FUNCTION refresh_comment_thread_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY comment_thread_stats;
END;
$$ LANGUAGE plpgsql;
```

### 7. 버전 비교 이력

#### 7.1 version_comparisons 테이블
```sql
CREATE TABLE version_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    slot video_slot_enum NOT NULL,
    version_a_id UUID NOT NULL REFERENCES video_versions(id) ON DELETE CASCADE,
    version_b_id UUID NOT NULL REFERENCES video_versions(id) ON DELETE CASCADE,
    compare_type comparison_type_enum NOT NULL,

    -- 비교 결과
    duration_diff REAL, -- 초 단위 차이
    file_size_diff BIGINT, -- 바이트 단위 차이
    resolution_changed BOOLEAN NOT NULL DEFAULT false,
    codec_changed BOOLEAN NOT NULL DEFAULT false,

    -- 결과 파일
    thumbnail_comparison_url TEXT,

    -- 생성 정보
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 비교 타입
CREATE TYPE comparison_type_enum AS ENUM ('side-by-side', 'overlay', 'diff');

-- 인덱스
CREATE INDEX idx_version_comparisons_session ON version_comparisons(session_id);
CREATE INDEX idx_version_comparisons_versions ON version_comparisons(version_a_id, version_b_id);
```

### 8. RLS (Row Level Security) 정책

#### 8.1 video_versions RLS
```sql
ALTER TABLE video_versions ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 세션 참여자만
CREATE POLICY video_versions_select_policy ON video_versions
    FOR SELECT
    USING (
        session_id IN (
            SELECT fs.id
            FROM feedback_sessions fs
            JOIN feedback_participants fp ON fp.session_id = fs.id
            WHERE fp.user_id = auth.uid()
        )
    );

-- 삽입 정책: 세션 참여자만
CREATE POLICY video_versions_insert_policy ON video_versions
    FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT fs.id
            FROM feedback_sessions fs
            JOIN feedback_participants fp ON fp.session_id = fs.id
            WHERE fp.user_id = auth.uid()
        )
    );

-- 업데이트 정책: 업로더 또는 관리자만
CREATE POLICY video_versions_update_policy ON video_versions
    FOR UPDATE
    USING (
        uploader_id = auth.uid() OR
        session_id IN (
            SELECT fs.id
            FROM feedback_sessions fs
            JOIN feedback_participants fp ON fp.session_id = fs.id
            WHERE fp.user_id = auth.uid() AND fp.permissions->>'admin' = 'true'
        )
    );
```

#### 8.2 comment_attachments RLS
```sql
ALTER TABLE comment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_attachments_select_policy ON comment_attachments
    FOR SELECT
    USING (
        comment_id IN (
            SELECT fc.id
            FROM feedback_comments fc
            JOIN feedback_sessions fs ON fs.id = fc.session_id
            JOIN feedback_participants fp ON fp.session_id = fs.id
            WHERE fp.user_id = auth.uid()
        )
    );
```

#### 8.3 share_permissions RLS
```sql
ALTER TABLE share_permissions ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 생성자 또는 세션 관리자만
CREATE POLICY share_permissions_select_policy ON share_permissions
    FOR SELECT
    USING (
        created_by = auth.uid() OR
        session_id IN (
            SELECT fs.id
            FROM feedback_sessions fs
            JOIN feedback_participants fp ON fp.session_id = fs.id
            WHERE fp.user_id = auth.uid() AND fp.permissions->>'admin' = 'true'
        )
    );
```

### 9. 데이터베이스 함수

#### 9.1 활성 버전 설정 함수
```sql
CREATE OR REPLACE FUNCTION set_active_version(
    p_session_id UUID,
    p_slot video_slot_enum,
    p_version_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 기존 활성 버전 비활성화
    UPDATE video_versions
    SET is_active = false, updated_at = now()
    WHERE session_id = p_session_id AND slot = p_slot AND is_active = true;

    -- 새 버전 활성화
    UPDATE video_versions
    SET is_active = true, updated_at = now()
    WHERE id = p_version_id AND session_id = p_session_id AND slot = p_slot;

    -- 성공 여부 반환
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 9.2 댓글 트리 조회 함수
```sql
CREATE OR REPLACE FUNCTION get_comment_tree(
    p_session_id UUID,
    p_video_slot video_slot_enum DEFAULT NULL,
    p_include_resolved BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    parent_id UUID,
    depth INTEGER,
    thread_id UUID,
    path INTEGER[],
    content TEXT,
    author_name TEXT,
    created_at TIMESTAMPTZ,
    is_resolved BOOLEAN,
    reaction_counts JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        -- 루트 댓글
        SELECT
            c.id,
            c.parent_id,
            c.depth,
            c.thread_id,
            ARRAY[ROW_NUMBER() OVER (ORDER BY c.created_at)]::INTEGER[] as path,
            c.content,
            c.author_name,
            c.created_at,
            c.is_resolved,
            (
                SELECT jsonb_object_agg(er.type, er.count)
                FROM (
                    SELECT type, COUNT(*) as count
                    FROM emotion_reactions
                    WHERE comment_id = c.id
                    GROUP BY type
                ) er
            ) as reaction_counts
        FROM feedback_comments c
        WHERE c.session_id = p_session_id
          AND c.parent_id IS NULL
          AND (p_video_slot IS NULL OR c.video_slot = p_video_slot)
          AND (p_include_resolved OR NOT c.is_resolved)

        UNION ALL

        -- 대댓글
        SELECT
            c.id,
            c.parent_id,
            c.depth,
            c.thread_id,
            ct.path || ROW_NUMBER() OVER (ORDER BY c.created_at),
            c.content,
            c.author_name,
            c.created_at,
            c.is_resolved,
            (
                SELECT jsonb_object_agg(er.type, er.count)
                FROM (
                    SELECT type, COUNT(*) as count
                    FROM emotion_reactions
                    WHERE comment_id = c.id
                    GROUP BY type
                ) er
            ) as reaction_counts
        FROM feedback_comments c
        JOIN comment_tree ct ON ct.id = c.parent_id
        WHERE c.session_id = p_session_id
          AND (p_include_resolved OR NOT c.is_resolved)
    )
    SELECT * FROM comment_tree ORDER BY path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 9.3 공유 링크 사용량 증가 함수
```sql
CREATE OR REPLACE FUNCTION increment_share_usage(
    p_token TEXT,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_permission_id UUID;
    v_max_uses INTEGER;
    v_used_count INTEGER;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 토큰 정보 조회
    SELECT sp.id, sp.max_uses, sp.used_count, sp.expires_at
    INTO v_permission_id, v_max_uses, v_used_count, v_expires_at
    FROM share_tokens st
    JOIN share_permissions sp ON sp.id = st.permission_id
    WHERE st.token = p_token AND sp.is_active = true;

    -- 토큰이 없거나 비활성화된 경우
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- 만료 확인
    IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
        RETURN false;
    END IF;

    -- 사용 횟수 제한 확인
    IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
        RETURN false;
    END IF;

    -- 사용량 증가
    UPDATE share_permissions
    SET used_count = used_count + 1, last_used_at = now()
    WHERE id = v_permission_id;

    -- 액세스 로그 기록
    INSERT INTO share_access_logs (
        token, user_agent, ip_address, user_id, access_granted
    ) VALUES (
        p_token, p_user_agent, p_ip_address, p_user_id, true
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 10. 트리거

#### 10.1 스레드 통계 자동 갱신
```sql
CREATE OR REPLACE FUNCTION update_thread_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- 통계 뷰 새로고침 (비동기)
    PERFORM pg_notify('refresh_stats', 'comment_thread_stats');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_stats
    AFTER INSERT OR UPDATE OR DELETE ON feedback_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_stats_trigger();
```

#### 10.2 파일 정리 트리거
```sql
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS TRIGGER AS $$
BEGIN
    -- 파일 정리 작업을 큐에 추가
    PERFORM pg_notify('cleanup_files', json_build_object(
        'type', TG_TABLE_NAME,
        'file_url', OLD.file_url,
        'thumbnail_url', OLD.thumbnail_url
    )::text);

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 버전 삭제 시 파일 정리
CREATE TRIGGER trigger_cleanup_version_files
    AFTER DELETE ON video_versions
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_orphaned_files();

-- 스크린샷 삭제 시 파일 정리
CREATE TRIGGER trigger_cleanup_screenshot_files
    AFTER DELETE ON screenshots
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_orphaned_files();
```

### 11. 성능 최적화

#### 11.1 파티셔닝 (대용량 로그 테이블)
```sql
-- 접근 로그 테이블 월별 파티셔닝
CREATE TABLE share_access_logs_partitioned (
    LIKE share_access_logs INCLUDING ALL
) PARTITION BY RANGE (accessed_at);

-- 월별 파티션 생성 예시
CREATE TABLE share_access_logs_2025_01
PARTITION OF share_access_logs_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE share_access_logs_2025_02
PARTITION OF share_access_logs_partitioned
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

#### 11.2 복합 인덱스 최적화
```sql
-- 세션별 활성 버전 조회 최적화
CREATE INDEX idx_video_versions_session_slot_active
ON video_versions(session_id, slot)
WHERE is_active = true;

-- 댓글 트리 조회 최적화
CREATE INDEX idx_feedback_comments_session_thread_depth
ON feedback_comments(session_id, thread_id, depth, created_at);

-- 공유 링크 조회 최적화
CREATE INDEX idx_share_tokens_active_unexpired
ON share_tokens(token, permission_id)
WHERE EXISTS (
    SELECT 1 FROM share_permissions sp
    WHERE sp.id = permission_id
    AND sp.is_active = true
    AND (sp.expires_at IS NULL OR sp.expires_at > now())
);
```

### 12. 백업 및 아카이브 전략

#### 12.1 오래된 데이터 아카이브
```sql
CREATE OR REPLACE FUNCTION archive_old_data(
    p_retention_days INTEGER DEFAULT 365
)
RETURNS TABLE (
    table_name TEXT,
    archived_count BIGINT
) AS $$
DECLARE
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := now() - (p_retention_days || ' days')::INTERVAL;

    -- 오래된 액세스 로그 아카이브
    WITH archived AS (
        DELETE FROM share_access_logs
        WHERE accessed_at < v_cutoff_date
        RETURNING *
    )
    INSERT INTO share_access_logs_archive
    SELECT * FROM archived;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN QUERY SELECT 'share_access_logs'::TEXT, v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

이 데이터베이스 스키마 설계는 Phase 3.9의 모든 기능 요구사항을 지원하며, 확장성과 성능을 고려한 최적화된 구조를 제공합니다.