-- VideoPlanet 초기 데이터베이스 스키마
-- Created: 2025-09-21
-- Description: 영상 기획 및 생성 플랫폼의 핵심 데이터 구조

-- 필수 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 공통 enum 타입 정의
CREATE TYPE user_role AS ENUM ('admin', 'user', 'guest');
CREATE TYPE project_status AS ENUM ('draft', 'planning', 'in_progress', 'completed', 'archived');
CREATE TYPE video_generation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE story_type AS ENUM ('advertisement', 'education', 'entertainment', 'corporate', 'social_media');
CREATE TYPE asset_type AS ENUM ('image', 'video', 'audio', 'template', 'font');

-- 1. Users 테이블 (Supabase Auth 확장)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    role user_role DEFAULT 'user',
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,

    -- 사용량 추적 (비용 안전)
    api_calls_today INTEGER DEFAULT 0,
    api_calls_this_month INTEGER DEFAULT 0,
    storage_usage_bytes BIGINT DEFAULT 0,

    -- 프로필 설정
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{"email": true, "push": false}',

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 2. Projects 테이블
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 기본 정보
    title TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'draft',
    thumbnail_url TEXT,

    -- 프로젝트 설정
    settings JSONB DEFAULT '{}',
    brand_guidelines JSONB DEFAULT '{}',
    target_audience TEXT,
    duration_seconds INTEGER,

    -- 협업 정보
    collaborators UUID[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    share_token TEXT UNIQUE,

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 3. Stories 테이블 (AI 생성 스토리)
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 스토리 내용
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    story_type story_type DEFAULT 'advertisement',
    tone_and_manner TEXT,
    target_audience TEXT,

    -- AI 생성 메타데이터
    ai_model_used TEXT,
    prompt_used TEXT,
    generation_metadata JSONB DEFAULT '{}',

    -- 구조화된 스토리 데이터
    structured_content JSONB DEFAULT '{}', -- {intro, body, conclusion, scenes}
    keywords TEXT[] DEFAULT '{}',
    estimated_duration INTEGER, -- seconds

    -- 버전 관리
    version INTEGER DEFAULT 1,
    parent_story_id UUID REFERENCES stories(id),

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 4. Scenarios 테이블 (씬 구성)
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- 시나리오 기본 정보
    title TEXT NOT NULL,
    description TEXT,
    scene_order INTEGER NOT NULL,
    duration_seconds INTEGER DEFAULT 30,

    -- 씬 설정
    visual_description TEXT,
    audio_description TEXT,
    transition_type TEXT DEFAULT 'fade',
    transition_duration REAL DEFAULT 1.0,

    -- 프롬프트 정보
    image_prompt TEXT,
    negative_prompt TEXT,
    style_keywords TEXT[] DEFAULT '{}',

    -- 메타데이터
    technical_specs JSONB DEFAULT '{}', -- {resolution, fps, format}

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 5. Video_Generations 테이블 (영상 생성 기록)
CREATE TABLE IF NOT EXISTS video_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 생성 상태
    status video_generation_status DEFAULT 'pending',
    external_job_id TEXT, -- ByteDance/Runway API job ID

    -- 입력 데이터
    input_prompt TEXT NOT NULL,
    input_image_url TEXT,
    generation_settings JSONB DEFAULT '{}',

    -- 출력 데이터
    output_video_url TEXT,
    output_thumbnail_url TEXT,
    output_metadata JSONB DEFAULT '{}',

    -- 진행률 및 큐 정보
    progress_percentage INTEGER DEFAULT 0,
    queue_position INTEGER,
    estimated_completion_at TIMESTAMPTZ,

    -- 재시도 로직
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error_message TEXT,

    -- 비용 추적
    estimated_cost DECIMAL(10,4),
    actual_cost DECIMAL(10,4),

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 6. Prompts 테이블 (프롬프트 라이브러리)
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- 프롬프트 내용
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',

    -- 프롬프트 메타데이터
    is_template BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,

    -- 변수 및 설정
    variables JSONB DEFAULT '{}', -- {name, type, default_value}
    style_presets JSONB DEFAULT '{}',

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 7. Feedbacks 테이블 (사용자 피드백)
CREATE TABLE IF NOT EXISTS feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    video_generation_id UUID REFERENCES video_generations(id) ON DELETE CASCADE,

    -- 피드백 내용
    type TEXT NOT NULL, -- 'bug', 'feature_request', 'improvement', 'rating'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- 메타데이터
    category TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'

    -- 첨부 파일
    attachments TEXT[] DEFAULT '{}',

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 8. Versions 테이블 (버전 관리)
CREATE TABLE IF NOT EXISTS versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL, -- 'project', 'story', 'scenario'
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 버전 정보
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    changes_summary TEXT,

    -- 스냅샷 데이터
    snapshot_data JSONB NOT NULL,
    diff_data JSONB, -- 이전 버전과의 차이점

    -- 메타데이터
    is_major_version BOOLEAN DEFAULT FALSE,
    parent_version_id UUID REFERENCES versions(id),

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 9. Assets 테이블 (미디어 에셋)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- 파일 정보
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    asset_type asset_type NOT NULL,

    -- 메타데이터
    title TEXT,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    alt_text TEXT,

    -- 이미지/비디오 메타데이터
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    thumbnail_url TEXT,

    -- 사용 추적
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- CDN 및 최적화
    cdn_url TEXT,
    optimized_urls JSONB DEFAULT '{}', -- {webp, thumbnail, etc}

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 10. Brand_Policies 테이블 (브랜드 가이드라인)
CREATE TABLE IF NOT EXISTS brand_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- 브랜드 정보
    brand_name TEXT NOT NULL,
    brand_description TEXT,

    -- 비주얼 가이드라인
    color_palette JSONB DEFAULT '{}', -- {primary, secondary, accent}
    typography JSONB DEFAULT '{}', -- {fonts, sizes, weights}
    logo_assets UUID[] DEFAULT '{}', -- references to assets table

    -- 콘텐츠 가이드라인
    tone_of_voice TEXT,
    messaging_guidelines TEXT,
    prohibited_content TEXT[] DEFAULT '{}',
    preferred_keywords TEXT[] DEFAULT '{}',

    -- 기술적 가이드라인
    preferred_formats TEXT[] DEFAULT '{}',
    resolution_requirements TEXT,
    duration_guidelines JSONB DEFAULT '{}',

    -- 메타데이터
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 11. Profiles 테이블 (확장 프로필 정보)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 개인 정보
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    job_title TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'Asia/Seoul',
    locale TEXT DEFAULT 'ko-KR',

    -- 구독 및 플랜
    subscription_plan TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    subscription_expires_at TIMESTAMPTZ,

    -- 사용량 한도
    monthly_api_limit INTEGER DEFAULT 100,
    monthly_storage_limit BIGINT DEFAULT 1073741824, -- 1GB in bytes

    -- 소셜 링크
    social_links JSONB DEFAULT '{}',

    -- 온보딩 상태
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,

    -- Audit 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- 인덱스 생성
-- Users 테이블 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_is_deleted ON users(is_deleted) WHERE is_deleted = FALSE;

-- Projects 테이블 인덱스
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_is_deleted ON projects(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;

-- Stories 테이블 인덱스
CREATE INDEX idx_stories_project_id ON stories(project_id);
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_story_type ON stories(story_type);
CREATE INDEX idx_stories_created_at ON stories(created_at);
CREATE INDEX idx_stories_is_deleted ON stories(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_stories_parent_id ON stories(parent_story_id) WHERE parent_story_id IS NOT NULL;

-- Scenarios 테이블 인덱스
CREATE INDEX idx_scenarios_story_id ON scenarios(story_id);
CREATE INDEX idx_scenarios_project_id ON scenarios(project_id);
CREATE INDEX idx_scenarios_scene_order ON scenarios(scene_order);
CREATE INDEX idx_scenarios_is_deleted ON scenarios(is_deleted) WHERE is_deleted = FALSE;

-- Video_Generations 테이블 인덱스
CREATE INDEX idx_video_generations_scenario_id ON video_generations(scenario_id);
CREATE INDEX idx_video_generations_project_id ON video_generations(project_id);
CREATE INDEX idx_video_generations_user_id ON video_generations(user_id);
CREATE INDEX idx_video_generations_status ON video_generations(status);
CREATE INDEX idx_video_generations_external_job_id ON video_generations(external_job_id) WHERE external_job_id IS NOT NULL;
CREATE INDEX idx_video_generations_created_at ON video_generations(created_at);
CREATE INDEX idx_video_generations_is_deleted ON video_generations(is_deleted) WHERE is_deleted = FALSE;

-- Prompts 테이블 인덱스
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_is_public ON prompts(is_public);
CREATE INDEX idx_prompts_is_template ON prompts(is_template);
CREATE INDEX idx_prompts_tags ON prompts USING GIN(tags);
CREATE INDEX idx_prompts_is_deleted ON prompts(is_deleted) WHERE is_deleted = FALSE;

-- Feedbacks 테이블 인덱스
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_project_id ON feedbacks(project_id);
CREATE INDEX idx_feedbacks_type ON feedbacks(type);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at);
CREATE INDEX idx_feedbacks_is_deleted ON feedbacks(is_deleted) WHERE is_deleted = FALSE;

-- Versions 테이블 인덱스
CREATE INDEX idx_versions_entity_type_id ON versions(entity_type, entity_id);
CREATE INDEX idx_versions_user_id ON versions(user_id);
CREATE INDEX idx_versions_created_at ON versions(created_at);
CREATE INDEX idx_versions_parent_version_id ON versions(parent_version_id) WHERE parent_version_id IS NOT NULL;
CREATE INDEX idx_versions_is_deleted ON versions(is_deleted) WHERE is_deleted = FALSE;

-- Assets 테이블 인덱스
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX idx_assets_created_at ON assets(created_at);
CREATE INDEX idx_assets_is_deleted ON assets(is_deleted) WHERE is_deleted = FALSE;

-- Brand_Policies 테이블 인덱스
CREATE INDEX idx_brand_policies_user_id ON brand_policies(user_id);
CREATE INDEX idx_brand_policies_project_id ON brand_policies(project_id);
CREATE INDEX idx_brand_policies_is_default ON brand_policies(is_default);
CREATE INDEX idx_brand_policies_is_deleted ON brand_policies(is_deleted) WHERE is_deleted = FALSE;

-- Profiles 테이블 인덱스
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_subscription_plan ON profiles(subscription_plan);
CREATE INDEX idx_profiles_is_deleted ON profiles(is_deleted) WHERE is_deleted = FALSE;

-- 전문 검색 인덱스 (풀텍스트 서치)
CREATE INDEX idx_projects_title_search ON projects USING GIN(to_tsvector('korean', title));
CREATE INDEX idx_stories_content_search ON stories USING GIN(to_tsvector('korean', title || ' ' || content));
CREATE INDEX idx_prompts_content_search ON prompts USING GIN(to_tsvector('korean', title || ' ' || content));