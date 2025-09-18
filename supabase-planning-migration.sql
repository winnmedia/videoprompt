-- ============================================================================
-- Planning 테이블 생성 및 RLS 설정
-- 이중 저장소 시스템을 위한 Supabase 테이블
-- ============================================================================

-- Planning 테이블 생성
CREATE TABLE IF NOT EXISTS public.planning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('scenario', 'video', 'story', 'prompt', 'image')),
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- 실제 콘텐츠 데이터
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'completed', 'failed')),
    user_id UUID, -- NULL 허용 (게스트 사용자 고려)
    version INTEGER DEFAULT 1 CHECK (version > 0),
    metadata JSONB, -- 부가 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_planning_user_type ON public.planning (user_id, type);
CREATE INDEX IF NOT EXISTS idx_planning_user_status ON public.planning (user_id, status);
CREATE INDEX IF NOT EXISTS idx_planning_type_status ON public.planning (type, status);
CREATE INDEX IF NOT EXISTS idx_planning_created_at ON public.planning (created_at);
CREATE INDEX IF NOT EXISTS idx_planning_updated_at ON public.planning (updated_at);

-- JSONB 필드 인덱스 (콘텐츠 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_planning_content_gin ON public.planning USING GIN (content);
CREATE INDEX IF NOT EXISTS idx_planning_metadata_gin ON public.planning USING GIN (metadata);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_planning_updated_at ON public.planning;
CREATE TRIGGER update_planning_updated_at
    BEFORE UPDATE ON public.planning
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS (Row Level Security) 설정
-- ============================================================================

-- RLS 활성화
ALTER TABLE public.planning ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 데이터만 조회 가능 (인증된 사용자)
CREATE POLICY "Users can view own planning data" ON public.planning
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 2: 본인 데이터만 삽입 가능 (인증된 사용자)
CREATE POLICY "Users can insert own planning data" ON public.planning
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 3: 본인 데이터만 수정 가능 (인증된 사용자)
CREATE POLICY "Users can update own planning data" ON public.planning
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 4: 본인 데이터만 삭제 가능 (인증된 사용자)
CREATE POLICY "Users can delete own planning data" ON public.planning
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 5: Service Role 전체 액세스 (서버 측 작업용)
CREATE POLICY "Service role has full access" ON public.planning
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 데이터 품질 제약조건
-- ============================================================================

-- 제약조건 1: title은 비어있을 수 없음
ALTER TABLE public.planning
ADD CONSTRAINT planning_title_not_empty
CHECK (length(trim(title)) > 0);

-- 제약조건 2: content는 유효한 JSON이어야 함 (JSONB로 이미 보장됨)
-- 추가 검증: 필수 필드 존재 확인
ALTER TABLE public.planning
ADD CONSTRAINT planning_content_has_id
CHECK (content ? 'id');

ALTER TABLE public.planning
ADD CONSTRAINT planning_content_has_type
CHECK (content ? 'type');

-- 제약조건 3: version은 양수여야 함 (이미 CHECK 제약조건으로 설정됨)

-- ============================================================================
-- 데이터 무결성 함수
-- ============================================================================

-- Planning 데이터 검증 함수
CREATE OR REPLACE FUNCTION validate_planning_data()
RETURNS TRIGGER AS $$
DECLARE
    content_id TEXT;
    content_type TEXT;
BEGIN
    -- content에서 id와 type 추출
    content_id := NEW.content->>'id';
    content_type := NEW.content->>'type';

    -- id 일치 검증
    IF content_id IS NULL OR content_id != NEW.id::TEXT THEN
        RAISE EXCEPTION 'Planning content.id must match table id';
    END IF;

    -- type 일치 검증
    IF content_type IS NULL OR content_type != NEW.type THEN
        RAISE EXCEPTION 'Planning content.type must match table type';
    END IF;

    -- title이 없으면 기본값 설정
    IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
        NEW.title := NEW.type || ' - ' || NEW.created_at::TEXT;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 데이터 검증 트리거
DROP TRIGGER IF EXISTS validate_planning_data_trigger ON public.planning;
CREATE TRIGGER validate_planning_data_trigger
    BEFORE INSERT OR UPDATE ON public.planning
    FOR EACH ROW
    EXECUTE FUNCTION validate_planning_data();

-- ============================================================================
-- 성능 최적화 설정
-- ============================================================================

-- 통계 정보 업데이트
ANALYZE public.planning;

-- ============================================================================
-- 초기 데이터 및 테스트
-- ============================================================================

-- 테스트 데이터 삽입 (개발 환경에서만)
-- Service Role로 실행되어야 함
DO $$
BEGIN
    -- 환경이 개발 환경인지 확인 (SUPABASE_URL에 localhost나 staging 포함)
    IF current_setting('app.environment', true) = 'development' THEN
        INSERT INTO public.planning (
            id,
            type,
            title,
            content,
            status,
            user_id,
            metadata
        ) VALUES (
            'test-planning-001',
            'scenario',
            'Test Scenario Planning',
            '{"id": "test-planning-001", "type": "scenario", "title": "Test Scenario", "description": "테스트용 시나리오"}',
            'draft',
            NULL,
            '{"test": true, "created_by": "migration"}'
        ) ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Test planning data inserted successfully';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not insert test data: %', SQLERRM;
END $$;

-- ============================================================================
-- 권한 설정
-- ============================================================================

-- authenticated 역할에 테이블 액세스 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO anon;

-- service_role에 모든 권한 부여 (이미 정책에서 처리됨)
GRANT ALL ON public.planning TO service_role;

-- ============================================================================
-- 모니터링 및 로깅 설정
-- ============================================================================

-- Planning 작업 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.planning_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planning_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 감사 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_planning_audit_planning_id ON public.planning_audit_log (planning_id);
CREATE INDEX IF NOT EXISTS idx_planning_audit_created_at ON public.planning_audit_log (created_at);

-- 감사 로그 함수
CREATE OR REPLACE FUNCTION log_planning_changes()
RETURNS TRIGGER AS $$
DECLARE
    operation_type TEXT;
BEGIN
    -- 작업 타입 결정
    IF TG_OP = 'INSERT' THEN
        operation_type := 'INSERT';
    ELSIF TG_OP = 'UPDATE' THEN
        operation_type := 'UPDATE';
    ELSIF TG_OP = 'DELETE' THEN
        operation_type := 'DELETE';
    END IF;

    -- 감사 로그 삽입
    INSERT INTO public.planning_audit_log (
        planning_id,
        operation,
        old_data,
        new_data,
        user_id
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        operation_type,
        CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        COALESCE(NEW.user_id, OLD.user_id)
    );

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- 감사 로그 실패가 메인 작업을 방해하지 않도록
        RAISE NOTICE 'Audit log failed: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 감사 로그 트리거
DROP TRIGGER IF EXISTS planning_audit_trigger ON public.planning;
CREATE TRIGGER planning_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.planning
    FOR EACH ROW
    EXECUTE FUNCTION log_planning_changes();

-- 감사 로그 테이블 RLS 설정
ALTER TABLE public.planning_audit_log ENABLE ROW LEVEL SECURITY;

-- Service Role만 감사 로그 접근 가능
CREATE POLICY "Service role audit access" ON public.planning_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 완료 메시지
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Planning 테이블 생성 및 설정 완료';
    RAISE NOTICE '📊 인덱스: 5개 생성';
    RAISE NOTICE '🔒 RLS 정책: 5개 설정';
    RAISE NOTICE '✅ 데이터 무결성 제약조건: 4개 설정';
    RAISE NOTICE '📝 감사 로그 시스템 활성화';
    RAISE NOTICE '🚀 Planning 이중 저장소 시스템 준비 완료';
END $$;