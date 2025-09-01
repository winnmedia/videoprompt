# VideoPrompt 서비스 FRD (Functional Requirements Document)

## 📋 프로젝트 개요

**VideoPrompt**는 AI를 활용한 영상 콘텐츠 생성 및 관리 플랫폼으로, 복잡한 설정 없이 3단계만으로 전문가 수준의 영상을 제작할 수 있는 서비스입니다.

## 🎯 핵심 비즈니스 목표

1. **접근성 향상**: 전문 지식 없이도 고품질 영상 제작 가능
2. **효율성 증대**: 3단계 워크플로우로 빠른 콘텐츠 생성
3. **품질 보장**: AI 기반 자동화로 일관된 결과물 제공
4. **통합 관리**: 생성된 콘텐츠의 체계적 관리 및 재사용

## 🏗️ 기술 아키텍처

### 프론트엔드 스택

- **Framework**: Next.js 15.4.6 (App Router)
- **Language**: TypeScript 5.7 (Strict Mode)
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS v4 (신규 표준), CSS Modules (레거시)
- **State Management**: Zustand 5.0.7
- **Architecture**: Feature-Sliced Design (FSD) + Clean Architecture

### 백엔드 및 AI 서비스

- **AI Providers**:
  - Google Gemini (스토리 생성)
  - Seedance/ModelArk (영상 생성)
  - Google Imagen (이미지 생성)
  - Google Veo3 (영상 생성)
- **Database**: Prisma + PostgreSQL
- **Deployment**: Vercel (Frontend), Railway (Backend)

### 아키텍처 원칙

#### 2.1 FSD 경계 준수 (Feature-Sliced Design)

- 무엇(What): `shared → entities → features → widgets → app/pages`의 단방향 의존성만 허용하며, 각 슬라이스는 Public API(`index.ts`)를 통해서만 외부 노출
- 왜(Why): 레이어 침식과 순환 의존성을 원천 차단하여 유지보수성과 테스트 용이성 극대화
- 어떻게(How): 깊은 경로 임포트 금지, 배럴→배럴 재수출 금지, Named export 우선, `@/shared/*` 등 경로 별칭 사용, ESLint `import/no-cycle` 상시 점검

#### 2.2 TDD 우선 흐름 (Test-Driven Development)

- 무엇(What): "테스트 작성(실패) → 최소 구현(통과) → 리팩터링" 사이클로 개발, 수용 기준(DoD)을 테스트로 명세 후 개발
- 왜(Why): 요구사항 누락과 회귀 방지, 리팩터링 안전망 제공
- 어떻게(How): 유닛(도메인) → 통합(API/스토리 플로우) → E2E(스모크) 최소 세트 유지, 시간/네트워크 등 비결정성은 테스트 더블로 격리(MSW, Zod)

#### 2.3 클린 임포트 및 중복 제로(DRY)

- 무엇(What): 동일 목적 코드/스타일/유틸은 하나의 모듈로 추상화, 사이드 이펙트 임포트 최소화
- 왜(Why): 중복과 은닉 의존성은 리팩터링 비용 급증 유발
- 어떻게(How): `import type` 구분, 임포트 정렬(외부→내부→상대), 순환 차단, 클라이언트/서버 경계 준수, 린트/CI 강제

## ⚡ 주요 기능 요구사항

### 1. AI 영상 제작 워크플로우 (Phase 1-4)

#### 1.1 프로젝트 설정 및 메타데이터

- **프롬프트 이름 관리**: 사용자 정의 프로젝트명 입력
- **기본 스타일 선택**:
  - **영상미**:
    - Photorealistic, Hyperrealistic, Cinematic, Anamorphic, Vintage Film
    - Documentary, Experimental, Abstract, Minimalist, Baroque, Neo-noir
    - Cyberpunk, Steampunk, Retro-futuristic, Gothic, Art Deco
  - **장르**:
    - Action-Thriller, Sci-Fi Noir, Fantasy Epic, Modern Drama, Horror
    - Romantic Comedy, Mystery, Western, War, Musical, Documentary
    - Superhero, Martial Arts, Spy, Heist, Survival, Coming-of-age
  - **분위기**:
    - Tense, Moody, Gritty, Serene, Energetic, Nostalgic
    - Mysterious, Whimsical, Melancholic, Euphoric, Suspenseful
    - Peaceful, Chaotic, Dreamy, Nightmarish, Hopeful, Desperate
  - **화질**:
    - 4K, 8K, IMAX Quality, HD, Ultra HD, Cinema 4K
    - HDR, Dolby Vision, Raw Footage, ProRes, Film Grain
  - **연출 스타일**:
    - Christopher Nolan, David Fincher, Wes Anderson
    - Quentin Tarantino, Stanley Kubrick, Alfred Hitchcock
    - Akira Kurosawa, Federico Fellini, Ingmar Bergman
    - Denis Villeneuve, Bong Joon-ho, Park Chan-wook

#### 1.2 공간적 배경 설정

- **날씨**:
  - Clear, Rain, Heavy Rain, Snow, Fog, Overcast
  - Storm, Thunder, Lightning, Hail, Mist, Drizzle
  - Blizzard, Sandstorm, Heatwave, Freezing Rain
- **조명**:
  - Daylight, Golden Hour, Blue Hour, Night, Studio Lighting, Flickering Light
  - Sunrise, Sunset, Twilight, Moonlight, Candlelight, Neon
  - Firelight, Starlight, Cloudy, Overcast, Harsh Sunlight
  - Soft Diffused, Hard Shadows, Rim Lighting, Backlighting

#### 1.3 카메라 설정

- **렌즈**:
  - 16mm Fisheye, 24mm Wide-angle, 50mm Standard, 85mm Portrait, 135mm Telephoto
  - 35mm Wide, 70mm Medium Tele, 200mm Long Tele, 400mm Super Tele
  - 8mm Ultra Wide, 12mm Super Wide, 100mm Macro, 300mm Wildlife
- **움직임**:
  - Static Shot, Shaky Handheld, Smooth Tracking, Crane Shot, Zoom
  - Steadicam, Gimbal, Drone Shot, Helicopter Shot, Cable Cam
  - Jib Movement, Slider, Car Mount, Shoulder Rig, Tripod Pan
  - Dutch Angle, Low Angle, High Angle, Bird's Eye, Worm's Eye

#### 1.4 핵심 사물 정의

- **재질**:
  - Brushed Metal, Polished Wood, Transparent Glass, Matte Plastic, Rough Fabric, Leather
  - Chrome, Stainless Steel, Copper, Bronze, Gold, Silver
  - Marble, Granite, Concrete, Brick, Ceramic, Porcelain
  - Silk, Velvet, Denim, Canvas, Linen, Wool
  - Carbon Fiber, Titanium, Aluminum, Iron, Stone, Crystal

#### 1.5 타임라인 연출

- **카메라 앵글**:
  - Wide Shot, Medium Shot, Close Up, Extreme Close Up, Point of View
  - Long Shot, Medium Long Shot, Medium Close Up, Big Close Up
  - Two Shot, Group Shot, Over-the-Shoulder Shot, Reaction Shot
- **카메라 무빙**:
  - Pan, Tilt, Dolly, Tracking, Whip Pan
  - Arc Shot, Spiral Shot, 360° Rotation, Vertical Rise, Horizontal Slide
  - Push In, Pull Out, Rise Up, Drop Down, Circle Around
- **템포**:
  - Real-time, Slow-motion (0.5x/0.2x), Fast-motion (2x), Time-lapse, Freeze-frame
  - Bullet Time, Matrix Effect, Ultra Slow (0.1x), Hyper Fast (5x), Variable Speed
  - Reverse Motion, Stop Motion, Step Frame, Smooth Ramp
- **음향 품질**:
  - Clear, Muffled, Echoing, Distant, Crisp
  - Bass Heavy, Treble Rich, Stereo Wide, Mono, Surround Sound
  - Atmospheric, Ambient, Diegetic, Non-diegetic, Foley

### 2. 장면 요소 정의

#### 2.1 등장인물 관리

- **캐릭터 추가**: + 버튼으로 새 캐릭터 생성
- **설명 입력**: 텍스트 기반 캐릭터 설명
- **이미지 업로드**: 레퍼런스 이미지 파일 선택 및 저장
- **API 연동**: POST `/api/upload/image`로 이미지 업로드

#### 2.2 핵심 사물 정의

- **사물 설명**: 텍스트 기반 사물 설명
- **이미지 참조**: 관련 이미지 업로드 및 관리

### 3. 동적 타임라인 연출

#### 3.1 타임스탬프 관리

- **동적 생성**: + 버튼으로 TS-3, TS-4 등 새 블록 생성
- **연출 패널**: 각 블록별 세부 연출 내용 입력
- **실시간 업데이트**: 사용자 입력을 segments[] state에 즉시 반영
- **영상 길이 제한**: 총 8초의 한계가 있는 영상 생성
- **시간 분배 규칙**:
  - TS-1, TS-2만 있을 때: 각각 4초씩 할당
  - TS-1, TS-2, TS-3가 있을 때: 각각 3초, 2초, 3초 할당
  - TS-1, TS-2, TS-3, TS-4까지 있을 때: 각각 2초씩 균등 할당

### 4. AI 어시스턴트 및 최종화

#### 4.1 LLM 자동 추천

- **스마트 추천**: 현재 프롬프트 데이터를 종합하여 키워드 및 네거티브 프롬프트 자동 생성
- **API 연동**: POST `/api/generate/suggestions`로 백엔드 연동
- **응답 처리**: keywords와 negative_prompts 필드에 자동 업데이트

#### 4.2 최종 코드 생성

- **통합 생성**: 모든 state를 종합하여 최종 JSON 객체 생성
- **표시 및 복사**: 생성된 코드를 화면에 표시하고 클립보드 복사 기능 제공
- **출력 형식**: 최종 생성된 프롬프트는 JSON 형태로 구조화
- **JSON 예시**:

```json
{
  "metadata": {
    "prompt_name": "Rooftop Deal Gone Wrong - Full SFX",
    "base_style": "cinematic, photorealistic, action-thriller, 4K",
    "aspect_ratio": "21:9",
    "room_description": "Dimly lit urban rooftop at night, glistening wet from rain. Antennas blink red. Foggy city skyline glows in the distance, with distant lightning occasionally illuminating the scene.",
    "camera_setup": "Starts with slow dolly-in on the deal, then transitions to shaky handheld-style cam as action explodes. Ends with quick pan up to helicopter light overhead."
  },
  "key_elements": [
    "two opposing groups in tactical jackets",
    "metal briefcase passed between them",
    "sniper laser dot appears mid-chest",
    "rain bouncing off slick surfaces",
    "gunfire and flash eruptions",
    "briefcase grab and rooftop sprint",
    "masked gunmen chasing with drawn pistols",
    "helicopter searchlight sweeping from above",
    "dripping puddles, metal stair railings, fog"
  ],
  "assembled_elements": [
    "reflective puddles and rooftop textures",
    "briefcase with glowing lock panel",
    "helicopter spotlight beam cutting through fog"
  ],
  "negative_prompts": [
    "no blood",
    "no supernatural elements",
    "no text",
    "no daytime or sun",
    "no sci-fi weapons"
  ],
  "timeline": [
    {
      "sequence": 1,
      "timestamp": "00:00-00:02",
      "action": "Wide shot: Two teams approach under light rain. The briefcase is handed over and clicked open to inspect the contents.",
      "audio": "Heavy rain hitting metal, low thunder rumble, faint city sirens in distance, zipper rustle, metal latch click"
    },
    {
      "sequence": 2,
      "timestamp": "00:02-00:04",
      "action": "Sniper dot appears suddenly on a man's chest. Immediate panic. Someone shouts. A shot is fired — chaos erupts.",
      "audio": "Laser whine, shout: 'DOWN!', sniper crack, echoing gunfire bursts, footsteps scatter, briefcase slams shut"
    },
    {
      "sequence": 3,
      "timestamp": "00:04-00:06",
      "action": "Our protagonist snatches the case and sprints toward the fire escape. Gunmen chase as bullets ricochet nearby.",
      "audio": "Fast footsteps on wet concrete, pistol shots echoing, metal clank of stairs, labored breathing, wind gusts"
    },
    {
      "sequence": 4,
      "timestamp": "00:06-00:08",
      "action": "A helicopter spotlight sweeps over the rooftop as he vanishes down the staircase. The camera pans up slowly into fog.",
      "audio": "Chopper blades overhead, spotlight hum, storm crackle, rising dramatic bass swell, echo of footsteps fading"
    }
  ],
  "text": "none",
  "keywords": [
    "rooftop action",
    "briefcase exchange",
    "sniper ambush",
    "gunfight escape",
    "rain cinematic",
    "helicopter chase",
    "thriller SFX",
    "Veo 3 movie trailer style"
  ]
}
```

## 🔄 사용자 워크플로우

### 메인 페이지 → 기능 선택

1. **간단한 영상 제작**: `/workflow` - 3단계 AI 영상 제작
2. **AI 시나리오 개발**: `/scenario` - 체계적인 스토리 개발
3. **콘텐츠 관리**: `/planning` - 생성된 영상과 기획안 관리

### AI 시나리오 생성 프로세스

1. **스토리 입력**: 기본 정보 (제목, 설명, 장르, 타겟)
2. **4단계 구성**: AI가 생성한 기승전결 구조 검토 및 수정
3. **숏트 분해**: 12개 숏트로 분해하여 콘티 및 인서트샷 생성

### 영상 제작 프로세스

1. **스토리 입력**: 간단한 텍스트로 시작
2. **스타일 선택**: 드롭다운 메뉴를 통한 체계적 스타일링
3. **영상 생성**: AI 서비스를 통한 자동 영상 제작

## 📊 데이터 모델

### 메타데이터 구조

```typescript
interface Metadata {
  prompt_name: string;
  base_style: string[]; // 쉼표로 구분된 문자열로 저장
  spatial_context: string[];
  camera_setting: string[];
  core_object: string[];
  timeline: string[];
}
```

### 요소 구조

```typescript
interface Elements {
  characters: Array<{
    description: string;
    reference_image_url: string;
  }>;
  core_objects: Array<{
    description: string;
    reference_image_url: string;
  }>;
}
```

### 타임라인 구조

```typescript
interface Timeline {
  segments: Array<{
    timestamp: string;
    camera_angle: string;
    camera_movement: string;
    pacing: string;
    audio_quality: string;
    description: string;
  }>;
}
```

### 영상 상태 모델 [추가]

```typescript
interface VideoStatus {
  id: string; // 내부 영상 ID (개발/데모용)
  provider: 'seedance' | 'veo' | 'mock';
  status: 'queued' | 'processing' | 'pending' | 'succeeded' | 'failed';
  jobId?: string; // Seedance 작업 ID
  operationId?: string; // Veo3 operation ID
  videoUrl?: string; // 결과 영상 URL 또는 data URI(mock)
  thumbnailUrl?: string; // 썸네일 경로(선택)
  progress?: number; // 0~100 (가능 시)
  duration?: number; // 초
  aspectRatio?: string; // 예: '16:9'
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
  completedAt?: string; // ISO
  error?: string; // 실패 사유
}
```

### 스키마 검증 및 DTO→도메인 매핑 [추가]

- 입력 검증: 모든 API 입력은 Zod로 런타임 검증(필수 필드/타입/허용 범위)
- 변환 레이어: 외부 DTO → 내부 도메인으로 일원화. 예시(요약):
  - Seedance 상태 DTO `{ status, video_url }` → `{ status, videoUrl }`
  - Veo 상태 DTO `{ operationId, videoUrl, progress }` → 동일 필드 유지
  - 공통 스키마는 `VideoStatus`에 맞춰 정규화

## 🔌 API 엔드포인트

### API 응답 규약 [추가]

- 모든 API는 공통 응답 래퍼를 따른다.

```typescript
type ApiSuccess<T> = { ok: true; data: T };
type ApiError = {
  ok: false;
  code:
    | 'INVALID_PROMPT'
    | 'INVALID_INPUT_FIELDS'
    | 'MISSING_OPERATION_ID'
    | 'PROVIDER_UNAVAILABLE'
    | 'STATUS_CHECK_FAILED'
    | 'RATE_LIMITED'
    | 'TIMEOUT'
    | 'FALLBACK_TO_MOCK'
    | 'INVALID_URLS'
    | 'SAVE_FAILED'
    | 'PARTIAL_SAVE_FAILED'
    | 'UNKNOWN';
  error: string;
  details?: string;
};
type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

- 대표 오류 코드 매핑
  - `/api/video/create`: `INVALID_PROMPT`, `PROVIDER_UNAVAILABLE(seedance|veo)`, `TIMEOUT`, `FALLBACK_TO_MOCK`
  - `/api/video/status/[id]`: `MISSING_OPERATION_ID`, `STATUS_CHECK_FAILED`
  - `/api/imagen/preview`: `INVALID_PROMPT`, `PROVIDER_UNAVAILABLE(imagen)`, `TIMEOUT`
  - `/api/ai/generate-(story|prompt|planning)`: `INVALID_INPUT_FIELDS`, `MODEL_ERROR(=UNKNOWN)`, `PARSING_FAILED(=UNKNOWN)`
  - `/api/files/save`: `INVALID_URLS`, `SAVE_FAILED`, `PARTIAL_SAVE_FAILED`

### 1) 스토리/프롬프트/기획

- `POST /api/ai/generate-story`: 4단계 스토리 구조 생성 (Gemini 사용, 실패 시 기본 템플릿 반환)
- `POST /api/ai/generate-prompt`: 스타일/타임라인 포함 구조적 프롬프트 생성 (Gemini 사용)
- `POST /api/ai/generate-planning`: 제작 기획안 생성 (요약/구조/비용/전략 등)
- `POST /api/scenario/develop`: 시나리오 보강 + 이미지/Seedance용 리라이트 + 추천 반환

### 2) 미디어(이미지/영상)

- `POST /api/imagen/preview`: Imagen 프리뷰 생성(백엔드 Railway로 위임, 성공 시 비동기 파일 저장 시도)
- `POST /api/video/create`: 통합 영상 생성 엔드포인트
  - 동작: provider가 `auto`일 때 Seedance → 실패 시 Veo → 모두 실패 시 Mock SVG 비디오로 폴백
  - 요청 예시:

```json
{ "prompt": "A cinematic rooftop chase", "duration": 8, "aspectRatio": "16:9", "provider": "auto" }
```

- 성공 응답 예시(Seedance):

```json
{ "ok": true, "provider": "seedance", "jobId": "job_123", "status": "queued" }
```

- 성공 응답 예시(Veo3):

```json
{ "ok": true, "provider": "veo3", "operationId": "operations/abc", "status": "processing" }
```

- 폴백(Mock) 예시:

```json
{
  "ok": true,
  "provider": "mock",
  "videoUrl": "data:image/svg+xml;base64,...",
  "message": "실제 API 실패로 Mock 생성"
}
```

- `GET /api/video/status/[id]?provider=seedance|veo`: 통합 상태 조회 (동일 스키마로 `provider`, `status`, `progress`, `videoUrl` 반환)

#### 영상 생성 상태 머신·폴링 정책 [추가]

- 상태: `queued → processing → (succeeded | failed)` (+ 일부 통합 경로에서 `pending` 허용)
- 폴링: 2초 간격, 최대 60초(30회). 미완료 시 사용자에게 재시도/나중에 확인 안내.
- `provider=auto` 동작: Seedance 시도 실패 시 Veo로 자동 폴백. 둘 다 실패 시 Mock 생성(사용자에게 폴백 사실 알림).
- 실패 분류: 4xx 입력 오류는 즉시 실패, 5xx/네트워크는 리트라이 전략 적용(아래 정책 참조).

### 3) Provider별(직접 호출)

- Seedance: `POST /api/seedance/create`, `GET /api/seedance/status/[id]`, `GET /api/seedance/status-debug/[id]`, `POST /api/seedance/webhook`, `GET /api/seedance/diagnose`
- Veo3: `POST /api/veo/create`, `GET /api/veo/status/[id]`

### 4) 파일 관리

- `POST /api/upload/image`: 이미지 업로드(현재 Mock URL 반환)
- `POST /api/files/save`: 원격 URL의 파일 저장
  - 요청 예시:

```json
{ "urls": ["https://example.com/file.mp4"], "prefix": "seedance-", "subDirectory": "videos" }
```

### 5) 시스템/진단

- `GET /api/health`: 애플리케이션 헬스
- `GET /api/net/egress`: 외부 네트워크/지역/DNS 진단

### 6) 내부/개발용

- `GET|POST|PUT /api/videos/status`: 메모리 저장소 기반 상태 조회/업데이트(개발·데모용)

참고: 배포 환경에서 `next.config.mjs`의 rewrites에 따라 `/api/(seedance|imagen|veo|scenario|video|net)/:path*` 요청은 기본적으로 Railway 백엔드로 프록시됩니다. 일부 라우트는 오케스트레이션/폴백을 위해 앱 내부 핸들러가 존재합니다.

## 🎨 UI/UX 요구사항

### 디자인 원칙

- **모던한 인터페이스**: Tailwind CSS 기반의 깔끔한 디자인
- **반응형 디자인**: 모바일부터 데스크톱까지 모든 디바이스 지원
- **직관적 사용법**: 3단계로 단순화된 워크플로우
- **시각적 피드백**: 호버 효과, 로딩 상태, 성공/실패 메시지

### 접근성 수용 기준(A11y) [추가]

- 키보드 완주 가능(모든 인터랙션 요소 Enter/Space 활성화), 포커스 트랩(모달)
- 의미 기반 쿼리(role/name/label), form은 `id/htmlFor` 일치, 라이브 리전으로 로딩/오류 알림
- 명도 대비 4.5:1 이상(텍스트/아이콘), 포커스 링 시각적 구분 유지

### 상태별 UI 표준 [추가]

- 로딩: 스켈레톤/스피너 + `aria-busy`/`aria-live="polite"`
- 성공: 결과 스낵바/토스트, 핵심 메타 요약(길이, 제공자, 상태)
- 오류: 사용자 원인/시스템 원인 구분 메시지, 재시도/지원 링크, 오류코드 표기

### 컴포넌트 구조

- **MetadataForm**: 기본 스타일 및 설정 입력
- **ElementBuilder**: 장면 요소 정의
- **DynamicTimeline**: 타임라인 연출 관리
- **LLMAssistant**: AI 기반 자동 추천
- **ImageUploader**: 이미지 업로드 및 관리

### 글로벌 헤더 & 브랜딩

- **좌상단 로고**: `/w_logo.svg`(흰색 텍스트 VLANET 로고)를 사용하며, 헤더 바의 세로 높이에 맞춰 자동 맞춤(높이 100% 유지, 종횡비 보존). 로고 옆의 텍스트 라벨 `vlanet`는 표시하지 않음.
- **명도 대비**: 다크 테마에서도 충분한 대비 확보(배경 `surface` 톤 대비 4.5:1 이상). 호버/포커스시 아웃라인 표시.
- **네비**: 홈, AI 영상 기획(`/scenario`), 프롬프트 생성기(`/prompt-generator`), 영상 생성(`/workflow`), 영상 피드백(`/feedback`), 콘텐츠 관리(`/planning`).

### 랜딩 페이지 CTA 라우팅

- **무료로 시작하기**: 클릭 시 AI 영상 기획 기능으로 이동 → 라우트 `/scenario`.
- **워크플로우 보기**: 클릭 시 기능 설명 매뉴얼 페이지로 이동 → 라우트 `/manual`.

## 🧪 품질 보증

### 테스트 전략

- **TDD 원칙**: Red → Green → Refactor 사이클
- **테스트 피라미드**: 단위(90%), 컴포넌트/통합(70%), E2E
- **MSW 모킹**: 외부 API 의존성 절단
- **결정론성**: 플래키 테스트 방지

### 품질 게이트

- **타입 안정성**: TypeScript 컴파일 통과
- **코드 품질**: ESLint, Prettier 통과
- **테스트 커버리지**: Jest, Cypress 통과
- **성능 예산**: LCP 2.5초, INP 200ms, CLS 0.1 이하

## 🚀 배포 및 운영

### 자동화된 배포

- **GitHub Actions**: Pull Request마다 Preview 배포
- **Vercel 연동**: main 브랜치 푸시 시 Production 배포
- **환경별 설정**: 개발/프로덕션 환경 자동 감지

### 모니터링 및 알림

- **MCP 서버**: 성능 모니터링 및 알림 서비스
- **에러 추적**: 상세한 에러 로깅 및 분석
- **성능 지표**: 실시간 성능 모니터링

### 관측성 표준(로깅/트레이싱) [추가]

- 구조화 로깅: `timestamp, level, endpoint, provider, jobId|operationId, elapsedMs, retryCount` 포함
- 추적: `traceId/requestId` 전파(응답 헤더, 클라이언트 스토리지 보관 금지), 오류에 `error_code` 태그 부여
- 민감정보(PII) 제외, URL/토큰 마스킹. 샘플링은 에러/슬로우쿼리 우선 수집

### 환경변수 요약 [추가]

- `GOOGLE_GEMINI_API_KEY`: Gemini/Veo/Imagen 호출용 API 키 (필수)
- `IMAGEN_PROVIDER`, `IMAGEN_LLM_MODEL`: Imagen Provider/모델 지정
- `VEO_PROVIDER`, `VEO_MODEL`: Veo3 활성화/모델 지정
- `SEEDANCE_API_KEY`, `SEEDANCE_API_BASE`, `SEEDANCE_MODEL`: Seedance/ModelArk 설정
  참고: 세부 가이드는 `ENVIRONMENT_VARIABLES.md` 참조. 프로덕션은 Railway 대시보드에 설정.

## 📋 기능별 상세 명세

### 프롬프트 생성기 (Prompt Generator)

- **위치**: `/prompt-generator`
- **목적**: 체계적인 AI 영상 프롬프트 생성
- **핵심 기능**:
  - 스타일 태그 빌더를 통한 체계적 설정
  - 이미지 업로드 및 참조 관리
  - 동적 타임라인 구성
  - LLM 기반 자동 추천

### 워크플로우 관리

- **위치**: `/workflow`
- **목적**: 3단계 영상 제작 프로세스 관리
- **단계별 구성**:
  1. 기본 설정 및 스타일 선택
  2. 장면 요소 및 캐릭터 정의
  3. 타임라인 연출 및 최종 생성

### 시나리오 개발 모드

- **위치**: `/scenario`
- **목적**: 체계적인 스토리 개발 및 구조화
- **AI 연동**: GPT-4, Gemini를 활용한 스토리 생성
- **출력물**: 4단계 구조, 12개 숏트, 콘티 이미지

### 기획안 관리

- **위치**: `/planning`
- **목적**: 생성된 콘텐츠의 통합 관리
- **기능**: 검색, 필터링, 편집, 영상 플레이어

#### 탭 구성 (필수)

- **AI 시나리오**: 제목, 버전, 작성자, 업데이트, 4단계/12숏 여부, PDF 다운로드
- **프롬프트**: 참조 시나리오, 버전, 키워드 수, 타임라인 세그먼트 수, 업데이트
- **이미지**: 타입(콘티/인서트), 태그, 해상도, 업로더, 업로드일
- **영상**: 버전, 길이, 코덱, 상태, 제공자, 참조 프롬프트, 생성시간, 피드백 바로가기

### 워크플로우 매뉴얼 페이지 (Manual) [New]

- **위치**: `/manual`
- **목적**: 신규/기존 사용자가 전 기능을 빠르게 이해·활용하도록 단계별 가이드와 모범 사례 제공
- **레이아웃**: 좌측 고정 목차(섹션 앵커), 우측 본문. 브레드크럼과 상단 검색 입력 제공.
- **콘텐츠 섹션(앵커 포함)**:
  1. 시작하기: 계정/프로젝트 생성, 전역 테마, 네비 구조
  2. AI 시나리오 개발: 스토리 입력 → 4단계 구성 → 12숏 분해, PDF 내보내기(Marp 명세)
  3. 프롬프트 생성기: 4단계 구성 데이터를 로드해 키워드/타임라인 정제, JSON 출력
  4. 영상 생성: 최신 프롬프트 로드, 제공자(Seedance/Veo3) 선택, 상태 조회
  5. 영상 피드백: 플레이어 툴바(교체/공유/스크린샷/현재시점 코멘트), 버전 스위처와 메타데이터, 코멘트 범위
  6. 콘텐츠 관리: 탭별 기본 컬럼(AI 시나리오/프롬프트/이미지/영상)과 필터 예시
  7. 단축키 & 접근성: T(타임코드), 폼 `id/htmlFor`, `data-testid` 활용 규칙
  8. 트러블슈팅: 업로드 실패 사유, 빌드/테스트 체크리스트
- **요구사항**:
  - 모든 섹션에 고유 앵커 제공(`#getting-started` 등), URL 해시로 직접 링크 가능
  - 본문 내 관련 기능으로의 딥링크 버튼 제공(예: “프롬프트 생성기로 이동” → `/prompt-generator`)
  - 페이지 내 검색(제목/소제목/키워드) 지원, 키보드 포커스 이동 가능
  - CTA “워크플로우 보기”는 이 페이지(`/manual`)로 라우팅

### 영상 기획 (Planning Wizard) [New Feature]

- **역할**: 한 줄 스토리 → 4단계 → 12숏 → 콘티/인서트 → JSON + Marp PDF 자동·반자동 산출
- **위치**: `/planning/create`
- **사용자 여정 (3-Step Wizard)**:
  1. 입력/선택: 제목, 로그라인, 드롭다운(톤앤매너 등), 버튼 그룹(전개 방식), 프리셋 버튼 → [생성] 시 Google Gemini API 호출
  2. 4단계 검토/수정: 4개 카드 인라인 편집 → [숏 생성] 시 12개 숏으로 자동 분해
  3. 12숏 편집·콘티·인서트·내보내기: 3x4 그리드, 좌(콘티 이미지 생성/관리), 우(숏 상세 편집), 인서트 3컷 추천, JSON + Marp PDF 다운로드
- **LLM/편집 규칙**: 전개 강도 반영, 정확히 12숏 분해, 템포별 길이 힌트, 인서트 목적 중복 금지, 콘티 스타일(storyboard pencil sketch, rough, monochrome 등) 지정
- **Marp PDF 명세**: A4 가로, 여백 0, 페이지형 UI, 표지/개요/12숏 상세, 푸터(`VLANET • {프로젝트명} • {p}/{n}`)
- **요구 UI 요소**: 스텝퍼, 입력 폼, 프리셋 버튼, 진행 표시, 카드 에디터, 숏 그리드, 인서트 칩, 내보내기 모달
- **오류 처리**: LLM/이미지 생성 실패·타임아웃 시 해당 카드에 "생성에 실패했습니다." 메시지와 함께 [재시도] 버튼 활성화

### 영상 피드백 (Video Feedback) [New Feature]

- **역할**: 영상 재생 + 타임코드 기반 코멘트 협업(실시간 제외)
- **위치**: `/feedback`
- **레이아웃**: 좌(비디오 플레이어), 우(탭: 코멘트 / 팀원 / 프로젝트 정보)
- **기능 명세**:
  - 코멘트: '코멘트' 용어 표준화, 대댓글, 감정표현 3종, 정렬/필터
  - 팀원/프로젝트 정보: 프로젝트 관리 연동
  - 보조: 타임코드 자동 반영(T 단축키), 스크린샷 파일명 `project-{slug}_TC{mmssfff}_{YYYY-MM-DD}T{HHmmss}.jpg`, 공유 권한·만료 설정
- **요구 UI 요소**: 플레이어 툴바, 코멘트 입력/리스트, 팀원 탭, 프로젝트 정보 탭, 모달(업로드/공유 등)
- **오류 처리**: 업로드 실패 시 원인(파일 크기 초과, 미지원 형식 등) 명확 안내

#### 추가 요구사항 (Controls & Versioning)

- **플레이어 하부 툴바(좌→우)**:
  - 영상 교체(Replace) 버튼: 새로운 파일 업로드 또는 기존 버전 선택으로 교체
  - 영상 공유(Share) 버튼: 링크/권한/만료 설정 포함 공유 모달 호출
  - 스크린샷(Snapshot) 버튼: 현재 프레임 캡처 → 파일명 규칙 적용(`project-{slug}_TC{mmssfff}_{YYYY-MM-DD}T{HHmmss}.jpg`)
  - 현재 시점 피드백(Feedback @TC) 버튼: 현재 타임코드로 코멘트 입력창 포커스 및 자동 채움(T 단축키와 동일 동작)
- **버전 관리(Versioned Player)**:
  - 버전 스위처(UI): v1, v2, v3… 선택 가능, 기본 최신 버전 로드
  - 메타데이터: 각 버전별 업로더, 업로드 시각, 원본 파일명/해시, 길이/코덱 등 저장
  - 코멘트 범위: 기본은 버전 단위로 격리, 옵션으로 "모든 버전 보기" 토글 제공
  - 교체 정책: 새 업로드 시 자동으로 신규 버전 생성(기존 파일은 보존), 되돌리기(Revert)로 과거 버전 활성화 가능

## 🔒 보안 및 권한

### 인증 및 권한

- **API 키 관리**: 환경변수를 통한 안전한 API 키 관리
- **CORS 설정**: 적절한 CORS 헤더로 보안 강화
- **입력 검증**: Zod를 통한 런타임 데이터 검증

### 데이터 보호

- **파일 업로드**: 안전한 파일 저장 및 접근 제어
- **에러 처리**: 민감한 정보 노출 방지
- **로깅**: PII 정보 제외한 안전한 로깅

### 레이트리밋 및 콘텐츠 안전 정책 [추가]

- 레이트리밋: 사용자/프로젝트 기준 영상 생성 분당 3회, 시간당 10회. 초과 시 `RATE_LIMITED` 반환
- 콘텐츠 안전: 폭력·혐오·개인정보·상표권 침해 프롬프트 차단 또는 리뷰 보류. 차단 시 사용자 피드백과 가이드 제시
- 키 관리: 모든 외부 API 키는 서버 측 환경변수에서만 사용. 클라이언트 노출 금지

## 📈 성능 요구사항

### 응답 시간

- **페이지 로딩**: 3초 이내
- **API 응답**: 8초 이내 (AI 서비스 고려)
- **이미지 업로드**: 10초 이내

### 동시 사용자

- **동시 접속**: 100명 이상 지원
- **동시 생성**: 20개 이상의 동시 영상 생성 지원

### 리트라이/백오프/타임아웃 정책 [추가]

- 네트워크/5xx 오류: 최대 3회 재시도, 고정 2초 지연, 엔드포인트 기본 타임아웃 60초(이미지 120초)
- 4xx 사용자 오류: 재시도 없음(즉시 피드백 및 수정 가이드)
- 타임아웃 시 사용자에게 재시도/배경 처리 안내, 폴백 경로 존재 시 표시(Mock 등)

### 캐싱/프리패치 전략 [추가]

- 상태 조회(`/api/video/status`): `Cache-Control: no-store`(실시간 우선)
- 문서/매뉴얼 페이지: `stale-while-revalidate=60` 적용
- 프리패치: 주요 네비 경로와 최근 작업 상태를 소극적으로 프리패치(사용자 입력 방해 금지)

## 🔄 향후 확장 계획

### 단기 목표 (3개월)

- **AI 모델 확장**: 추가 AI 서비스 통합
- **템플릿 시스템**: 미리 정의된 스타일 템플릿 제공
- **협업 기능**: 팀 기반 프로젝트 관리

### 중기 목표 (6개월)

- **고급 편집 도구**: 기본적인 영상 편집 기능
- **배포 플랫폼**: YouTube, TikTok 등 직접 업로드
- **분석 대시보드**: 콘텐츠 성과 분석

### 장기 목표 (1년)

- **실시간 협업**: 동시 편집 및 실시간 피드백
- **AI 학습**: 사용자 패턴 기반 개인화 추천
- **엔터프라이즈**: 기업용 고급 기능 및 API

---

**문서 버전**: 1.3.0  
**최종 업데이트**: 2025-09-01  
**작성자**: AI Assistant  
**검토자**: 개발팀

---

> 이 FRD는 VideoPrompt 서비스의 핵심 기능과 요구사항을 체계적으로 정리한 문서입니다. AI 기반 영상 제작의 접근성을 높이고, 전문적인 콘텐츠 생성을 지원하는 것이 주요 목표입니다.
