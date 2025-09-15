-- =============================================
-- VideoPlanet Supabase 마이그레이션 SQL
-- 사용법: Supabase Dashboard > SQL Editor에서 실행
-- =============================================

-- 1. 필요한 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users 테이블 (Auth와 연동)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  preferences JSONB,
  email_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Projects 테이블
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB,
  tags JSONB,
  scenario TEXT,
  prompt TEXT,
  video TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Stories 테이블
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  genre TEXT,
  tone TEXT,
  target_audience TEXT,
  structure JSONB,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Templates 테이블
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags JSONB,
  scenario JSONB,
  prompt JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Video Assets 테이블
CREATE TABLE IF NOT EXISTS public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration INTEGER,
  thumbnail_url TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 정책 설정
-- =============================================

-- Users 테이블 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Projects 테이블 RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Stories 테이블 RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stories"
  ON public.stories FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own stories"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Templates 테이블 RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates"
  ON public.templates FOR SELECT
  USING (is_public = true OR auth.uid()::text = user_id::text);

CREATE POLICY "Users can create templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Video Assets 테이블 RLS
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video assets"
  ON public.video_assets FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own video assets"
  ON public.video_assets FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- =============================================
-- 인덱스 생성 (성능 최적화)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON public.stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at);

CREATE INDEX IF NOT EXISTS idx_video_assets_user_id ON public.video_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_project_id ON public.video_assets(project_id);

CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);

-- =============================================
-- 트리거 함수 (Updated_at 자동 업데이트)
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Storage 버킷 생성 (수동 실행 필요)
-- =============================================

-- 다음 명령어들은 Supabase Storage 탭에서 수동으로 생성해야 합니다:
-- 1. videos (비디오 파일)
-- 2. images (이미지 파일)
-- 3. thumbnails (썸네일)
-- 4. uploads (일반 업로드)

-- Storage 정책 예시 (Storage 탭에서 설정):
-- bucket: videos
-- policy: "Users can upload to their own folder"
-- condition: auth.uid()::text = (storage.foldername(name))[1]

-- =============================================
-- 완료 메시지
-- =============================================

-- 확인용 쿼리
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'projects', 'stories', 'templates', 'video_assets')
ORDER BY tablename;