-- =============================================
-- VideoPlanet Supabase 완전한 이중 저장 마이그레이션 SQL
-- 목적: scenarios/prompts 전용 테이블 생성으로 파이프라인 단절 해결
-- =============================================

-- 1. Scenarios 테이블 (시나리오 전용)
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  structure JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Prompts 테이블 (프롬프트 전용)
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  final_prompt TEXT NOT NULL,
  keywords JSONB DEFAULT '[]',
  negative_prompt TEXT,
  visual_style TEXT,
  mood TEXT,
  quality TEXT,
  metadata JSONB DEFAULT '{}',
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS 정책 설정
-- =============================================

-- Scenarios 테이블 RLS
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenarios"
  ON public.scenarios FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own scenarios"
  ON public.scenarios FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Prompts 테이블 RLS
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompts"
  ON public.prompts FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own prompts"
  ON public.prompts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own prompts"
  ON public.prompts FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- =============================================
-- 인덱스 생성 (성능 최적화)
-- =============================================

-- Scenarios 인덱스
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON public.scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_project_id ON public.scenarios(project_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON public.scenarios(status);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON public.scenarios(created_at);

-- Prompts 인덱스
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON public.prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_scenario_id ON public.prompts(scenario_id);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON public.prompts(created_at);

-- =============================================
-- 서비스 롤 정책 (API 서버용)
-- =============================================

-- Service Role은 모든 테이블에 무제한 접근
CREATE POLICY "Service role bypass RLS on scenarios"
  ON public.scenarios FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass RLS on prompts"
  ON public.prompts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- 기존 데이터 마이그레이션 (선택적)
-- =============================================

-- stories 테이블에서 scenario/prompt 타입 데이터를 전용 테이블로 이동
-- 주의: 실제 환경에서는 백업 후 실행 권장

-- Scenario 데이터 이동
INSERT INTO public.scenarios (id, title, content, structure, metadata, status, user_id, project_id, created_at, updated_at)
SELECT
  id,
  title,
  content,
  COALESCE(structure, '{}'::jsonb),
  COALESCE(metadata, '{}'::jsonb),
  status,
  user_id,
  (metadata->>'originalProjectId')::uuid as project_id,
  created_at,
  updated_at
FROM public.stories
WHERE (metadata->>'projectType') = 'scenario'
   OR genre = 'scenario'
ON CONFLICT (id) DO NOTHING;

-- Prompt 데이터 이동
INSERT INTO public.prompts (id, title, content, final_prompt, keywords, metadata, user_id, project_id, created_at, updated_at)
SELECT
  id,
  title,
  content,
  COALESCE(structure->>'final_prompt', content),
  COALESCE(structure->'keywords', '[]'::jsonb),
  COALESCE(metadata, '{}'::jsonb),
  user_id,
  (metadata->>'originalProjectId')::uuid as project_id,
  created_at,
  updated_at
FROM public.stories
WHERE (metadata->>'projectType') = 'prompt'
   OR genre = 'prompt'
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 검증 쿼리 (실행 후 확인용)
-- =============================================

-- 테이블 생성 확인
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('scenarios', 'prompts');

-- RLS 정책 확인
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('scenarios', 'prompts');

-- 인덱스 확인
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('scenarios', 'prompts');

-- 데이터 이동 확인
-- SELECT 'scenarios' as table_name, count(*) as count FROM public.scenarios
-- UNION ALL
-- SELECT 'prompts' as table_name, count(*) as count FROM public.prompts;