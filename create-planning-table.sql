-- ============================================================================
-- Planning 테이블 생성 (Supabase Dashboard SQL Editor용)
-- 이 파일을 Supabase Dashboard > SQL Editor에 복사해서 실행하세요
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
DROP POLICY IF EXISTS "Users can view own planning data" ON public.planning;
CREATE POLICY "Users can view own planning data" ON public.planning
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 2: 본인 데이터만 삽입 가능 (인증된 사용자)
DROP POLICY IF EXISTS "Users can insert own planning data" ON public.planning;
CREATE POLICY "Users can insert own planning data" ON public.planning
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 3: 본인 데이터만 수정 가능 (인증된 사용자)
DROP POLICY IF EXISTS "Users can update own planning data" ON public.planning;
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
DROP POLICY IF EXISTS "Users can delete own planning data" ON public.planning;
CREATE POLICY "Users can delete own planning data" ON public.planning
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- 정책 5: Service Role 전체 액세스 (서버 측 작업용)
DROP POLICY IF EXISTS "Service role has full access" ON public.planning;
CREATE POLICY "Service role has full access" ON public.planning
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 권한 설정
-- ============================================================================

-- authenticated 역할에 테이블 액세스 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO anon;

-- service_role에 모든 권한 부여
GRANT ALL ON public.planning TO service_role;

-- 완료 메시지
SELECT 'Planning 테이블이 성공적으로 생성되었습니다!' as message;