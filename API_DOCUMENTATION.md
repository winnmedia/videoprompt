# VideoPlanet API 문서

## 개요

VideoPlanet API는 $300 사건 방지를 위한 강력한 비용 안전 미들웨어와 rate limiting을 포함한 안전한 API 시스템입니다.

## 보안 기능

### 1. 비용 안전 미들웨어
- **위치**: `/app/api/_middleware/cost-safety.ts`
- **기능**:
  - API 호출별 비용 추적
  - 시간당/일일 비용 임계치 모니터링
  - 비정상 사용 패턴 자동 차단
  - 긴급 차단 시스템 (임계치 2배 초과 시)

### 2. Rate Limiting
- **위치**: `/app/api/_middleware/rate-limit.ts`
- **알고리즘**: 슬라이딩 윈도우
- **기본 제한**: 분당 10회 (환경변수로 조정 가능)
- **API별 커스텀 제한**:
  - `/api/auth/login`: 분당 3회
  - `/api/auth/me`: 분당 60회
  - `/api/story/generate`: 분당 5회
  - `/api/video/generate`: 시간당 2회

## API 엔드포인트

### 인증 (Authentication)

#### 1. 게스트 사용자 생성
```
POST /api/auth/guest
```

**요청 본문**:
```json
{
  "metadata": {
    "source": "landing-page"
  }
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "abc123",
      "isGuest": true,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "token": {
      "token": "guest-token-xxx",
      "userId": "abc123",
      "expiresAt": "2024-01-31T00:00:00Z"
    }
  }
}
```

#### 2. 이메일 로그인
```
POST /api/auth/login
```

**요청 본문**:
```json
{
  "email": "user@example.com",
  "redirectTo": "https://app.videoplanet.com/dashboard"
}
```

**Rate Limit**: 분당 3회

#### 3. 현재 사용자 정보
```
GET /api/auth/me
```

**헤더**:
```
Authorization: Bearer <token>
```

**캐싱**: 1분

### 스토리 (Story)

#### 1. AI 스토리 생성
```
POST /api/story/generate
```

**요청 본문**:
```json
{
  "prompt": "아름다운 일몰 풍경을 배경으로 한 감동적인 이야기",
  "style": "realistic",
  "duration": 60
}
```

**Rate Limit**: 분당 5회
**예상 비용**: $0.01 per request

**응답**:
```json
{
  "success": true,
  "data": {
    "id": "story-123",
    "title": "일몰의 기억",
    "content": "생성된 스토리 내용...",
    "shots": [
      {
        "id": "shot-1",
        "order": 1,
        "description": "황금빛 일몰이 시작되는 해변",
        "duration": 5,
        "cameraAngle": "Wide Shot",
        "visualElements": ["일몰", "해변", "자연"]
      }
    ],
    "metadata": {
      "generatedBy": "gemini",
      "cost": 0.01,
      "processingTime": 2500
    }
  }
}
```

#### 2. 스토리 조회
```
GET /api/story/{id}
```

#### 3. 스토리 수정
```
PUT /api/story/{id}
```

**요청 본문**:
```json
{
  "title": "수정된 제목",
  "content": "수정된 내용",
  "shots": []
}
```

#### 4. 스토리 삭제
```
DELETE /api/story/{id}
```

### 콘텐츠 (Contents)

#### 콘텐츠 목록 조회
```
GET /api/contents
```

**쿼리 파라미터**:
- `type`: story | prompt | image | video
- `page`: 페이지 번호 (기본: 1)
- `limit`: 페이지당 항목 수 (기본: 10, 최대: 100)
- `search`: 검색어
- `orderBy`: createdAt | updatedAt | title (기본: createdAt)
- `order`: asc | desc (기본: desc)

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": "content-1",
      "type": "story",
      "title": "제목",
      "data": {},
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "hasMore": true
    }
  }
}
```

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 메시지",
    "details": {}
  }
}
```

## Rate Limit 헤더

모든 API 응답에 포함:
- `X-RateLimit-Limit`: 제한 횟수
- `X-RateLimit-Remaining`: 남은 요청 수
- `X-RateLimit-Reset`: 리셋 시간 (Unix timestamp)

## 에러 코드

| 코드 | 설명 | HTTP 상태 |
|------|------|-----------|
| VALIDATION_ERROR | 입력 검증 실패 | 400 |
| UNAUTHORIZED | 인증 필요 | 401 |
| FORBIDDEN | 권한 없음 | 403 |
| NOT_FOUND | 리소스 없음 | 404 |
| RATE_LIMIT_EXCEEDED | Rate limit 초과 | 429 |
| COST_LIMIT_EXCEEDED | 비용 한도 초과 | 429 |
| EMERGENCY_BLOCK | 긴급 차단 | 503 |
| INTERNAL_ERROR | 서버 오류 | 500 |

## 환경변수 설정

`.env.local` 파일에 다음 환경변수를 설정하세요:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI API
GEMINI_API_KEY=your-gemini-key

# API 설정
API_RATE_LIMIT=10
API_COST_THRESHOLD=50
```

## 테스트

```bash
# Health Check
curl http://localhost:3000/api/health

# 게스트 생성
curl -X POST http://localhost:3000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"source": "test"}}'

# 스토리 생성
curl -X POST http://localhost:3000/api/story/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "테스트 프롬프트", "duration": 60}'
```

## 주의사항

1. **$300 사건 방지**: 모든 API는 비용 안전 미들웨어로 보호됩니다
2. **캐싱**: `/api/auth/me`는 1분 캐싱이 필수입니다
3. **Rate Limiting**: 클라이언트에서 재시도 로직 구현 필요
4. **에러 처리**: 429 상태 시 Retry-After 헤더 확인

## 문의

문제가 있거나 질문이 있으면 이슈를 생성해주세요.