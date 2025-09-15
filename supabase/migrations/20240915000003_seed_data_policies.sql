-- RLS 정책 수정 및 시드 데이터 삽입

-- 1. Templates 테이블 시드 데이터 삽입용 임시 정책
-- 기존 RLS 정책 임시 비활성화
ALTER TABLE public.templates DISABLE ROW LEVEL SECURITY;

-- 2. Templates 시드 데이터 삽입
INSERT INTO public.templates (title, description, category, tags, is_public, user_id)
VALUES
  ('기업 홍보 영상', '전문적인 기업 소개 영상 템플릿', 'business', '["corporate","professional"]'::jsonb, true, null),
  ('제품 리뷰', '제품 상세 리뷰 영상 템플릿', 'review', '["product","review"]'::jsonb, true, null),
  ('튜토리얼', '교육용 튜토리얼 영상 템플릿', 'education', '["tutorial","howto"]'::jsonb, true, null),
  ('이벤트 홍보', '이벤트 및 행사 홍보 영상', 'marketing', '["event","promotion"]'::jsonb, true, null),
  ('소셜 미디어 광고', 'SNS 광고용 짧은 영상', 'social', '["sns","ads"]'::jsonb, true, null),
  ('브랜드 스토리', '브랜드 철학과 가치를 전달하는 영상', 'brand', '["brand","story"]'::jsonb, true, null),
  ('제품 런칭', '신제품 출시 홍보 영상', 'product', '["launch","product"]'::jsonb, true, null),
  ('고객 인터뷰', '고객 후기 및 인터뷰 영상', 'testimonial', '["customer","interview"]'::jsonb, true, null)
ON CONFLICT DO NOTHING;

-- 3. RLS 다시 활성화
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 4. 적절한 RLS 정책 생성
-- 공개 템플릿 읽기 정책
CREATE POLICY IF NOT EXISTS "Public templates read" ON public.templates
FOR SELECT USING (is_public = true);

-- 사용자 개인 템플릿 전체 접근 정책
CREATE POLICY IF NOT EXISTS "User templates full access" ON public.templates
FOR ALL USING (auth.uid() = user_id);

-- 서비스 역할 전체 접근 정책 (관리자용)
CREATE POLICY IF NOT EXISTS "Service role full access" ON public.templates
FOR ALL USING (auth.role() = 'service_role');

-- 5. 기타 테이블의 기본 RLS 정책 설정

-- Users 테이블
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.users
FOR UPDATE USING (auth.uid() = id);

-- Projects 테이블
CREATE POLICY IF NOT EXISTS "Users can view own projects" ON public.projects
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage own projects" ON public.projects
FOR ALL USING (auth.uid() = user_id);

-- Stories 테이블
CREATE POLICY IF NOT EXISTS "Users can view own stories" ON public.stories
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage own stories" ON public.stories
FOR ALL USING (auth.uid() = user_id);

-- Video Assets 테이블
CREATE POLICY IF NOT EXISTS "Users can view own video assets" ON public.video_assets
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage own video assets" ON public.video_assets
FOR ALL USING (auth.uid() = user_id);

-- 6. Service Role에 대한 전체 접근 정책 (모든 테이블)
CREATE POLICY IF NOT EXISTS "Service role full access users" ON public.users
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role full access projects" ON public.projects
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role full access stories" ON public.stories
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role full access video_assets" ON public.video_assets
FOR ALL USING (auth.role() = 'service_role');