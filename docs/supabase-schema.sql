-- VideoPlanet Supabase Database Schema
-- Phase 9: 핵심 기능 완성을 위한 데이터베이스 스키마
-- 생성일: 2025-09-24

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Supabase Auth 확장)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT false,
  guest_session_id TEXT,
  subscription_tier TEXT DEFAULT 'free',
  usage_stats JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Scenarios table
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  genre TEXT NOT NULL,
  style TEXT NOT NULL,
  target TEXT NOT NULL,
  structure TEXT NOT NULL,
  intensity TEXT NOT NULL,
  quality_score INTEGER DEFAULT 0,
  estimated_duration INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0.0000,
  tokens INTEGER DEFAULT 0,
  feedback TEXT[] DEFAULT '{}',
  suggestions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Stories table (4단계 스토리)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  genre TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  tone TEXT NOT NULL,
  total_duration INTEGER DEFAULT 0,

  -- 4단계 Acts (JSONB로 저장)
  acts JSONB NOT NULL DEFAULT '{}',

  -- 생성 파라미터
  generation_params JSONB DEFAULT '{}',

  -- 메타데이터
  status TEXT DEFAULT 'draft',
  progress INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Shots table (12단계 숏트)
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 숏트 기본 정보
  shot_number INTEGER NOT NULL,
  global_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- 영화적 요소
  act_type TEXT NOT NULL, -- 'setup', 'development', 'climax', 'resolution'
  shot_type TEXT NOT NULL, -- '클로즈업', '미디엄 샷' 등
  camera_angle TEXT NOT NULL,
  lighting TEXT NOT NULL,
  duration INTEGER NOT NULL,

  -- 스토리보드 정보
  storyboard JSONB DEFAULT '{"status": "pending"}',

  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  UNIQUE(story_id, shot_number)
);

-- Prompts table (AI 프롬프트)
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shot_id UUID REFERENCES public.shots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 프롬프트 정보
  positive_prompt TEXT NOT NULL,
  negative_prompt TEXT DEFAULT '',
  style_keywords TEXT[] DEFAULT '{}',
  technical_specs JSONB DEFAULT '{}',

  -- AI 모델 정보
  model_name TEXT DEFAULT 'stable-diffusion',
  model_version TEXT DEFAULT 'v1.5',

  -- 생성 결과
  generated_at TIMESTAMP WITH TIME ZONE,
  generation_time_ms INTEGER,
  cost DECIMAL(10,4) DEFAULT 0.0000,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- API Usage Tracking (비용 추적)
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_tokens INTEGER DEFAULT 0,
  response_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,4) DEFAULT 0.0000,
  response_time_ms INTEGER DEFAULT 0,
  status_code INTEGER DEFAULT 200,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS) 설정
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- user_profiles 정책
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- scenarios 정책
CREATE POLICY "Users can view own scenarios" ON public.scenarios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenarios" ON public.scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenarios" ON public.scenarios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenarios" ON public.scenarios
  FOR DELETE USING (auth.uid() = user_id);

-- stories 정책
CREATE POLICY "Users can view own stories" ON public.stories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- shots 정책
CREATE POLICY "Users can view own shots" ON public.shots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shots" ON public.shots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shots" ON public.shots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shots" ON public.shots
  FOR DELETE USING (auth.uid() = user_id);

-- prompts 정책
CREATE POLICY "Users can view own prompts" ON public.prompts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts" ON public.prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts" ON public.prompts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts" ON public.prompts
  FOR DELETE USING (auth.uid() = user_id);

-- api_usage 정책
CREATE POLICY "Users can view own API usage" ON public.api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API usage" ON public.api_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON public.scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON public.scenarios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_scenario_id ON public.stories(scenario_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_shots_story_id ON public.shots(story_id);
CREATE INDEX IF NOT EXISTS idx_shots_user_id ON public.shots(user_id);
CREATE INDEX IF NOT EXISTS idx_shots_shot_number ON public.shots(shot_number);
CREATE INDEX IF NOT EXISTS idx_prompts_shot_id ON public.prompts(shot_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_shots_updated_at BEFORE UPDATE ON public.shots
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();