# Phase 3.9 API 계약 설계 문서

## 📋 개요

Phase 3.9 영상 피드백 기능 확장을 위한 API 엔드포인트 설계 및 계약 정의

## 🎯 API 엔드포인트 구조

### 1. 버전 관리 API

#### 1.1 버전 업로드

```http
POST /api/feedback/versions/upload
Content-Type: multipart/form-data

Request Body (FormData):
- file: File (required) - 영상 파일 (최대 300MB)
- sessionId: string (required) - 피드백 세션 ID
- slot: VideoSlot (required) - v1, v2, v3
- replaceReason?: string - 교체 사유
- autoActivate: boolean - 자동 활성화 여부
- generateThumbnail: boolean - 썸네일 생성 여부

Response 200:
{
  "versionId": "version_uuid",
  "slot": "v1",
  "versionNumber": 2,
  "uploader": {
    "id": "user_uuid",
    "name": "사용자명",
    "type": "owner"
  },
  "uploadedAt": "2025-01-22T10:30:00Z",
  "originalFilename": "video.mp4",
  "fileHash": "sha256_hash",
  "fileSize": 52428800,
  "duration": 120.5,
  "codec": "H.264",
  "resolution": {
    "width": 1920,
    "height": 1080
  },
  "thumbnailUrl": "https://cdn.example.com/thumbnails/...",
  "isActive": true,
  "replaceReason": "품질 개선"
}

Error Responses:
400: 파일 크기 초과, 지원하지 않는 형식
413: 파일 크기 제한 초과
422: 중복 파일 해시
500: 서버 에러
```

#### 1.2 버전 활성화

```http
POST /api/feedback/versions/activate
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "versionId": "version_uuid"
}

Response 200:
{
  "success": true,
  "activatedAt": "2025-01-22T10:35:00Z"
}
```

#### 1.3 버전 히스토리 조회

```http
GET /api/feedback/sessions/{sessionId}/versions

Response 200:
{
  "v1": {
    "sessionId": "session_uuid",
    "slot": "v1",
    "versions": [
      {
        "versionId": "version_uuid_1",
        "versionNumber": 1,
        "uploader": {...},
        "uploadedAt": "2025-01-22T09:00:00Z",
        "originalFilename": "video_v1.mp4",
        "fileHash": "hash1",
        "fileSize": 45000000,
        "duration": 95.2,
        "codec": "H.264",
        "resolution": {"width": 1920, "height": 1080},
        "thumbnailUrl": "https://...",
        "isActive": false
      },
      {
        "versionId": "version_uuid_2",
        "versionNumber": 2,
        "uploader": {...},
        "uploadedAt": "2025-01-22T10:30:00Z",
        "originalFilename": "video_v2.mp4",
        "fileHash": "hash2",
        "fileSize": 52428800,
        "duration": 120.5,
        "codec": "H.264",
        "resolution": {"width": 1920, "height": 1080},
        "thumbnailUrl": "https://...",
        "isActive": true,
        "replaceReason": "품질 개선"
      }
    ],
    "currentVersionId": "version_uuid_2",
    "totalVersions": 2,
    "createdAt": "2025-01-22T09:00:00Z",
    "lastModifiedAt": "2025-01-22T10:30:00Z"
  },
  "v2": null,
  "v3": null
}
```

#### 1.4 버전 비교

```http
POST /api/feedback/versions/compare
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "slot": "v1",
  "versionA": "version_uuid_1",
  "versionB": "version_uuid_2",
  "compareType": "side-by-side"
}

Response 200:
{
  "id": "comparison_uuid",
  "request": {
    "sessionId": "session_uuid",
    "slot": "v1",
    "versionA": "version_uuid_1",
    "versionB": "version_uuid_2",
    "compareType": "side-by-side"
  },
  "differences": {
    "duration": 25.3,
    "fileSize": 7428800,
    "resolution": false,
    "codec": false
  },
  "thumbnailComparisonUrl": "https://cdn.example.com/comparisons/...",
  "createdAt": "2025-01-22T10:40:00Z"
}
```

#### 1.5 버전 삭제

```http
DELETE /api/feedback/versions/{versionId}
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "deletedAt": "2025-01-22T11:00:00Z"
}

Error Responses:
400: 활성 버전 삭제 시도
403: 권한 없음
404: 버전 없음
```

### 2. 스레드 댓글 API

#### 2.1 스레드 댓글 생성

```http
POST /api/feedback/comments/threaded
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "videoSlot": "v1",
  "content": "댓글 내용",
  "timecode": {
    "seconds": 65.5,
    "formatted": "01:05"
  },
  "parentId": "parent_comment_uuid", // 대댓글인 경우
  "versionId": "version_uuid", // 특정 버전 댓글인 경우
  "mentionUserIds": ["user_uuid_1", "user_uuid_2"],
  "isPrivate": false,
  "autoResolve": false
}

Response 200:
{
  "id": "comment_uuid",
  "sessionId": "session_uuid",
  "videoSlot": "v1",
  "versionId": "version_uuid",
  "parentId": "parent_comment_uuid",
  "depth": 1,
  "threadId": "root_comment_uuid",
  "author": {
    "id": "user_uuid",
    "name": "사용자명",
    "type": "member"
  },
  "timecode": {
    "seconds": 65.5,
    "formatted": "01:05"
  },
  "content": "댓글 내용",
  "isResolved": false,
  "createdAt": "2025-01-22T11:15:00Z",
  "updatedAt": null,
  "editHistory": [],
  "reactions": [],
  "mentions": ["user_uuid_1", "user_uuid_2"],
  "attachments": []
}

Error Responses:
400: 내용 누락, 최대 깊이 초과
422: 유효하지 않은 타임코드
```

#### 2.2 스레드 댓글 목록 조회

```http
GET /api/feedback/sessions/{sessionId}/comments/threaded?slot={videoSlot}&version={versionId}&includeResolved={boolean}

Response 200:
[
  {
    "id": "comment_uuid_1",
    "sessionId": "session_uuid",
    "videoSlot": "v1",
    "versionId": null,
    "parentId": null,
    "depth": 0,
    "threadId": "comment_uuid_1",
    "author": {
      "id": "user_uuid_1",
      "name": "작성자1",
      "type": "owner"
    },
    "timecode": {
      "seconds": 30.0,
      "formatted": "00:30"
    },
    "content": "루트 댓글 내용",
    "isResolved": false,
    "createdAt": "2025-01-22T10:00:00Z",
    "updatedAt": null,
    "editHistory": [],
    "reactions": [
      {
        "id": "reaction_uuid",
        "type": "like",
        "userId": "user_uuid_2",
        "userName": "반응자",
        "createdAt": "2025-01-22T10:05:00Z",
        "commentId": "comment_uuid_1"
      }
    ],
    "mentions": [],
    "attachments": []
  },
  {
    "id": "comment_uuid_2",
    "sessionId": "session_uuid",
    "videoSlot": "v1",
    "versionId": null,
    "parentId": "comment_uuid_1",
    "depth": 1,
    "threadId": "comment_uuid_1",
    "author": {
      "id": "user_uuid_2",
      "name": "작성자2",
      "type": "member"
    },
    "timecode": {
      "seconds": 30.0,
      "formatted": "00:30"
    },
    "content": "대댓글 내용",
    "isResolved": false,
    "createdAt": "2025-01-22T10:10:00Z",
    "updatedAt": null,
    "editHistory": [],
    "reactions": [],
    "mentions": ["user_uuid_1"],
    "attachments": []
  }
]
```

#### 2.3 댓글 수정

```http
PATCH /api/feedback/comments/{commentId}
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "content": "수정된 댓글 내용"
}

Response 200:
{
  "success": true,
  "updatedAt": "2025-01-22T11:30:00Z",
  "editHistory": [
    {
      "editedAt": "2025-01-22T11:30:00Z",
      "previousContent": "이전 댓글 내용",
      "reason": "내용 수정"
    }
  ]
}
```

#### 2.4 댓글 해결/해결 취소

```http
POST /api/feedback/comments/{commentId}/resolve
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "resolvedAt": "2025-01-22T11:35:00Z"
}
```

```http
POST /api/feedback/comments/{commentId}/unresolve
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "unresolvedAt": "2025-01-22T11:40:00Z"
}
```

### 3. 감정 반응 API

#### 3.1 감정 반응 추가

```http
POST /api/feedback/reactions
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "commentId": "comment_uuid", // 댓글 반응인 경우
  "timecode": { // 타임코드 반응인 경우
    "seconds": 45.5,
    "formatted": "00:45"
  },
  "type": "like" // like, dislike, confused
}

Response 200:
{
  "id": "reaction_uuid",
  "type": "like",
  "userId": "user_uuid",
  "userName": "반응자",
  "createdAt": "2025-01-22T11:45:00Z",
  "commentId": "comment_uuid",
  "timecode": null
}
```

#### 3.2 감정 반응 제거

```http
DELETE /api/feedback/reactions/{commentId}/{type}
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "removedAt": "2025-01-22T11:50:00Z"
}
```

### 4. 고급 공유 API

#### 4.1 고급 공유 링크 생성

```http
POST /api/feedback/share/advanced
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "accessLevel": "comment", // view, comment, react, edit, admin
  "expiresAt": "2025-01-29T11:55:00Z",
  "maxUses": 100,
  "allowedDomains": ["example.com", "company.co.kr"],
  "requiresAuth": true,
  "customAlias": "feedback-review",
  "enableQrCode": true,
  "notifyOnAccess": true,
  "description": "클라이언트 리뷰용 공유 링크"
}

Response 200:
{
  "token": "share_token_32chars",
  "sessionId": "session_uuid",
  "permissions": {
    "id": "permission_uuid",
    "sessionId": "session_uuid",
    "createdBy": "user_uuid",
    "accessLevel": "comment",
    "expiresAt": "2025-01-29T11:55:00Z",
    "maxUses": 100,
    "usedCount": 0,
    "allowedDomains": ["example.com", "company.co.kr"],
    "requiresAuth": true,
    "isActive": true,
    "createdAt": "2025-01-22T11:55:00Z",
    "lastUsedAt": null
  },
  "shortUrl": "https://share.videoprompt.com/fb123abc",
  "fullUrl": "https://videoprompt.com/feedback/session_uuid?token=share_token_32chars",
  "qrCodeUrl": "https://cdn.videoprompt.com/qr/share_token_32chars.png"
}

Error Responses:
400: 유효하지 않은 설정
422: 도메인 형식 오류
```

#### 4.2 공유 링크 목록 조회

```http
GET /api/feedback/sessions/{sessionId}/share

Response 200:
[
  {
    "token": "share_token_1",
    "sessionId": "session_uuid",
    "permissions": {
      "id": "permission_uuid_1",
      "sessionId": "session_uuid",
      "createdBy": "user_uuid",
      "accessLevel": "view",
      "expiresAt": "2025-01-29T11:55:00Z",
      "maxUses": null,
      "usedCount": 5,
      "allowedDomains": null,
      "requiresAuth": false,
      "isActive": true,
      "createdAt": "2025-01-22T09:00:00Z",
      "lastUsedAt": "2025-01-22T11:30:00Z"
    },
    "shortUrl": "https://share.videoprompt.com/fb111aaa",
    "fullUrl": "https://videoprompt.com/feedback/session_uuid?token=share_token_1",
    "qrCodeUrl": "https://cdn.videoprompt.com/qr/share_token_1.png"
  }
]
```

#### 4.3 공유 링크 업데이트

```http
PATCH /api/feedback/share/{token}
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "accessLevel": "comment",
  "expiresAt": "2025-02-05T11:55:00Z",
  "maxUses": 200,
  "allowedDomains": ["newdomain.com"],
  "requiresAuth": false
}

Response 200:
{
  "token": "share_token_1",
  "permissions": {
    // 업데이트된 권한 정보
  },
  "shortUrl": "https://share.videoprompt.com/fb111aaa",
  "fullUrl": "https://videoprompt.com/feedback/session_uuid?token=share_token_1",
  "qrCodeUrl": "https://cdn.videoprompt.com/qr/share_token_1.png"
}
```

#### 4.4 공유 링크 비활성화/삭제

```http
POST /api/feedback/share/{token}/deactivate
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "deactivatedAt": "2025-01-22T12:00:00Z"
}
```

```http
DELETE /api/feedback/share/{token}
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid"
}

Response 200:
{
  "success": true,
  "deletedAt": "2025-01-22T12:05:00Z"
}
```

#### 4.5 공유 통계 조회

```http
GET /api/feedback/sessions/{sessionId}/share/stats

Response 200:
{
  "totalLinks": 5,
  "totalAccess": 23,
  "uniqueUsers": 12,
  "accessByLevel": {
    "view": 15,
    "comment": 8
  },
  "accessByDate": [
    {
      "date": "2025-01-22",
      "count": 10
    },
    {
      "date": "2025-01-23",
      "count": 13
    }
  ],
  "topDomains": [
    {
      "domain": "example.com",
      "count": 8
    },
    {
      "domain": "company.co.kr",
      "count": 5
    }
  ]
}
```

### 5. 스크린샷 API

#### 5.1 스크린샷 캡처

```http
POST /api/feedback/screenshot
Content-Type: application/json

Request Body:
{
  "sessionId": "session_uuid",
  "videoSlot": "v1",
  "versionId": "version_uuid",
  "timecode": {
    "seconds": 75.5,
    "formatted": "01:15"
  },
  "format": "jpg", // jpg, png, webp
  "quality": 90, // 1-100
  "includeTimestamp": true,
  "includeProjectInfo": true
}

Response 200:
{
  "id": "screenshot_uuid",
  "filename": "project-demo_TC011500_20250122T120000.jpg",
  "url": "https://cdn.videoprompt.com/screenshots/screenshot_uuid.jpg",
  "thumbnailUrl": "https://cdn.videoprompt.com/screenshots/thumbs/screenshot_uuid.jpg",
  "size": 245760,
  "dimensions": {
    "width": 1920,
    "height": 1080
  },
  "metadata": {
    "projectSlug": "demo",
    "timecode": "01:15",
    "capturedAt": "2025-01-22T12:00:00Z",
    "videoVersion": "v1.2"
  }
}

Error Responses:
400: 유효하지 않은 타임코드
404: 영상 또는 버전 없음
500: 캡처 실패
```

#### 5.2 스크린샷 다운로드

```http
GET /api/feedback/screenshot/{screenshotId}/download

Response 200:
Content-Type: image/jpeg
Content-Disposition: attachment; filename="project-demo_TC011500_20250122T120000.jpg"

[Binary Image Data]
```

### 6. QR 코드 API

#### 6.1 QR 코드 생성

```http
POST /api/feedback/share/qr-code
Content-Type: application/json

Request Body:
{
  "url": "https://videoprompt.com/feedback/session_uuid?token=share_token",
  "size": 200 // 픽셀 크기
}

Response 200:
{
  "qrCodeUrl": "https://cdn.videoprompt.com/qr/share_token.png"
}
```

#### 6.2 QR 코드 다운로드

```http
GET /api/feedback/share/{token}/qr-code/download?format=png

Response 200:
Content-Type: image/png
Content-Disposition: attachment; filename="qr-code.png"

[Binary Image Data]
```

## 🛡️ 인증 및 권한

### 인증 헤더

```http
Authorization: Bearer {jwt_token}
```

### 권한 확인

```http
POST /api/feedback/share/{token}/check-access
Content-Type: application/json

Request Body:
{
  "action": "comment" // view, comment, react, edit, admin
}

Response 200:
{
  "hasAccess": true,
  "permissions": {
    "view": true,
    "comment": true,
    "react": true,
    "edit": false,
    "admin": false
  },
  "userInfo": {
    "id": "user_uuid",
    "name": "사용자명",
    "type": "member"
  }
}
```

## 📊 페이지네이션 및 필터링

### 댓글 목록 페이지네이션

```http
GET /api/feedback/sessions/{sessionId}/comments/threaded?page=1&limit=20&sort=newest&filter=unresolved

Response 200:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "applied": ["unresolved"],
    "available": ["resolved", "unresolved", "hasAttachments", "hasReactions"]
  }
}
```

## 🔄 실시간 이벤트 (WebSocket)

### 연결

```javascript
const ws = new WebSocket('wss://api.videoprompt.com/feedback/realtime');

// 인증
ws.send(
  JSON.stringify({
    type: 'auth',
    token: 'jwt_token',
    sessionId: 'session_uuid',
  })
);
```

### 이벤트 타입

```typescript
type RealtimeEventType =
  | 'version_uploaded'
  | 'version_activated'
  | 'thread_created'
  | 'thread_resolved'
  | 'comment_replied'
  | 'screenshot_captured'
  | 'share_link_created'
  | 'share_link_accessed'
  | 'user_joined'
  | 'user_left';
```

### 이벤트 구조

```json
{
  "type": "comment_replied",
  "sessionId": "session_uuid",
  "userId": "user_uuid",
  "timestamp": "2025-01-22T12:15:00Z",
  "data": {
    "commentId": "comment_uuid",
    "parentId": "parent_uuid",
    "threadId": "thread_uuid",
    "timecode": {
      "seconds": 45.5,
      "formatted": "00:45"
    }
  }
}
```

## 🚨 에러 응답 표준

### 표준 에러 구조

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 유효하지 않습니다",
    "details": [
      {
        "field": "content",
        "message": "댓글 내용은 필수입니다",
        "code": "REQUIRED"
      },
      {
        "field": "timecode.seconds",
        "message": "타임코드는 0 이상이어야 합니다",
        "code": "MIN_VALUE"
      }
    ],
    "timestamp": "2025-01-22T12:20:00Z",
    "requestId": "req_uuid"
  }
}
```

### HTTP 상태 코드

- `200` OK: 성공
- `201` Created: 생성 성공
- `400` Bad Request: 잘못된 요청
- `401` Unauthorized: 인증 실패
- `403` Forbidden: 권한 없음
- `404` Not Found: 리소스 없음
- `409` Conflict: 충돌 (중복 등)
- `413` Payload Too Large: 파일 크기 초과
- `422` Unprocessable Entity: 비즈니스 로직 오류
- `429` Too Many Requests: 요청 제한 초과
- `500` Internal Server Error: 서버 오류
