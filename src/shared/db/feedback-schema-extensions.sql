-- ===================================================================
-- Phase 3.9 영상 피드백 기능 확장 - Supabase DB 스키마
-- ===================================================================
-- Arthur의 설계 + Benjamin의 검증된 계약을 반영한 완전한 스키마
-- CLAUDE.md 준수: 타입 안전성, 제약 조건, 인덱스 최적화

-- ===================================================================
-- 1. 버전 관리 테이블
-- ===================================================================

-- video_versions: 영상 버전 메타데이터 관리
CREATE TABLE IF NOT EXISTS video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  video_slot TEXT NOT NULL CHECK (video_slot IN ('a', 'b')),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  uploader_type TEXT NOT NULL CHECK (uploader_type IN ('project_owner', 'collaborator', 'client', 'guest')),

  -- 파일 메타데이터
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 314572800), -- 300MB
  duration DECIMAL(10,3) NOT NULL CHECK (duration > 0), -- 초단위, 소수점 3자리
  codec TEXT NOT NULL,
  resolution_width INTEGER NOT NULL CHECK (resolution_width > 0),
  resolution_height INTEGER NOT NULL CHECK (resolution_height > 0),
  thumbnail_url TEXT,

  -- 버전 관리
  is_active BOOLEAN NOT NULL DEFAULT false,
  replace_reason TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약 조건
  UNIQUE(session_id, video_slot, version_number),
  CHECK (length(file_hash) = 64), -- SHA-256 해시 길이
  CHECK (length(original_filename) <= 255),
  CHECK (codec IN ('H.264', 'H.265', 'VP9', 'AV1', 'HEVC'))
);

-- 인덱스 최적화
CREATE INDEX idx_video_versions_session_slot ON video_versions(session_id, video_slot);
CREATE INDEX idx_video_versions_active ON video_versions(session_id, video_slot, is_active) WHERE is_active = true;
CREATE INDEX idx_video_versions_uploader ON video_versions(uploader_id, created_at DESC);
CREATE INDEX idx_video_versions_hash ON video_versions(file_hash); -- 중복 업로드 방지

-- ===================================================================
-- 2. 스레드 댓글 확장
-- ===================================================================

-- 기존 feedback_comments 테이블에 스레드 기능 추가
ALTER TABLE feedback_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 3),
ADD COLUMN IF NOT EXISTS thread_id UUID, -- 스레드 루트 댓글 ID
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES video_versions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 스레드 제약 조건
ALTER TABLE feedback_comments
ADD CONSTRAINT chk_thread_depth CHECK (
  (parent_id IS NULL AND depth = 0) OR
  (parent_id IS NOT NULL AND depth > 0)
);

-- 스레드 인덱스
CREATE INDEX IF NOT EXISTS idx_feedback_comments_thread ON feedback_comments(thread_id, depth, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_parent ON feedback_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_comments_version ON feedback_comments(version_id) WHERE version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_comments_resolved ON feedback_comments(session_id, is_resolved);

-- ===================================================================
-- 3. 감정 반응 시스템
-- ===================================================================

-- comment_emotions: 댓글별 감정 표현
CREATE TABLE IF NOT EXISTS comment_emotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES feedback_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  emotion_type TEXT NOT NULL CHECK (emotion_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry', 'confused', 'idea', 'approve', 'reject')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 한 사용자는 하나의 댓글에 하나의 감정만
  UNIQUE(comment_id, user_id)
);

-- 감정 반응 인덱스
CREATE INDEX idx_comment_emotions_comment ON comment_emotions(comment_id, emotion_type);
CREATE INDEX idx_comment_emotions_user ON comment_emotions(user_id, created_at DESC);

-- ===================================================================
-- 4. 고급 공유 시스템
-- ===================================================================

-- share_links: 공유 링크 관리
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  short_url TEXT NOT NULL UNIQUE,

  -- 생성자 정보
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_name TEXT NOT NULL,

  -- 권한 설정
  access_level TEXT NOT NULL CHECK (access_level IN ('view', 'comment', 'react', 'edit', 'admin')),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER CHECK (max_uses > 0 OR max_uses = -1), -- -1 = 무제한
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),

  -- 제한 설정
  allowed_domains TEXT[], -- 허용 도메인 목록
  requires_auth BOOLEAN NOT NULL DEFAULT false,

  -- 상태
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- 제약 조건
  CHECK (length(token) = 32),
  CHECK (length(short_url) = 8),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- 공유 링크 인덱스
CREATE INDEX idx_share_links_session ON share_links(session_id, is_active);
CREATE INDEX idx_share_links_token ON share_links(token) WHERE is_active = true;
CREATE INDEX idx_share_links_creator ON share_links(created_by, created_at DESC);
CREATE INDEX idx_share_links_expiry ON share_links(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;

-- share_permissions: 공유 권한 세부 설정
CREATE TABLE IF NOT EXISTS share_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,

  -- 세부 권한
  can_view_videos BOOLEAN NOT NULL DEFAULT true,
  can_add_comments BOOLEAN NOT NULL DEFAULT false,
  can_add_reactions BOOLEAN NOT NULL DEFAULT false,
  can_download_videos BOOLEAN NOT NULL DEFAULT false,
  can_capture_screenshots BOOLEAN NOT NULL DEFAULT false,
  can_see_other_comments BOOLEAN NOT NULL DEFAULT true,
  can_resolve_comments BOOLEAN NOT NULL DEFAULT false,
  can_edit_own_comments BOOLEAN NOT NULL DEFAULT true,
  can_delete_own_comments BOOLEAN NOT NULL DEFAULT false,

  -- 버전 관련 권한
  can_switch_versions BOOLEAN NOT NULL DEFAULT true,
  can_upload_versions BOOLEAN NOT NULL DEFAULT false,
  can_activate_versions BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- share_access_logs: 공유 링크 접근 로그
CREATE TABLE IF NOT EXISTS share_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,

  -- 접근자 정보
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 로그인한 경우
  guest_identifier TEXT, -- 게스트인 경우 (IP + User-Agent 해시)
  ip_address INET,
  user_agent TEXT,

  -- 접근 정보
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_type TEXT NOT NULL CHECK (action_type IN ('view', 'comment', 'react', 'download', 'screenshot')),
  session_duration INTEGER, -- 세션 지속 시간 (초)

  -- 지리적 정보 (선택적)
  country_code CHAR(2),
  city TEXT
);

-- 접근 로그 인덱스
CREATE INDEX idx_share_access_logs_link ON share_access_logs(share_link_id, accessed_at DESC);
CREATE INDEX idx_share_access_logs_user ON share_access_logs(user_id, accessed_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_share_access_logs_action ON share_access_logs(action_type, accessed_at DESC);

-- ===================================================================
-- 5. 스크린샷 시스템
-- ===================================================================

-- screenshots: 캡처된 스크린샷 관리
CREATE TABLE IF NOT EXISTS screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  video_slot TEXT NOT NULL CHECK (video_slot IN ('a', 'b')),
  version_id UUID NOT NULL REFERENCES video_versions(id) ON DELETE CASCADE,

  -- 캡처 정보
  timecode_ms INTEGER NOT NULL CHECK (timecode_ms >= 0), -- 밀리초 단위
  captured_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  captured_by_name TEXT NOT NULL,

  -- 파일 정보
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  format TEXT NOT NULL CHECK (format IN ('jpg', 'png', 'webp')),
  quality INTEGER NOT NULL CHECK (quality >= 1 AND quality <= 100),

  -- 이미지 메타데이터
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),

  -- 설정
  include_timestamp BOOLEAN NOT NULL DEFAULT true,
  include_project_info BOOLEAN NOT NULL DEFAULT true,

  -- 메타데이터
  project_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약 조건
  CHECK (length(filename) <= 255),
  UNIQUE(session_id, version_id, timecode_ms, captured_by) -- 중복 캡처 방지
);

-- 스크린샷 인덱스
CREATE INDEX idx_screenshots_session ON screenshots(session_id, created_at DESC);
CREATE INDEX idx_screenshots_version ON screenshots(version_id, timecode_ms);
CREATE INDEX idx_screenshots_user ON screenshots(captured_by, created_at DESC);

-- ===================================================================
-- 6. 댓글 첨부 파일
-- ===================================================================

-- comment_attachments: 댓글 첨부 파일
CREATE TABLE IF NOT EXISTS comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES feedback_comments(id) ON DELETE CASCADE,

  -- 파일 정보
  type TEXT NOT NULL CHECK (type IN ('screenshot', 'file', 'link')),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size INTEGER CHECK (file_size > 0),
  mime_type TEXT,

  -- 메타데이터
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약 조건
  CHECK (
    (type = 'link' AND file_size IS NULL) OR
    (type != 'link' AND file_size IS NOT NULL)
  ),
  CHECK (length(filename) <= 255)
);

-- 첨부 파일 인덱스
CREATE INDEX idx_comment_attachments_comment ON comment_attachments(comment_id, created_at);
CREATE INDEX idx_comment_attachments_type ON comment_attachments(type, created_at DESC);

-- ===================================================================
-- 7. 실시간 이벤트 로그
-- ===================================================================

-- realtime_events: 실시간 이벤트 추적
CREATE TABLE IF NOT EXISTS realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,

  -- 이벤트 정보
  event_type TEXT NOT NULL CHECK (event_type IN (
    'version_uploaded', 'version_activated', 'thread_created', 'thread_resolved',
    'comment_replied', 'screenshot_captured', 'share_link_created', 'share_link_accessed'
  )),

  -- 사용자 정보
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,

  -- 이벤트 데이터
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days') -- 30일 후 자동 삭제
);

-- 실시간 이벤트 인덱스
CREATE INDEX idx_realtime_events_session ON realtime_events(session_id, created_at DESC);
CREATE INDEX idx_realtime_events_type ON realtime_events(event_type, created_at DESC);
CREATE INDEX idx_realtime_events_expiry ON realtime_events(expires_at);

-- ===================================================================
-- 8. 뷰와 함수들
-- ===================================================================

-- 스레드별 댓글 통계 뷰
CREATE OR REPLACE VIEW thread_stats AS
SELECT
  thread_id,
  COUNT(*) as total_comments,
  COUNT(DISTINCT author_id) as participant_count,
  MAX(created_at) as last_activity,
  BOOL_OR(is_resolved) as is_resolved,
  MIN(CASE WHEN is_resolved THEN resolved_at END) as resolved_at,
  MIN(CASE WHEN is_resolved THEN resolved_by END) as resolved_by
FROM feedback_comments
WHERE thread_id IS NOT NULL
GROUP BY thread_id;

-- 버전별 활성 댓글 수 뷰
CREATE OR REPLACE VIEW version_comment_stats AS
SELECT
  v.id as version_id,
  v.session_id,
  v.video_slot,
  v.version_number,
  COUNT(c.id) as comment_count,
  COUNT(CASE WHEN c.is_resolved = false THEN 1 END) as unresolved_count
FROM video_versions v
LEFT JOIN feedback_comments c ON v.id = c.version_id
GROUP BY v.id, v.session_id, v.video_slot, v.version_number;

-- 공유 링크 사용 통계 뷰
CREATE OR REPLACE VIEW share_link_stats AS
SELECT
  sl.id,
  sl.session_id,
  sl.token,
  sl.access_level,
  sl.used_count,
  sl.max_uses,
  COUNT(sal.id) as total_accesses,
  COUNT(DISTINCT sal.user_id) as unique_users,
  MAX(sal.accessed_at) as last_access
FROM share_links sl
LEFT JOIN share_access_logs sal ON sl.id = sal.share_link_id
WHERE sl.is_active = true
GROUP BY sl.id, sl.session_id, sl.token, sl.access_level, sl.used_count, sl.max_uses;

-- ===================================================================
-- 9. 트리거 함수들
-- ===================================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_video_versions_updated_at
  BEFORE UPDATE ON video_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 버전 활성화 시 다른 버전 비활성화 함수
CREATE OR REPLACE FUNCTION activate_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true AND OLD.is_active = false THEN
    -- 같은 세션, 같은 슬롯의 다른 버전들을 비활성화
    UPDATE video_versions
    SET is_active = false, updated_at = NOW()
    WHERE session_id = NEW.session_id
      AND video_slot = NEW.video_slot
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER activate_version_trigger
  AFTER UPDATE ON video_versions
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION activate_version_trigger();

-- 스레드 ID 자동 설정 함수
CREATE OR REPLACE FUNCTION set_thread_id_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- 루트 댓글인 경우 자신의 ID를 thread_id로 설정
  IF NEW.parent_id IS NULL THEN
    NEW.thread_id = NEW.id;
  ELSE
    -- 대댓글인 경우 부모의 thread_id를 상속
    SELECT thread_id INTO NEW.thread_id
    FROM feedback_comments
    WHERE id = NEW.parent_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_thread_id_trigger
  BEFORE INSERT ON feedback_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_thread_id_trigger();

-- ===================================================================
-- 10. RLS (Row Level Security) 정책
-- ===================================================================

-- video_versions RLS
ALTER TABLE video_versions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신이 참여한 세션의 버전만 조회/수정 가능
CREATE POLICY video_versions_access_policy ON video_versions
  FOR ALL USING (
    session_id IN (
      SELECT fs.id FROM feedback_sessions fs
      WHERE fs.created_by = auth.uid()
        OR fs.id IN (
          SELECT sp.session_id FROM session_participants sp
          WHERE sp.user_id = auth.uid()
        )
    )
  );

-- comment_emotions RLS
ALTER TABLE comment_emotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_emotions_access_policy ON comment_emotions
  FOR ALL USING (
    comment_id IN (
      SELECT fc.id FROM feedback_comments fc
      JOIN feedback_sessions fs ON fc.session_id = fs.id
      WHERE fs.created_by = auth.uid()
        OR fc.session_id IN (
          SELECT sp.session_id FROM session_participants sp
          WHERE sp.user_id = auth.uid()
        )
    )
  );

-- share_links RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_links_access_policy ON share_links
  FOR ALL USING (
    created_by = auth.uid()
    OR session_id IN (
      SELECT fs.id FROM feedback_sessions fs
      WHERE fs.created_by = auth.uid()
    )
  );

-- screenshots RLS
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY screenshots_access_policy ON screenshots
  FOR ALL USING (
    session_id IN (
      SELECT fs.id FROM feedback_sessions fs
      WHERE fs.created_by = auth.uid()
        OR fs.id IN (
          SELECT sp.session_id FROM session_participants sp
          WHERE sp.user_id = auth.uid()
        )
    )
  );

-- ===================================================================
-- 11. 성능 최적화 및 유지보수
-- ===================================================================

-- 만료된 이벤트 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_expired_events()
RETURNS void AS $$
BEGIN
  DELETE FROM realtime_events WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 매일 자정에 만료된 이벤트 정리 (cron job으로 설정 필요)
-- SELECT cron.schedule('cleanup-expired-events', '0 0 * * *', 'SELECT cleanup_expired_events();');

-- ===================================================================
-- 12. 초기 데이터 및 설정
-- ===================================================================

-- 기본 감정 타입 확인을 위한 체크 제약조건은 이미 위에서 정의됨
-- 필요시 여기에 기본 설정 데이터 INSERT 구문 추가

COMMENT ON TABLE video_versions IS 'Phase 3.9: 영상 버전 관리 - 파일 메타데이터와 활성 버전 추적';
COMMENT ON TABLE comment_emotions IS 'Phase 3.9: 댓글 감정 반응 - 사용자별 감정 표현 시스템';
COMMENT ON TABLE share_links IS 'Phase 3.9: 고급 공유 링크 - 권한별 접근 제어';
COMMENT ON TABLE screenshots IS 'Phase 3.9: 스크린샷 캡처 - 타임코드별 스크린샷 관리';
COMMENT ON TABLE realtime_events IS 'Phase 3.9: 실시간 이벤트 - WebSocket 이벤트 추적';