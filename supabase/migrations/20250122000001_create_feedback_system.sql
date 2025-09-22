-- ===========================================
-- 피드백 시스템 스키마 마이그레이션
-- 목적: 영상 피드백 및 협업 시스템 구현
-- 작성일: 2025-01-22
-- ===========================================

-- 1. 피드백 프로젝트 테이블
CREATE TABLE IF NOT EXISTS feedback_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- 소유자 및 권한
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- 기존 프로젝트와 연결 가능

  -- 상태
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- 설정
  settings JSONB DEFAULT '{}',
  allowed_domains TEXT[], -- 게스트 액세스를 위한 허용된 도메인
  max_video_slots INTEGER DEFAULT 3 CHECK (max_video_slots >= 1 AND max_video_slots <= 10),

  -- 접근 제어
  is_public BOOLEAN DEFAULT false,
  guest_access_enabled BOOLEAN DEFAULT true,
  require_auth BOOLEAN DEFAULT false,

  -- 게스트 링크
  share_token VARCHAR(255) UNIQUE,
  share_link_expires_at TIMESTAMP WITH TIME ZONE,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. 영상 슬롯 테이블 (v1, v2, v3)
CREATE TABLE IF NOT EXISTS video_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 프로젝트 연결
  feedback_project_id UUID NOT NULL REFERENCES feedback_projects(id) ON DELETE CASCADE,

  -- 슬롯 정보
  slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 10),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- 영상 파일 정보
  video_file_path TEXT, -- Supabase Storage 경로
  video_file_size BIGINT, -- 바이트 단위
  video_duration_seconds DECIMAL(10,2),
  video_mime_type VARCHAR(100),

  -- 썸네일 정보
  thumbnail_file_path TEXT, -- Supabase Storage 경로
  thumbnail_file_size BIGINT,

  -- 스크린샷 정보 (JSON 배열)
  screenshots JSONB DEFAULT '[]', -- [{timestamp: 10.5, file_path: "screenshots/...", thumbnail_path: "..."}]

  -- 메타데이터
  metadata JSONB DEFAULT '{}',
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_progress INTEGER DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),

  -- 업로드 정보
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_guest_id VARCHAR(255), -- 게스트 업로드 시 식별자
  upload_session_id VARCHAR(255),

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- 고유 제약
  UNIQUE(feedback_project_id, slot_number)
);

-- 3. 타임코드 피드백 테이블
CREATE TABLE IF NOT EXISTS timecode_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결 정보
  video_slot_id UUID NOT NULL REFERENCES video_slots(id) ON DELETE CASCADE,
  feedback_project_id UUID NOT NULL REFERENCES feedback_projects(id) ON DELETE CASCADE,

  -- 타임코드 정보
  timestamp_seconds DECIMAL(10,2) NOT NULL CHECK (timestamp_seconds >= 0),
  duration_seconds DECIMAL(10,2) DEFAULT 0 CHECK (duration_seconds >= 0),

  -- 피드백 내용
  feedback_text TEXT NOT NULL,
  feedback_type VARCHAR(50) DEFAULT 'general' CHECK (feedback_type IN ('general', 'technical', 'creative', 'urgent', 'approval')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- 감정 표현
  emotion_type VARCHAR(50) CHECK (emotion_type IN ('like', 'love', 'concern', 'confused', 'angry', 'excited')),
  emotion_intensity INTEGER CHECK (emotion_intensity >= 1 AND emotion_intensity <= 5),

  -- 작성자 정보
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_guest_id VARCHAR(255), -- 게스트 작성 시 식별자
  author_name VARCHAR(255), -- 게스트 작성 시 이름
  author_email VARCHAR(255), -- 게스트 작성 시 이메일

  -- 상태
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_note TEXT,

  -- 반응 및 답글
  parent_feedback_id UUID REFERENCES timecode_feedbacks(id) ON DELETE CASCADE, -- 답글용
  reactions JSONB DEFAULT '{}', -- {like: 5, love: 2, ...}

  -- 위치 정보 (영상 화면 좌표)
  position_x DECIMAL(5,2) CHECK (position_x >= 0 AND position_x <= 100), -- 백분율
  position_y DECIMAL(5,2) CHECK (position_y >= 0 AND position_y <= 100), -- 백분율

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 4. 피드백 참여자 테이블 (권한 관리)
CREATE TABLE IF NOT EXISTS feedback_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 프로젝트 연결
  feedback_project_id UUID NOT NULL REFERENCES feedback_projects(id) ON DELETE CASCADE,

  -- 참여자 정보
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_id VARCHAR(255), -- 게스트 참여자
  guest_name VARCHAR(255),
  guest_email VARCHAR(255),

  -- 권한
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'guest')),
  permissions JSONB DEFAULT '{}', -- {can_upload: true, can_comment: true, can_resolve: false, ...}

  -- 초대 정보
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invitation_token VARCHAR(255) UNIQUE,
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,

  -- 접근 정보
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,

  -- 상태
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- 고유 제약
  UNIQUE(feedback_project_id, user_id),
  UNIQUE(feedback_project_id, guest_email),

  -- 최소 하나의 식별자 필요
  CHECK (user_id IS NOT NULL OR (guest_id IS NOT NULL AND guest_email IS NOT NULL))
);

-- 5. 감정 표현 로그 테이블
CREATE TABLE IF NOT EXISTS emotion_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 대상 정보
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('video_slot', 'timecode_feedback')),
  target_id UUID NOT NULL, -- video_slots.id 또는 timecode_feedbacks.id
  feedback_project_id UUID NOT NULL REFERENCES feedback_projects(id) ON DELETE CASCADE,

  -- 반응자 정보
  reactor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reactor_guest_id VARCHAR(255),
  reactor_name VARCHAR(255),

  -- 감정 정보
  emotion_type VARCHAR(50) NOT NULL CHECK (emotion_type IN ('like', 'love', 'concern', 'confused', 'angry', 'excited')),
  emotion_intensity INTEGER DEFAULT 3 CHECK (emotion_intensity >= 1 AND emotion_intensity <= 5),

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- 고유 제약 (한 사용자당 하나의 감정 표현)
  UNIQUE(target_type, target_id, reactor_user_id),
  UNIQUE(target_type, target_id, reactor_guest_id)
);

-- 6. 활동 로그 테이블
CREATE TABLE IF NOT EXISTS feedback_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 프로젝트 및 대상
  feedback_project_id UUID NOT NULL REFERENCES feedback_projects(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL, -- 'project', 'video_slot', 'feedback', 'participant'
  target_id UUID,

  -- 활동 정보
  action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'deleted', 'uploaded', 'commented', etc.
  description TEXT,

  -- 수행자 정보
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_guest_id VARCHAR(255),
  actor_name VARCHAR(255),

  -- 메타데이터
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===========================================
-- 인덱스 생성
-- ===========================================

-- 피드백 프로젝트 인덱스
CREATE INDEX idx_feedback_projects_owner_id ON feedback_projects(owner_id);
CREATE INDEX idx_feedback_projects_share_token ON feedback_projects(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_feedback_projects_status ON feedback_projects(status);
CREATE INDEX idx_feedback_projects_created_at ON feedback_projects(created_at);

-- 영상 슬롯 인덱스
CREATE INDEX idx_video_slots_feedback_project_id ON video_slots(feedback_project_id);
CREATE INDEX idx_video_slots_slot_number ON video_slots(feedback_project_id, slot_number);
CREATE INDEX idx_video_slots_processing_status ON video_slots(processing_status);
CREATE INDEX idx_video_slots_created_at ON video_slots(created_at);

-- 타임코드 피드백 인덱스
CREATE INDEX idx_timecode_feedbacks_video_slot_id ON timecode_feedbacks(video_slot_id);
CREATE INDEX idx_timecode_feedbacks_feedback_project_id ON timecode_feedbacks(feedback_project_id);
CREATE INDEX idx_timecode_feedbacks_timestamp ON timecode_feedbacks(video_slot_id, timestamp_seconds);
CREATE INDEX idx_timecode_feedbacks_status ON timecode_feedbacks(status);
CREATE INDEX idx_timecode_feedbacks_created_at ON timecode_feedbacks(created_at);
CREATE INDEX idx_timecode_feedbacks_parent ON timecode_feedbacks(parent_feedback_id) WHERE parent_feedback_id IS NOT NULL;

-- 참여자 인덱스
CREATE INDEX idx_feedback_participants_project_id ON feedback_participants(feedback_project_id);
CREATE INDEX idx_feedback_participants_user_id ON feedback_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_feedback_participants_guest_email ON feedback_participants(guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX idx_feedback_participants_role ON feedback_participants(role);
CREATE INDEX idx_feedback_participants_status ON feedback_participants(status);

-- 감정 표현 인덱스
CREATE INDEX idx_emotion_reactions_target ON emotion_reactions(target_type, target_id);
CREATE INDEX idx_emotion_reactions_project_id ON emotion_reactions(feedback_project_id);
CREATE INDEX idx_emotion_reactions_reactor_user ON emotion_reactions(reactor_user_id) WHERE reactor_user_id IS NOT NULL;
CREATE INDEX idx_emotion_reactions_created_at ON emotion_reactions(created_at);

-- 활동 로그 인덱스
CREATE INDEX idx_feedback_activity_logs_project_id ON feedback_activity_logs(feedback_project_id);
CREATE INDEX idx_feedback_activity_logs_target ON feedback_activity_logs(target_type, target_id);
CREATE INDEX idx_feedback_activity_logs_action ON feedback_activity_logs(action);
CREATE INDEX idx_feedback_activity_logs_created_at ON feedback_activity_logs(created_at);
CREATE INDEX idx_feedback_activity_logs_actor_user ON feedback_activity_logs(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- ===========================================
-- RLS (Row Level Security) 정책
-- ===========================================

-- RLS 활성화
ALTER TABLE feedback_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timecode_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_activity_logs ENABLE ROW LEVEL SECURITY;

-- 피드백 프로젝트 정책
CREATE POLICY "feedback_projects_owner_access" ON feedback_projects
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "feedback_projects_participant_read" ON feedback_projects
  FOR SELECT USING (
    id IN (
      SELECT feedback_project_id FROM feedback_participants
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "feedback_projects_public_read" ON feedback_projects
  FOR SELECT USING (is_public = true);

-- 영상 슬롯 정책
CREATE POLICY "video_slots_project_access" ON video_slots
  FOR ALL USING (
    feedback_project_id IN (
      SELECT id FROM feedback_projects
      WHERE owner_id = auth.uid()
        OR id IN (
          SELECT feedback_project_id FROM feedback_participants
          WHERE user_id = auth.uid() AND status = 'active'
        )
        OR is_public = true
    )
  );

-- 타임코드 피드백 정책
CREATE POLICY "timecode_feedbacks_project_access" ON timecode_feedbacks
  FOR ALL USING (
    feedback_project_id IN (
      SELECT id FROM feedback_projects
      WHERE owner_id = auth.uid()
        OR id IN (
          SELECT feedback_project_id FROM feedback_participants
          WHERE user_id = auth.uid() AND status = 'active'
        )
        OR is_public = true
    )
  );

-- 참여자 정책
CREATE POLICY "feedback_participants_project_access" ON feedback_participants
  FOR ALL USING (
    feedback_project_id IN (
      SELECT id FROM feedback_projects
      WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- 감정 표현 정책
CREATE POLICY "emotion_reactions_project_access" ON emotion_reactions
  FOR ALL USING (
    feedback_project_id IN (
      SELECT id FROM feedback_projects
      WHERE owner_id = auth.uid()
        OR id IN (
          SELECT feedback_project_id FROM feedback_participants
          WHERE user_id = auth.uid() AND status = 'active'
        )
        OR is_public = true
    )
  );

-- 활동 로그 정책
CREATE POLICY "feedback_activity_logs_project_access" ON feedback_activity_logs
  FOR SELECT USING (
    feedback_project_id IN (
      SELECT id FROM feedback_projects
      WHERE owner_id = auth.uid()
        OR id IN (
          SELECT feedback_project_id FROM feedback_participants
          WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- ===========================================
-- Supabase Storage 버킷 생성
-- ===========================================

-- 피드백 영상 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-videos',
  'feedback-videos',
  false,
  314572800, -- 300MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
) ON CONFLICT (id) DO NOTHING;

-- 피드백 썸네일 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-thumbnails',
  'feedback-thumbnails',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 피드백 스크린샷 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- Storage 정책
-- ===========================================

-- 피드백 영상 Storage 정책
CREATE POLICY "feedback_videos_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feedback-videos' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] IN (
    SELECT fp.id::text FROM feedback_projects fp
    WHERE fp.owner_id = auth.uid()
      OR fp.id IN (
        SELECT feedback_project_id FROM feedback_participants
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

CREATE POLICY "feedback_videos_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feedback-videos' AND
  (storage.foldername(name))[1] IN (
    SELECT fp.id::text FROM feedback_projects fp
    WHERE fp.owner_id = auth.uid()
      OR fp.id IN (
        SELECT feedback_project_id FROM feedback_participants
        WHERE user_id = auth.uid() AND status = 'active'
      )
      OR fp.is_public = true
  )
);

-- 썸네일 Storage 정책
CREATE POLICY "feedback_thumbnails_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feedback-thumbnails' AND
  (storage.foldername(name))[1] IN (
    SELECT fp.id::text FROM feedback_projects fp
    WHERE fp.owner_id = auth.uid()
      OR fp.id IN (
        SELECT feedback_project_id FROM feedback_participants
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

CREATE POLICY "feedback_thumbnails_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feedback-thumbnails'
);

-- 스크린샷 Storage 정책
CREATE POLICY "feedback_screenshots_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feedback-screenshots' AND
  (storage.foldername(name))[1] IN (
    SELECT fp.id::text FROM feedback_projects fp
    WHERE fp.owner_id = auth.uid()
      OR fp.id IN (
        SELECT feedback_project_id FROM feedback_participants
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

CREATE POLICY "feedback_screenshots_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feedback-screenshots'
);

-- ===========================================
-- 데이터베이스 함수
-- ===========================================

-- 피드백 프로젝트 통계 함수
CREATE OR REPLACE FUNCTION get_feedback_project_stats(project_id UUID)
RETURNS TABLE (
  total_videos INTEGER,
  total_feedbacks INTEGER,
  unresolved_feedbacks INTEGER,
  total_participants INTEGER,
  recent_activity_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM video_slots WHERE feedback_project_id = project_id AND NOT is_deleted),
    (SELECT COUNT(*)::INTEGER FROM timecode_feedbacks WHERE feedback_project_id = project_id AND NOT is_deleted),
    (SELECT COUNT(*)::INTEGER FROM timecode_feedbacks WHERE feedback_project_id = project_id AND status = 'active' AND NOT is_deleted),
    (SELECT COUNT(*)::INTEGER FROM feedback_participants WHERE feedback_project_id = project_id AND status = 'active'),
    (SELECT COUNT(*)::INTEGER FROM feedback_activity_logs WHERE feedback_project_id = project_id AND created_at > NOW() - INTERVAL '24 hours');
END;
$$;

-- 게스트 접근 검증 함수
CREATE OR REPLACE FUNCTION verify_guest_access(
  project_token VARCHAR(255),
  guest_identifier VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
  project_id UUID,
  access_granted BOOLEAN,
  access_level VARCHAR(50)
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  project_record feedback_projects%ROWTYPE;
BEGIN
  -- 프로젝트 조회
  SELECT * INTO project_record
  FROM feedback_projects
  WHERE share_token = project_token
    AND NOT is_deleted
    AND (share_link_expires_at IS NULL OR share_link_expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, false, 'none'::VARCHAR(50);
    RETURN;
  END IF;

  -- 게스트 접근 허용 여부 확인
  IF NOT project_record.guest_access_enabled THEN
    RETURN QUERY SELECT project_record.id, false, 'none'::VARCHAR(50);
    RETURN;
  END IF;

  -- 접근 허용
  RETURN QUERY SELECT project_record.id, true, 'guest'::VARCHAR(50);

  -- 활동 로그 기록
  INSERT INTO feedback_activity_logs (
    feedback_project_id,
    target_type,
    target_id,
    action,
    description,
    actor_guest_id,
    metadata,
    created_at
  ) VALUES (
    project_record.id,
    'project',
    project_record.id,
    'guest_access',
    'Guest accessed project via share link',
    guest_identifier,
    jsonb_build_object('share_token', project_token),
    NOW()
  );
END;
$$;

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER update_feedback_projects_updated_at
  BEFORE UPDATE ON feedback_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_slots_updated_at
  BEFORE UPDATE ON video_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timecode_feedbacks_updated_at
  BEFORE UPDATE ON timecode_feedbacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emotion_reactions_updated_at
  BEFORE UPDATE ON emotion_reactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 초기 데이터 설정
-- ===========================================

-- 기본 권한 템플릿
INSERT INTO public.metadata_templates (key, template) VALUES
('feedback_permissions', '{
  "viewer": {
    "can_view": true,
    "can_comment": true,
    "can_react": true,
    "can_upload": false,
    "can_resolve": false,
    "can_manage_participants": false
  },
  "editor": {
    "can_view": true,
    "can_comment": true,
    "can_react": true,
    "can_upload": true,
    "can_resolve": true,
    "can_manage_participants": false
  },
  "admin": {
    "can_view": true,
    "can_comment": true,
    "can_react": true,
    "can_upload": true,
    "can_resolve": true,
    "can_manage_participants": true
  }
}') ON CONFLICT (key) DO UPDATE SET template = EXCLUDED.template;