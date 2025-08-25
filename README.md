# VideoPrompt - AI 영상 콘텐츠 생성 플랫폼

AI를 활용한 영상 콘텐츠 생성 및 관리 플랫폼입니다. Google Imagen, Seedance, Google Veo3 등 다양한 AI 서비스를 통합하여 이미지와 영상을 생성하고, 체계적인 시나리오 개발을 지원합니다.

## 🚀 주요 기능

### AI 콘텐츠 생성
- **AI 이미지 생성**: Google Imagen, DALL-E를 활용한 프롬프트 기반 이미지 생성
- **AI 영상 생성**: Seedance, Google Veo3를 활용한 프롬프트 기반 영상 생성
- **AI 시나리오 생성**: GPT-4, Gemini를 활용한 체계적인 시나리오 개발

### 시나리오 개발 모드
- **3단계 위저드**: 스토리 입력 → 4단계 구성 → 숏트 분해
- **AI 기반 스토리 구조화**: 기승전결 구조의 자동 생성
- **콘티 이미지 생성**: 각 숏트별 시각적 가이드
- **인서트샷 추천**: 전문적인 영상 제작 가이드

### 기획안 관리
- **통합 관리**: 시나리오, 영상, 이미지 기획안을 한 곳에서 관리
- **실시간 편집**: 기획안 내용 및 상태 실시간 수정
- **검색 및 필터링**: 제목, 설명, 상태, 타입별 검색
- **영상 플레이어**: 생성된 영상의 직접 재생 및 다운로드

## 🏗️ 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, CSS Modules
- **AI Services**: Google Imagen, Google Veo3, Seedance (ModelArk), OpenAI GPT-4, Google Gemini
- **Architecture**: Feature-Sliced Design (FSD) + Clean Architecture
- **Development**: TDD (Test-Driven Development)

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── ai/            # AI 서비스 API
│   │   ├── imagen/        # Google Imagen API
│   │   ├── seedance/      # Seedance API
│   │   ├── veo/           # Google Veo3 API
│   │   └── videos/        # 영상 관리 API
│   ├── planning/          # 기획안 관리 페이지
│   ├── scenario/          # 시나리오 개발 모드
│   ├── test-video/        # 영상 생성 테스트
│   └── wizard/            # AI 콘텐츠 생성 위저드
├── components/            # 공용 UI 컴포넌트
├── features/              # 기능별 훅 및 로직
├── lib/                   # 서비스 및 유틸리티
│   ├── providers/         # AI 서비스 프로바이더
│   └── mcp-servers/       # MCP 서버 통합
├── widgets/               # 복합 UI 블록
└── __tests__/            # 테스트 코드
```

## 🚀 시작하기

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-username/videoprompt.git
cd videoprompt

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
```

### 2. 환경변수 설정

```bash
# Google AI 서비스
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
GOOGLE_IMAGEN_API_KEY=your_imagen_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Seedance (ModelArk)
SEEDANCE_API_KEY=your_seedance_api_key
SEEDANCE_MODEL=ep-your-model-id

# Google Veo3
VEO_PROVIDER=google
```

### 3. 개발 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 🚀 Vercel 자동 배포

### GitHub → Vercel 자동 배포

이 프로젝트는 **GitHub에 푸시할 때마다 자동으로 Vercel에 배포**됩니다!

#### **자동 배포 설정**:
- ✅ GitHub Actions 워크플로우 자동 실행
- ✅ Pull Request마다 Preview 배포
- ✅ main 브랜치 푸시 시 Production 배포
- ✅ 테스트 통과 후 자동 배포

#### **환경별 API 설정**:

이 프로젝트는 환경에 따라 자동으로 적절한 API 엔드포인트를 선택합니다:

- **개발환경 (localhost)**: 로컬 Next.js API Routes 사용
- **프로덕션 (Vercel)**: Railway 백엔드 API 사용

### Vercel 환경변수 설정

Vercel 대시보드에서 다음 환경변수를 설정하세요:

```bash
# API 설정 (선택사항)
NEXT_PUBLIC_API_BASE_URL=https://videoprompt-production.up.railway.app/api

# 사이트 URL
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# AI 서비스 API 키들
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
SEEDANCE_API_KEY=your_seedance_api_key
```

### 자동 환경 감지

환경변수를 설정하지 않아도 자동으로 감지됩니다:

```typescript
// src/lib/config/api.ts
export const getApiBase = (): string => {
  // 환경 변수로 설정 가능
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // 기본값: 개발환경은 로컬, 프로덕션은 Railway
  if (process.env.NODE_ENV === 'production') {
    return 'https://videoprompt-production.up.railway.app/api';
  }
  
  return '/api';
};
```

## 📖 사용 가이드

### AI 시나리오 생성

1. **메인 페이지**에서 "AI 시나리오 생성" 버튼 클릭
2. **1단계**: 스토리 기본 정보 입력 (제목, 설명, 장르, 타겟 등)
3. **2단계**: AI가 생성한 4단계 스토리 검토 및 수정
4. **3단계**: 12개 숏트로 분해하여 콘티 및 인서트샷 생성

### 기획안 관리

1. **메인 페이지**에서 "기획안 관리" 버튼 클릭
2. **기획안 목록**: 생성된 모든 기획안을 상태별로 관리
3. **영상 수집**: AI로 생성된 영상을 플레이어로 확인 및 다운로드
4. **편집 기능**: 제목, 설명, 상태 실시간 수정

### AI 영상 생성

1. **메인 페이지**에서 "AI 동영상 생성" 버튼 클릭
2. 프롬프트, 지속시간, 비율 설정
3. Seedance 또는 Google Veo3로 영상 생성
4. 생성된 영상 다운로드 및 관리

## 🔧 개발 가이드

### FSD 아키텍처 준수

- **단방향 의존성**: app → processes → widgets → features → entities → shared
- **Public API**: 외부 참조는 배럴 익스포트 경유
- **경계 분리**: 각 레이어의 책임 명확화

### TDD 개발 원칙

- **테스트 우선**: 실패 테스트 → 최소 구현 → 리팩터
- **결정론성**: 네트워크/시간/랜덤은 모킹 또는 타임아웃 도입
- **의존성 절단**: 외부 서비스는 인터페이스로 추상화

### API 설계 원칙

- **RESTful**: 표준 HTTP 메서드 및 상태 코드 사용
- **에러 처리**: 일관된 에러 응답 형식
- **폴백 메커니즘**: AI 서비스 실패 시 기본 템플릿 제공

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

**VideoPrompt** - AI로 만드는 전문적인 영상 콘텐츠
