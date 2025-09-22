# Phase 3.5 피드백 시스템 아키텍처 문서

## 개요

본 문서는 VideoPlanet Phase 3.5의 타임코드 기반 영상 피드백 시스템 아키텍처를 상세히 기술합니다. 이 시스템은 다중 영상 슬롯(v1, v2, v3)과 실시간 협업 기능을 제공하여 효율적인 영상 피드백 워크플로우를 지원합니다.

## 시스템 요구사항

### 기능적 요구사항
- **다중 영상 슬롯**: v1, v2, v3 슬롯을 통한 영상 비교 및 관리
- **타임코드 기반 피드백**: 영상의 특정 시점에 댓글 및 반응 작성
- **실시간 협업**: WebSocket을 통한 실시간 피드백 동기화
- **권한 관리**: 소유자/멤버/게스트 권한 체계
- **파일 저장**: Supabase Storage를 통한 300MB 제한 영상 저장
- **링크 공유**: 공유 토큰을 통한 외부 사용자 초대

### 비기능적 요구사항
- **성능**: 300MB 파일 업로드 지원, 실시간 동기화
- **보안**: XSS 방지, Rate Limiting, 권한 검증
- **확장성**: 최대 50명 동시 참여 지원
- **사용성**: 직관적인 타임코드 네비게이션 및 피드백 인터페이스

## 아키텍처 설계

### FSD (Feature-Sliced Design) 구조

```
src/
├── entities/                    # 도메인 모델
│   ├── feedback/               # 피드백 도메인
│   │   ├── model/
│   │   │   ├── types.ts        # 핵심 타입 정의
│   │   │   └── validation.ts   # 비즈니스 규칙 검증
│   │   ├── store/
│   │   │   ├── feedback-slice.ts  # Redux 상태 관리
│   │   │   └── selectors.ts       # 상태 셀렉터
│   │   └── index.ts            # Public API
│   │
│   ├── video-review/           # 영상 리뷰 세션
│   └── collaboration/          # 실시간 협업
│
├── features/                   # 비즈니스 기능
│   ├── video-feedback/         # 피드백 기능
│   │   ├── ui/                 # UI 컴포넌트
│   │   ├── hooks/              # React 훅
│   │   └── lib/                # 유틸리티
│   │
│   ├── video-upload/           # 업로드 기능
│   └── video-sharing/          # 공유 기능
│
├── widgets/                    # 복합 UI 위젯
│   ├── video-feedback/         # 피드백 위젯
│   ├── video-player/           # 플레이어 위젯
│   └── video-management/       # 관리 위젯
│
├── pages/                      # 페이지 컴포넌트
│   ├── video-feedback/         # 피드백 페이지
│   └── data-management/        # 데이터 관리
│
└── shared/                     # 공통 인프라
    ├── api/                    # API 클라이언트
    ├── lib/                    # 공통 라이브러리
    │   ├── supabase-feedback-storage.ts
    │   ├── websocket-feedback-client.ts
    │   ├── realtime-sync-manager.ts
    │   ├── feedback-security.ts
    │   ├── timecode-utils.ts
    │   └── file-upload-utils.ts
    └── ui/                     # 공통 UI 컴포넌트
```

## 핵심 컴포넌트

### 1. 피드백 도메인 모델 (entities/feedback)

#### 주요 타입
```typescript
// 비디오 슬롯 (v1, v2, v3)
export type VideoSlot = 'v1' | 'v2' | 'v3'

// 참여자 유형
export type ParticipantType = 'owner' | 'member' | 'guest'

// 감정 표현
export type EmotionType = 'like' | 'dislike' | 'confused'

// 타임코드
export interface Timecode {
  readonly seconds: number
  readonly formatted: string // "MM:SS" 또는 "HH:MM:SS"
}

// 타임코드 댓글
export interface TimecodeComment {
  readonly id: string
  readonly sessionId: string
  readonly videoSlot: VideoSlot
  readonly timecode: Timecode
  readonly authorId: string
  readonly content: string
  readonly isResolved: boolean
  readonly parentId?: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

// 피드백 세션
export interface FeedbackSession {
  readonly metadata: FeedbackSessionMetadata
  readonly videoSlots: VideoSlotInfo[]
  readonly participants: FeedbackParticipant[]
  readonly comments: TimecodeComment[]
  readonly reactions: EmotionReaction[]
  readonly stats: FeedbackSessionStats
}
```

#### 비즈니스 규칙
- 최대 300MB 파일 크기 제한
- 0.1초 단위 타임코드 정밀도
- 최대 50명 참여자 제한
- 최대 3단계 대댓글 깊이
- 2000자 댓글 길이 제한

### 2. 파일 저장소 (Supabase Storage)

#### 저장소 구조
```
feedback-videos/
└── sessions/
    └── {sessionId}/
        ├── v1/
        │   ├── {timestamp}.mp4
        │   └── thumb_{timestamp}.jpg
        ├── v2/
        └── v3/

feedback-thumbnails/
└── sessions/
    └── {sessionId}/
        └── {slot}/
            └── thumb_{timestamp}.jpg
```

#### 주요 기능
- **청크 업로드**: 대용량 파일 안정적 업로드
- **자동 썸네일 생성**: 영상에서 썸네일 추출
- **진행률 추적**: 실시간 업로드 진행 상황
- **메타데이터 추출**: 영상 길이, 해상도, 형식 정보
- **자동 정리**: 기존 파일 교체 시 자동 삭제

### 3. 실시간 협업 시스템

#### WebSocket 이벤트
```typescript
export type RealtimeEventType =
  | 'comment_added'      // 댓글 추가
  | 'comment_updated'    // 댓글 수정
  | 'comment_deleted'    // 댓글 삭제
  | 'reaction_added'     // 반응 추가
  | 'reaction_removed'   // 반응 제거
  | 'participant_joined' // 참여자 입장
  | 'participant_left'   // 참여자 퇴장
  | 'video_uploaded'     // 영상 업로드
  | 'video_deleted'      // 영상 삭제
  | 'session_updated'    // 세션 설정 변경
```

#### 충돌 해결 전략
- **Last Write Wins**: 타임스탬프 기반 최신 우선
- **Merge**: 댓글 내용 병합
- **Manual**: 사용자 수동 해결

#### 동기화 메커니즘
- **이벤트 큐**: 오프라인 시 이벤트 저장
- **시퀀스 번호**: 이벤트 순서 보장
- **재연결**: 자동 재연결 및 상태 복구
- **디바운스**: 연속 이벤트 최적화

### 4. 보안 및 권한 관리

#### 권한 체계
```typescript
// 소유자 권한
OWNER_PERMISSIONS = {
  canComment: true,
  canReact: true,
  canEditSession: true,
  canManageVideos: true,
  canInviteOthers: true
}

// 멤버 권한
MEMBER_PERMISSIONS = {
  canComment: true,
  canReact: true,
  canEditSession: false,
  canManageVideos: false,
  canInviteOthers: false
}

// 게스트 권한 (세션 설정에 따라 동적)
GUEST_PERMISSIONS = {
  canComment: session.allowGuestComments,
  canReact: session.allowGuestEmotions,
  canEditSession: false,
  canManageVideos: false,
  canInviteOthers: false
}
```

#### 보안 정책
- **Rate Limiting**: IP별 요청 제한
- **입력 검증**: XSS 방지를 위한 내용 필터링
- **토큰 기반**: 세션별 보안 토큰 관리
- **CORS**: 허용된 오리진만 접근 가능
- **HTTPS**: 프로덕션 환경 필수

### 5. 타임코드 시스템

#### 타임코드 유틸리티
```typescript
// 초를 타임코드로 변환
secondsToTimecode(125.5) // { seconds: 125.5, formatted: "02:05" }

// 타임코드 검증
isValidTimecodeForVideo(timecode, videoDuration)

// 가장 가까운 타임코드 찾기
findClosestTimecode(targetSeconds, timecodes)

// 타임코드 클러스터링
clusterTimecodes(timecodes, maxDistance: 5)

// 밀도 계산 (핫스팟 감지)
calculateTimecodeDensity(timecodes, windowSize: 10)
```

#### 키보드 단축키
- `Ctrl/Cmd + Enter`: 댓글 작성 시작
- `Ctrl/Cmd + J`: 다음 댓글로 이동
- `Ctrl/Cmd + K`: 이전 댓글로 이동
- `Escape`: 댓글 작성 취소

## API 설계

### RESTful API 엔드포인트

```
# 세션 관리
POST   /api/feedback/sessions              # 세션 생성
GET    /api/feedback/sessions/{id}         # 세션 조회
PUT    /api/feedback/sessions/{id}         # 세션 설정 수정
DELETE /api/feedback/sessions/{id}         # 세션 삭제

# 영상 관리
POST   /api/feedback/sessions/{id}/videos  # 영상 업로드
DELETE /api/feedback/sessions/{id}/videos/{slot} # 영상 삭제

# 댓글 관리
POST   /api/feedback/comments              # 댓글 작성
PUT    /api/feedback/comments/{id}         # 댓글 수정
DELETE /api/feedback/comments/{id}         # 댓글 삭제
PUT    /api/feedback/comments/{id}/resolve # 댓글 해결 상태 변경

# 반응 관리
POST   /api/feedback/reactions             # 반응 추가
DELETE /api/feedback/reactions/{id}        # 반응 제거

# 공유 및 초대
POST   /api/feedback/sessions/{id}/share   # 공유 링크 생성
POST   /api/feedback/sessions/{id}/invite  # 참여자 초대
DELETE /api/feedback/sessions/{id}/participants/{userId} # 참여자 제거
```

### WebSocket API

```
# 연결
wss://domain.com/api/feedback/ws/{sessionId}?token={authToken}

# 이벤트 메시지 형식
{
  "type": "comment_added",
  "sessionId": "session-123",
  "data": { /* 이벤트 데이터 */ },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "authorId": "user-456"
}
```

## 데이터베이스 스키마

### 주요 테이블

```sql
-- 피드백 세션
CREATE TABLE feedback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  share_token VARCHAR(64) UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT false,
  allow_guest_comments BOOLEAN DEFAULT true,
  allow_guest_emotions BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 영상 슬롯
CREATE TABLE feedback_video_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  slot VARCHAR(2) NOT NULL CHECK (slot IN ('v1', 'v2', 'v3')),
  video_url TEXT,
  thumbnail_url TEXT,
  filename VARCHAR(255),
  original_name VARCHAR(255),
  file_size BIGINT,
  duration REAL,
  width INTEGER,
  height INTEGER,
  format VARCHAR(50),
  uploaded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, slot)
);

-- 참여자
CREATE TABLE feedback_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  guest_name VARCHAR(100),
  participant_type VARCHAR(10) NOT NULL CHECK (participant_type IN ('owner', 'member', 'guest')),
  permissions JSONB NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 타임코드 댓글
CREATE TABLE feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  video_slot VARCHAR(2) NOT NULL CHECK (video_slot IN ('v1', 'v2', 'v3')),
  timecode_seconds REAL NOT NULL,
  author_id UUID NOT NULL REFERENCES feedback_participants(id),
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES feedback_comments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 감정 반응
CREATE TABLE feedback_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
  video_slot VARCHAR(2) CHECK (video_slot IN ('v1', 'v2', 'v3')),
  timecode_seconds REAL,
  author_id UUID NOT NULL REFERENCES feedback_participants(id),
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('like', 'dislike', 'confused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, author_id) -- 댓글당 사용자별 1개 반응만
);
```

### 인덱스 설계

```sql
-- 성능 최적화를 위한 인덱스
CREATE INDEX idx_feedback_sessions_owner_id ON feedback_sessions(owner_id);
CREATE INDEX idx_feedback_sessions_share_token ON feedback_sessions(share_token);
CREATE INDEX idx_feedback_participants_session_user ON feedback_participants(session_id, user_id);
CREATE INDEX idx_feedback_comments_session_slot_time ON feedback_comments(session_id, video_slot, timecode_seconds);
CREATE INDEX idx_feedback_reactions_session_slot ON feedback_reactions(session_id, video_slot);
```

## 성능 최적화

### 클라이언트 사이드
- **Redux 최적화**: Selector를 통한 불필요한 리렌더링 방지
- **가상화**: 대량 댓글 목록 가상 스크롤링
- **디바운싱**: 타임코드 업데이트 및 검색 최적화
- **캐싱**: 세션 데이터 로컬 캐싱
- **레이지 로딩**: 필요한 컴포넌트만 동적 로드

### 서버 사이드
- **연결 풀링**: 데이터베이스 연결 최적화
- **쿼리 최적화**: 인덱스 활용 및 N+1 문제 해결
- **WebSocket 스케일링**: Redis를 통한 다중 서버 동기화
- **파일 CDN**: Supabase CDN을 통한 빠른 파일 전송
- **Rate Limiting**: 과도한 요청 차단

## 모니터링 및 로깅

### 주요 메트릭
- **업로드 성공률**: 파일 업로드 성공/실패 비율
- **WebSocket 연결 안정성**: 연결 지속 시간 및 재연결 빈도
- **피드백 참여도**: 사용자당 평균 댓글/반응 수
- **세션 활성도**: 동시 접속자 수 및 세션 지속 시간
- **에러율**: API 및 클라이언트 에러 발생 빈도

### 로깅 전략
- **보안 이벤트**: 권한 위반, 비정상 접근 시도
- **성능 이벤트**: 느린 쿼리, 업로드 시간 초과
- **비즈니스 이벤트**: 세션 생성, 댓글 작성, 파일 업로드
- **시스템 이벤트**: WebSocket 연결/해제, 에러 발생

## 배포 및 운영

### 환경 설정
```env
# 데이터베이스
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# 파일 저장소
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MAX_FILE_SIZE=314572800  # 300MB

# WebSocket
WEBSOCKET_PORT=3001
REDIS_URL=redis://localhost:6379

# 보안
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=https://videoprompt.vercel.app,http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### CI/CD 파이프라인
1. **테스트**: 단위/통합/E2E 테스트 실행
2. **빌드**: TypeScript 컴파일 및 번들링
3. **보안 검사**: 의존성 취약점 스캔
4. **배포**: Vercel (프론트엔드) + Railway (백엔드)
5. **헬스체크**: 배포 후 API 엔드포인트 검증

### 백업 및 복구
- **데이터베이스**: 일일 자동 백업 (Supabase)
- **파일 스토리지**: 지역 복제를 통한 내구성 보장
- **설정 백업**: 환경 변수 및 설정 파일 버전 관리
- **복구 절차**: RTO 4시간, RPO 1시간 목표

## 확장성 고려사항

### 수평 확장
- **WebSocket 서버**: Redis Pub/Sub을 통한 다중 인스턴스 동기화
- **API 서버**: 로드 밸런서를 통한 무상태 서버 확장
- **데이터베이스**: 읽기 복제본을 통한 읽기 성능 향상
- **파일 서버**: CDN을 통한 전세계 배포

### 수직 확장
- **메모리 최적화**: Redis 캐싱을 통한 빈번한 데이터 접근 최적화
- **CPU 최적화**: 비동기 처리 및 멀티스레딩 활용
- **저장소 최적화**: SSD 및 고성능 네트워크 스토리지 활용

## 보안 고려사항

### 인증 및 인가
- **JWT 토큰**: 사용자 인증
- **세션 토큰**: 피드백 세션 접근 권한
- **역할 기반**: 소유자/멤버/게스트 권한 체계
- **토큰 갱신**: 자동 토큰 갱신 메커니즘

### 데이터 보호
- **암호화**: HTTPS/WSS 전송 암호화
- **입력 검증**: SQL 인젝션, XSS 방지
- **파일 검증**: 악성 파일 업로드 방지
- **접근 로깅**: 모든 접근 시도 기록

### 컴플라이언스
- **GDPR**: 개인 정보 삭제 권리 지원
- **데이터 지역화**: 필요시 특정 지역 데이터 저장
- **감사 로그**: 데이터 접근 및 수정 이력 관리

## 테스트 전략

### 단위 테스트 (70%)
- **도메인 로직**: entities/feedback 비즈니스 규칙
- **유틸리티**: 타임코드, 파일 처리 함수
- **Redux**: 액션, 리듀서, 셀렉터

### 통합 테스트 (20%)
- **API 엔드포인트**: 요청/응답 검증
- **WebSocket**: 실시간 이벤트 전송/수신
- **파일 업로드**: Supabase Storage 연동

### E2E 테스트 (10%)
- **사용자 시나리오**: 세션 생성부터 피드백 완료까지
- **크로스 브라우저**: Chrome, Firefox, Safari 호환성
- **모바일**: 반응형 디자인 검증

## 결론

본 아키텍처는 FSD(Feature-Sliced Design) 원칙을 준수하여 확장 가능하고 유지보수가 용이한 타임코드 기반 피드백 시스템을 제공합니다. 실시간 협업, 안정적인 파일 관리, 강력한 보안 정책을 통해 사용자에게 최적의 영상 피드백 경험을 제공할 수 있습니다.

핵심 성공 요소:
1. **명확한 도메인 분리**: 각 레이어의 책임 명확화
2. **실시간 동기화**: 충돌 없는 협업 환경 제공
3. **사용자 경험**: 직관적인 타임코드 네비게이션
4. **확장성**: 향후 기능 추가에 대비한 유연한 구조
5. **보안**: 다양한 참여자 유형에 대한 안전한 접근 제어

이 아키텍처를 기반으로 단계적으로 구현하여 안정적이고 사용자 친화적인 피드백 시스템을 구축할 수 있습니다.