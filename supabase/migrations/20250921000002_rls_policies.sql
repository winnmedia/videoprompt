-- Row Level Security (RLS) 정책 설정
-- Created: 2025-09-21
-- Description: 게스트 userId 기반 데이터 격리 및 관리자 권한 예외 처리

-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 보안 함수: 현재 사용자 정보 가져오기
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    auth.uid()::UUID,
    (SELECT id FROM users WHERE email = 'guest@temp.local' LIMIT 1)
  );
$$ LANGUAGE SQL STABLE;

-- 보안 함수: 관리자 권한 확인
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.current_user_id()
    AND role = 'admin'
    AND is_deleted = FALSE
  );
$$ LANGUAGE SQL STABLE;

-- 보안 함수: 프로젝트 소유자 또는 협업자 확인
CREATE OR REPLACE FUNCTION auth.can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid
    AND (
      user_id = auth.current_user_id()
      OR auth.current_user_id() = ANY(collaborators)
      OR is_public = TRUE
      OR auth.is_admin()
    )
    AND is_deleted = FALSE
  );
$$ LANGUAGE SQL STABLE;

-- 보안 함수: 공유 토큰 검증
CREATE OR REPLACE FUNCTION auth.can_access_shared_project(share_token_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE share_token = share_token_param
    AND is_deleted = FALSE
  );
$$ LANGUAGE SQL STABLE;

-- ===========================================
-- USERS 테이블 RLS 정책
-- ===========================================

-- 사용자는 자신의 정보만 조회 가능 (관리자는 모든 정보 조회 가능)
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  USING (
    id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 사용자는 자신의 정보만 수정 가능 (관리자는 모든 정보 수정 가능)
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 신규 사용자 생성은 인증된 사용자만 가능
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 사용자 삭제는 본인 또는 관리자만 가능 (Soft Delete)
CREATE POLICY "users_delete_policy" ON users
  FOR UPDATE
  USING (
    (id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- PROJECTS 테이블 RLS 정책
-- ===========================================

-- 프로젝트 조회: 소유자, 협업자, 공개 프로젝트, 관리자
CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR auth.current_user_id() = ANY(collaborators)
    OR is_public = TRUE
    OR auth.is_admin()
    OR (share_token IS NOT NULL AND auth.can_access_shared_project(share_token))
  );

-- 프로젝트 생성: 인증된 사용자
CREATE POLICY "projects_insert_policy" ON projects
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
  );

-- 프로젝트 수정: 소유자, 협업자, 관리자
CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.current_user_id() = ANY(collaborators)
    OR auth.is_admin()
  );

-- 프로젝트 삭제: 소유자, 관리자
CREATE POLICY "projects_delete_policy" ON projects
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- STORIES 테이블 RLS 정책
-- ===========================================

-- 스토리 조회: 프로젝트 접근 권한 기반
CREATE POLICY "stories_select_policy" ON stories
  FOR SELECT
  USING (
    auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 스토리 생성: 프로젝트 접근 권한 기반
CREATE POLICY "stories_insert_policy" ON stories
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
    AND auth.can_access_project(project_id)
  );

-- 스토리 수정: 프로젝트 접근 권한 기반
CREATE POLICY "stories_update_policy" ON stories
  FOR UPDATE
  USING (
    auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 스토리 삭제: 작성자 또는 프로젝트 소유자, 관리자
CREATE POLICY "stories_delete_policy" ON stories
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- ===========================================
-- SCENARIOS 테이블 RLS 정책
-- ===========================================

-- 시나리오 조회: 프로젝트 접근 권한 기반
CREATE POLICY "scenarios_select_policy" ON scenarios
  FOR SELECT
  USING (
    auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 시나리오 생성: 프로젝트 접근 권한 기반
CREATE POLICY "scenarios_insert_policy" ON scenarios
  FOR INSERT
  WITH CHECK (
    auth.can_access_project(project_id)
  );

-- 시나리오 수정: 프로젝트 접근 권한 기반
CREATE POLICY "scenarios_update_policy" ON scenarios
  FOR UPDATE
  USING (
    auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 시나리오 삭제: 프로젝트 접근 권한 기반
CREATE POLICY "scenarios_delete_policy" ON scenarios
  FOR UPDATE
  USING (
    (auth.can_access_project(project_id) AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- VIDEO_GENERATIONS 테이블 RLS 정책
-- ===========================================

-- 영상 생성 기록 조회: 프로젝트 접근 권한 기반
CREATE POLICY "video_generations_select_policy" ON video_generations
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 영상 생성 요청: 사용자 본인만
CREATE POLICY "video_generations_insert_policy" ON video_generations
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
    AND auth.can_access_project(project_id)
  );

-- 영상 생성 수정: 요청자, 프로젝트 접근자, 관리자
CREATE POLICY "video_generations_update_policy" ON video_generations
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.can_access_project(project_id)
    OR auth.is_admin()
  );

-- 영상 생성 삭제: 요청자, 관리자
CREATE POLICY "video_generations_delete_policy" ON video_generations
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- PROMPTS 테이블 RLS 정책
-- ===========================================

-- 프롬프트 조회: 공개 프롬프트, 본인 프롬프트, 관리자
CREATE POLICY "prompts_select_policy" ON prompts
  FOR SELECT
  USING (
    is_public = TRUE
    OR user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 프롬프트 생성: 인증된 사용자
CREATE POLICY "prompts_insert_policy" ON prompts
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
  );

-- 프롬프트 수정: 작성자, 관리자
CREATE POLICY "prompts_update_policy" ON prompts
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 프롬프트 삭제: 작성자, 관리자
CREATE POLICY "prompts_delete_policy" ON prompts
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- FEEDBACKS 테이블 RLS 정책
-- ===========================================

-- 피드백 조회: 작성자, 관련 프로젝트 접근자, 관리자
CREATE POLICY "feedbacks_select_policy" ON feedbacks
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR (project_id IS NOT NULL AND auth.can_access_project(project_id))
    OR auth.is_admin()
  );

-- 피드백 생성: 인증된 사용자
CREATE POLICY "feedbacks_insert_policy" ON feedbacks
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
    AND (project_id IS NULL OR auth.can_access_project(project_id))
  );

-- 피드백 수정: 작성자, 관리자
CREATE POLICY "feedbacks_update_policy" ON feedbacks
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 피드백 삭제: 작성자, 관리자
CREATE POLICY "feedbacks_delete_policy" ON feedbacks
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- VERSIONS 테이블 RLS 정책
-- ===========================================

-- 버전 조회: 엔티티별 접근 권한 확인
CREATE POLICY "versions_select_policy" ON versions
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
    OR (
      entity_type = 'project'
      AND auth.can_access_project(entity_id)
    )
  );

-- 버전 생성: 인증된 사용자
CREATE POLICY "versions_insert_policy" ON versions
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
  );

-- 버전 수정: 생성자, 관리자
CREATE POLICY "versions_update_policy" ON versions
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 버전 삭제: 생성자, 관리자
CREATE POLICY "versions_delete_policy" ON versions
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- ASSETS 테이블 RLS 정책
-- ===========================================

-- 에셋 조회: 소유자, 프로젝트 접근자, 관리자
CREATE POLICY "assets_select_policy" ON assets
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR (project_id IS NOT NULL AND auth.can_access_project(project_id))
    OR auth.is_admin()
  );

-- 에셋 생성: 인증된 사용자
CREATE POLICY "assets_insert_policy" ON assets
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
    AND (project_id IS NULL OR auth.can_access_project(project_id))
  );

-- 에셋 수정: 소유자, 프로젝트 접근자, 관리자
CREATE POLICY "assets_update_policy" ON assets
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR (project_id IS NOT NULL AND auth.can_access_project(project_id))
    OR auth.is_admin()
  );

-- 에셋 삭제: 소유자, 관리자
CREATE POLICY "assets_delete_policy" ON assets
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- BRAND_POLICIES 테이블 RLS 정책
-- ===========================================

-- 브랜드 정책 조회: 소유자, 프로젝트 접근자, 공개 정책, 관리자
CREATE POLICY "brand_policies_select_policy" ON brand_policies
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR (project_id IS NOT NULL AND auth.can_access_project(project_id))
    OR is_public = TRUE
    OR auth.is_admin()
  );

-- 브랜드 정책 생성: 인증된 사용자
CREATE POLICY "brand_policies_insert_policy" ON brand_policies
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
    AND (project_id IS NULL OR auth.can_access_project(project_id))
  );

-- 브랜드 정책 수정: 소유자, 프로젝트 접근자, 관리자
CREATE POLICY "brand_policies_update_policy" ON brand_policies
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR (project_id IS NOT NULL AND auth.can_access_project(project_id))
    OR auth.is_admin()
  );

-- 브랜드 정책 삭제: 소유자, 관리자
CREATE POLICY "brand_policies_delete_policy" ON brand_policies
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- PROFILES 테이블 RLS 정책
-- ===========================================

-- 프로필 조회: 본인, 관리자
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 프로필 생성: 본인
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT
  WITH CHECK (
    user_id = auth.current_user_id()
  );

-- 프로필 수정: 본인, 관리자
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE
  USING (
    user_id = auth.current_user_id()
    OR auth.is_admin()
  );

-- 프로필 삭제: 본인, 관리자
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR UPDATE
  USING (
    (user_id = auth.current_user_id() AND is_deleted = FALSE)
    OR auth.is_admin()
  );

-- ===========================================
-- 게스트 사용자 지원
-- ===========================================

-- 임시 게스트 사용자 생성 (필요시)
INSERT INTO users (id, email, username, role, display_name)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'guest@temp.local',
  'guest_user',
  'guest',
  'Guest User'
)
ON CONFLICT (email) DO NOTHING;

-- ===========================================
-- 성능 최적화를 위한 부분 인덱스 추가
-- ===========================================

-- 활성 사용자 인덱스
CREATE INDEX idx_active_users ON users(id) WHERE is_deleted = FALSE;

-- 활성 프로젝트 인덱스
CREATE INDEX idx_active_projects ON projects(user_id) WHERE is_deleted = FALSE;

-- 진행 중인 영상 생성 인덱스
CREATE INDEX idx_active_video_generations ON video_generations(status)
WHERE status IN ('pending', 'processing');

-- 공개 프롬프트 인덱스
CREATE INDEX idx_public_prompts ON prompts(is_public) WHERE is_public = TRUE;

-- 미해결 피드백 인덱스
CREATE INDEX idx_open_feedbacks ON feedbacks(status) WHERE status = 'open';