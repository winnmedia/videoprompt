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

## 🔌 API 엔드포인트

### AI 서비스
- `POST /api/ai/generate-story`: 스토리 구조 생성
- `POST /api/ai/generate-prompt`: 프롬프트 생성
- `POST /api/ai/generate-planning`: 기획안 생성

### 영상 생성
- `POST /api/seedance/create`: Seedance 영상 생성
- `GET /api/seedance/status/[id]`: 생성 상태 확인
- `POST /api/veo/create`: Google Veo3 영상 생성

### 파일 관리
- `POST /api/upload/image`: 이미지 업로드
- `GET /api/files/[type]/[filename]`: 파일 다운로드

## 🎨 UI/UX 요구사항

### 디자인 원칙
- **모던한 인터페이스**: Tailwind CSS 기반의 깔끔한 디자인
- **반응형 디자인**: 모바일부터 데스크톱까지 모든 디바이스 지원
- **직관적 사용법**: 3단계로 단순화된 워크플로우
- **시각적 피드백**: 호버 효과, 로딩 상태, 성공/실패 메시지

### 컴포넌트 구조
- **MetadataForm**: 기본 스타일 및 설정 입력
- **ElementBuilder**: 장면 요소 정의
- **DynamicTimeline**: 타임라인 연출 관리
- **LLMAssistant**: AI 기반 자동 추천
- **ImageUploader**: 이미지 업로드 및 관리

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

### 영상 기획 (Planning Wizard) [New Feature]
- **역할**: 한 줄 스토리 → 4단계 → 12숏 → 콘티/인서트 → JSON + Marp PDF 자동·반자동 산출
- **위치**: `/planning/create`
- **사용자 여정 (3-Step Wizard)**:
  1) 입력/선택: 제목, 로그라인, 드롭다운(톤앤매너 등), 버튼 그룹(전개 방식), 프리셋 버튼 → [생성] 시 Google Gemini API 호출
  2) 4단계 검토/수정: 4개 카드 인라인 편집 → [숏 생성] 시 12개 숏으로 자동 분해
  3) 12숏 편집·콘티·인서트·내보내기: 3x4 그리드, 좌(콘티 이미지 생성/관리), 우(숏 상세 편집), 인서트 3컷 추천, JSON + Marp PDF 다운로드
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

## 📈 성능 요구사항

### 응답 시간
- **페이지 로딩**: 3초 이내
- **API 응답**: 8초 이내 (AI 서비스 고려)
- **이미지 업로드**: 10초 이내

### 동시 사용자
- **동시 접속**: 100명 이상 지원
- **동시 생성**: 20개 이상의 동시 영상 생성 지원

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

**문서 버전**: 1.2.0  
**최종 업데이트**: 2025-09-01  
**작성자**: AI Assistant  
**검토자**: 개발팀

---

> 이 FRD는 VideoPrompt 서비스의 핵심 기능과 요구사항을 체계적으로 정리한 문서입니다. AI 기반 영상 제작의 접근성을 높이고, 전문적인 콘텐츠 생성을 지원하는 것이 주요 목표입니다.
