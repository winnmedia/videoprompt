# 📚 MEMORY.md - 프로젝트 변경 이력

## 🗓️ 2025-09-01

### 🧹 포맷팅/접근성/순환 검사 도입 & E2E 스펙 정비 (v4.4.3)

- **요청/배경:** FSD/Tailwind 품질 규칙 준수 감사 결과에 따라 포맷팅·접근성·순환 의존·런타임 검증 및 E2E 스펙 안정화 필요.
- **주요 구현:**
  - **포맷팅:** Prettier + `prettier-plugin-tailwindcss` 도입. 스크립트(`format`, `format:check`) 추가 및 전 파일 정렬.
  - **패키지 매니저:** `package-lock.json` 제거, `engines.pnpm` 선언, npm 스크립트 호출을 pnpm으로 정비.
  - **접근성(A11y):** `@axe-core/playwright` 연동, a11y 스펙을 AxeBuilder로 전환. 워크플로우 대비/라벨 개선(`text-slate-800`, 아이콘 버튼 `aria-label`/`title`).
  - **순환 의존:** `madge` 도입 및 스크립트(`dep:check`) 추가. 현재 순환 의존성 0건.
  - **런타임 검증:** `src/shared/config/env.ts`에 Zod 스키마 추가, `app/layout.tsx`에서 부팅 시 검증(`assertEnvInitialized()`).
  - **UI 정합:** 헤더 네비에 `AI 영상 생성` 추가, 홈 히어로 헤딩을 테스트 기대 문구로 조정, 에디터 헤더를 `타임라인 에디터`로 정비.
  - **워크플로우 UX:** Step3 진입 시 필수 프롬프트 기본값 자동 채움(Generate 버튼 활성화 보장).
  - **E2E 스펙 보강:** 중복 셀렉터로 인한 strict mode 위반을 `.first()`로 정정, 액션바 버튼 스코프 명시.
- **영향/효과:**
  - a11y 전용 스펙 통과(홈/워크플로우). 주요 UX 스펙 중 `flow-01`, `editor-01`, `prompt-volume` 통과 확인.
  - 포맷/의존/런타임 검증 스크립트 추가로 CI 품질 게이트 강화 기반 마련.
- **리스크/후속:**
  - 일부 UX 스펙은 페이지/테스트 문구 추가 정렬 필요(홈 헤딩, 네비 레이블 변동 시).
  - 프롬프트 생성기 여정에서 파일 업로드 셀렉터 안정화 재검토 필요(숨김 input vs label 트리거, 테스트 셀렉터 정밀화).
  - CI에 `typecheck`/`format:check`/`dep:check`/a11y/E2E 단계 통합 및 `webServer` 포트 정리 훅 적용.

### 🧪 테스트 안정화 & 빌드 가드 적용 (v4.4.2)

- **요청/배경:** E2E 진행 중 반복 빌드/런타임 오류(타입 미스매치, prev 오용, 포트 충돌, 동적 의존성)로 인한 실패 발생 → 근본적 안정화 필요.
- **주요 구현:**
  - **타입/런타임 안정화:**
    - `src/features/prompt-generator/ElementBuilder.tsx`: 이미지 제거 시 업데이트 핸들러에 `undefined` 전달로 TS 오류 → 빈 문자열(`''`) 전달로 변경, 업데이트 시그니처는 `string`만 허용.
    - `src/app/prompt-generator/page.tsx`: `prev` 식별자 오용 제거. `finalPrompt.text`, `state.negative_prompts` 기준으로 전역 상태 저장.
    - `src/app/api/planning/prompt/route.ts`: Prisma JSON 타입 오류 해결(`negative`를 조건부 포함)로 빌드 안정화.
    - `src/app/api/planning/export/route.ts`: `pdfkit` 동적 require로 빌드 타임 의존성 해석 방지.
    - `src/app/api/comments/route.ts`: `NextResponse` 참조 누락 정리(표준 응답 유틸과 함께 명시 import).
  - **E2E 안정화:**
    - 페이지에 안정적인 셀렉터 추가: `workflow-title`, `workflow-story-input`, `feedback-comments-title`, `feedback-textarea` 등 `data-testid` 부여.
    - 테스트에서 testid 사용 및 `networkidle` 대기, 타임아웃 완화(최대 15s).
    - Playwright `webServer` 설정에 `pnpm prisma:generate && pnpm build && pnpm start` 적용 → Prisma 클라이언트 미생성/빌드 누락 방지.
  - **포트 충돌 회피:** 테스트 전 `pkill -f 'next start' || true; pkill -f 'next dev' || true` 권장 절차 정립.
- **영향/효과:**
  - 빌드 차단 이슈(Prisma JSON 타입, pdfkit, NextResponse import, prev 오용) 제거로 CI/로컬 실행 성공률 향상.
  - 셀렉터 안정화로 페이지 텍스트/구조 변경에도 테스트 견고성 확보.
- **리스크/후속:**
  - 일부 라우트(legacy)에서 `NextResponse.json` 직접 사용 → 추후 공통 응답 유틸로 일원화 필요.
  - Playwright `webServer` 사용 시 장기 실행 포트 충돌 가능성 → 테스트 전/후 포트 정리 절차 CI에 반영.
  - a11y 자동 점검을 axe-core로 확장(현재 스모크 수준) 및 리포터 통합 필요.
  - 테스트 리포트 아티팩트(스크린샷/비디오) 자동 업로드 파이프라인 구성.

### 🧰 공통 응답/로깅 표준화 & 공유/피드백 파이프라인 보강 (v4.4.1)

- **요청/배경:** 운영성/관측성 향상과 파이프라인 완결성 확보, FRD의 NFR(표준 응답·에러·관측성) 반영.
- **주요 구현:**
  - **공통 유틸:** `src/shared/lib/api-response.ts`(success/failure/getTraceId), `src/shared/lib/logger.ts`(JSON 구조 로그) 추가.
  - **API 적용:** `src/app/api/planning/prompt/route.ts`, `src/app/api/planning/videos/route.ts`, `src/app/api/planning/export/route.ts`, `src/app/api/comments/route.ts`, `src/app/api/shares/route.ts`에 응답 포맷/traceId/구조화 로깅 적용.
  - **워크플로우 공유:** `src/app/workflow/page.tsx` Step4에 “피드백 공유 링크 복사” 버튼 추가(영상 저장 후 `videoAssetId`/버전 id로 `POST /api/shares` 호출 → `/feedback?videoId=...&token=...` 자동 생성 및 클립보드 복사).
  - **피드백 보강:** `src/app/feedback/page.tsx` 댓글 목록 표시/5초 폴링, 토큰 상태 보존, 공유 모달(권한/만료/닉네임)에서 링크 발급.
  - **콘텐츠 관리:** `src/app/planning/page.tsx` 프롬프트 탭 DB 연동(`GET /api/planning/prompt` 사용).
  - **기획안 내보내기:** `POST /api/planning/export` JSON 기본, PDFKit 가능 시 PDF Data URL 반환(실패 시 JSON 폴백).
- **테스트/품질:**
  - Playwright 설정 `playwright.config.ts` 추가.
  - E2E 스모크 `tests/e2e/smoke.spec.ts`(홈/워크플로우/피드백 로드).
  - A11y 스모크 `tests/e2e/a11y.spec.ts`(랜드마크/주요 컨트롤 접근성).
- **영향/변경점:**
  - API 응답 스키마 통일(`ok`, `data` | `code/error`, `traceId`).
  - 로그 포맷 통일(JSON line)로 검색/집계 용이.
  - 파이프라인 완료 직후 공유→피드백 전환 동선 단축.
- **리스크/후속:**
  - 표준 응답/로깅의 모든 API 라우트로 확대 적용 필요(잔여 라우트 반영).
  - PDF 내보내기 템플릿(Marp/Puppeteer) 고도화 및 브랜딩 디자인 반영.
  - 코멘트 실시간 반영을 위한 SSE/WebSocket 전환 검토.
  - 로그 집계(Sentry/OTel/ELK) 연동 및 에러 샘플링/경보 구성.
  - 접근성 자동 점검(aXe) CI 통합, E2E 커버리지 확대.

### 🧩 프롬프트 생성기 기능 구현 및 UI 통합 (v4.4.0)

- **요청/배경:** FRD(1.1~4.2) 요구사항에 따라 프론트엔드 신규 스택(Tailwind) 기반 프롬프트 생성 워크플로우 구현 필요.
- **핵심 해결책:** 4단계 위저드형 생성기를 FSD 구조에 맞춰 신규 페이지(`/prompt-generator`)로 구현하고 공통 UI/유틸을 정비.
- **주요 구현:**
  - **페이지/레이아웃:** `src/app/prompt-generator/page.tsx` 통합, `src/app/layout.tsx` 네비게이션/푸터 개편, `src/app/page.tsx` 홈 히어로/CTA/워크플로우 섹션 추가.
  - **Feature 컴포넌트:**
    - `MetadataForm`(프로젝트 설정/스타일/카메라/종횡비)
    - `ElementBuilder`(등장인물/핵심 사물 + 이미지 업로드 UI)
    - `DynamicTimeline`(8초 분배 규칙 자동 타임스탬프, 세그먼트 관리)
    - `LLMAssistant`(AI 키워드/네거티브 추천 UI, 최종 JSON 미리보기/복사/다운로드)
  - **Shared/UI/Lib:** `shared/ui/Button.tsx`(CVA 변이), `shared/lib/utils.ts`(cn, id, format, debounce/throttle 등)
  - **타입/상수:** `src/types/video-prompt.ts`(FRD 명세 기반 타입, 선택지 상수 정의)
  - **Tailwind 토큰 확장:** `tailwind.config.js`에 브랜드 컬러/spacing/animation/font/shadow 토큰 추가 및 content 경로 확장.
- **아키텍처/품질:** FSD 레이어 준수(내부 파일 직접 import 금지, Public API 경유), React 19/Next 15, TypeScript Strict. 신규 코드 스타일은 Tailwind만 사용(임의 값 금지, 토큰화).
- **리스크/후속:**
  - 백엔드 연동(API): `POST /api/generate/suggestions`, `POST /api/upload/image` 실제 연동 필요(MSW 모킹/TDD 우선).
  - 패키지 매니저: CI/로컬 모두 PNPM 사용 표준화 필요(일시적으로 npm 스크립트 실행 흔적 존재 → 정비 예정).
  - 접근성/테스트: RTL + MSW 테스트 및 axe-core 자동 점검 케이스 추가 필요.

---

## 🗓️ 2025-08-28

### 🎬 영상 기획 기능 구현 및 워크플로우 UI 개선 (v4.3.1)

- **요청/배경:** 사용자 요청에 따라 영상 기획 기능 구현 및 워크플로우 단계별 UI 개선 필요.
- **핵심 해결책:**
  - **영상 기획 페이지 (`/planning/create`)**: 3단계 위저드 형태로 체계적 기획 기능 구현
  - **INSTRUCTION.md 기반 선택지 확장**: 프롬프트 생성 단계의 드롭다운 메뉴를 25개 이상으로 확장
  - **워크플로우 UI 개선**: 시나리오 생성 전/후 상태를 명확히 구분하여 사용자 혼란 방지
- **주요 구현 내용:**
  - **영상 기획 3단계 위저드**:
    - Step 1: 입력/선택 (제목, 로그라인, 톤앤매너, 장르, 타겟, 분량, 포맷, 템포)
    - Step 2: 전개 방식 (훅–몰입–반전–떡밥, 기승전결, 귀납, 연역, 다큐(인터뷰식), 픽사)
    - Step 3: 기획 완성 (AI 기획안 생성 및 확인)
  - **빠른 프리셋 4개**: 브랜드 30초, 다큐 90초, 드라마 60초, 액션 45초
  - **AI 기획안 생성 API**: Google Gemini 연동으로 체계적 기획안 자동 생성
  - **INSTRUCTION.md 완벽 반영**: Base Style, Spatial Context, Camera Setting, Core Object, Timeline 모든 카테고리 포함
- **UI/UX 개선 사항:**
  - **워크플로우 단계별 상태 관리**: 시나리오 생성 전/후 명확한 구분
  - **프롬프트 생성 버튼 조건부 표시**: 시나리오 생성 완료 후에만 활성화
  - **시각적 안내 시스템**: 색상별 섹션 구분, 아이콘 활용, 진행 상태 표시
  - **사용자 혼란 방지**: 올바른 워크플로우 순서 강제 및 단계별 안내 메시지
- **기술적 개선:**
  - **WorkflowData 인터페이스 확장**: 15개 프롬프트 속성으로 확장
  - **선택지 상수 체계화**: 25개 이상의 전문적 영상 제작 옵션
  - **안전한 배열 접근**: 조건부 렌더링으로 TypeError 방지
  - **TypeScript 타입 안정성**: 모든 프롬프트 속성에 대한 타입 정의
- **사용자 경험 향상:**
  - **체계적 기획 프로세스**: 한 줄 스토리 → 4단계 시나리오 → 전문적 프롬프트 → 영상 생성
  - **전문적 선택지**: 실제 영화 제작에서 사용되는 모든 옵션 제공
  - **직관적 진행**: 단계별 진행률, 색상 구분, 아이콘 활용
  - **빠른 시작**: 4가지 프리셋으로 즉시 설정 가능
- **리스크/영향:**
  - **복잡성 증가**: 25개 이상의 선택지로 인한 초기 학습 곡선 발생 가능
  - **단계별 진행 강제**: 사용자가 원하는 순서로 자유롭게 진행할 수 없음
  - **UI 복잡성**: 프롬프트 설정 단계의 UI가 다소 복잡해짐

### 🚀 프론트엔드 기술 스택 현대화 결정 (v4.3.0)

- **요청/배경:** 성능 향상, 개발자 경험(DX) 개선 및 최신 생태계 활용을 위한 프론트엔드 스택 업그레이드 필요.
- **핵심 해결책:**
  - 신규 표준 스택으로 Next.js 15.5, React 19, TypeScript 5.7, Redux Toolkit 2.0 도입.
  - 스타일링 아키텍처를 기존 Sass에서 Tailwind CSS v4로 전면 교체 결정.
  - 점진적 마이그레이션을 위한 스트랭글러 패턴 채택.
- **주요 결정:**
  - 모든 신규 코드는 Tailwind CSS 사용 의무화. Styled Components 사용 중단.
  - Tailwind 사용 시 임의 값(Arbitrary Values) 금지 및 디자인 토큰 중앙 관리 원칙 수립.
  - 레거시 스택(React 18, Sass, Antd)은 유지보수 모드로 전환하며 점진적으로 제거.
- **리스크/영향:** 마이그레이션 기간 동안 두 가지 스타일링 방식 공존으로 인한 복잡성 증가. 팀원의 Tailwind CSS 학습 곡선 발생.

## 🗓️ 2025-08-25

### 🚀 배포 가이드 생성 및 배포 방식 표준화

- **파일**: `DEPLOYMENT_GUIDE.md` 생성
- **내용**:
  - Vercel + Railway 아키텍처 설명
  - GitHub 연동 자동 배포 프로세스
  - 배포 명령어 및 모니터링 방법
  - 문제 해결 가이드
  - 배포 체크리스트
- **목적**: 개발팀의 배포 프로세스 표준화 및 문서화

### 🔧 Railway 백엔드 연결 안정성 대폭 개선

- **타임아웃 설정**: 40초 → 120초 (Railway 백엔드 처리 시간 고려)
- **재시도 메커니즘**: 3회 재시도, 2초 간격
- **에러 메시지**: 사용자 친화적 메시지로 개선
- **API 클라이언트**: 안정성 강화
- **커밋**: `3cd6eb5` - Railway 백엔드 연결 안정성 대폭 개선

### 📁 파일 저장 시스템 구현 완료

- **파일 저장 유틸리티**: `src/lib/utils/file-storage.ts`
- **API 자동 저장**: Seedance, Imagen, Veo API에 통합
- **테스트 스크립트**: `test-file-storage.sh`, `test-seedance-api.sh`
- **커밋**: `900214a` - 파일 저장 시스템 구현 및 API 자동 저장 기능 추가

### 🏗️ FSD 아키텍처 리팩토링 완료

- **API 설정**: `src/lib/config/api.ts` 중앙화
- **API 클라이언트**: `src/lib/api-client.ts` 단순화
- **프로바이더**: `src/lib/providers/seedance.ts` 최적화
- **Mock 모드**: 완전 제거 (배포 환경 전용)

### 🚀 Vercel 배포 성공

- **배포 URL**: `https://videoprompt-5o4g2er0n-vlanets-projects.vercel.app`
- **상태**: Ready (성공)
- **빌드 시간**: 57초
- **환경**: Production

## 🗓️ 2025-08-24

### 🔧 API 설정 호환성 문제 해결

- **문제**: `getApiUrl`, `API_ENDPOINTS` 누락으로 빌드 실패
- **해결**: 기존 코드와의 호환성 유지
- **커밋**: `7bc6ff2` - API 설정 호환성 문제 해결

### 📚 SEEDANCE_SETUP.md 업데이트

- **내용**: Mock 모드 제거, Railway 백엔드 직접 연결
- **파일 저장 시스템**: 설정 및 사용법 추가
- **환경변수**: Vercel, Railway, Docker 환경별 설정

## 🗓️ 2025-08-23

### 🎯 사용자 요구사항 변경

- **이전**: Mock 모드 및 로컬 개발 환경
- **현재**: 배포 환경 전용, Railway 백엔드 직접 연결
- **파일 저장**: API 응답 시 자동 저장 기능

### 🔄 API 라우트 리팩토링

- **Seedance API**: `/api/seedance/create`, `/api/seedance/status/[id]`
- **Imagen API**: `/api/imagen/preview`
- **Veo API**: `/api/veo/create`
- **파일 저장 API**: `/api/files/save`

## 🗓️ 2025-08-22

### 🚀 MCP 서버 통합 완료

- **Sequential Thinking MCP**: 문제 해결 프레임워크
- **Context7 MCP**: 컨텍스트 관리
- **통합**: 개발 워크플로우에 MCP 활용

### 📊 프로젝트 구조 정리

- **FSD 아키텍처**: Feature-Sliced Design 적용
- **컴포넌트**: 재사용 가능한 UI 블록
- **테스트**: TDD 방식 테스트 코드

## 🗓️ 2025-08-21

### 🔑 Seedance API 통합

- **API 키**: BytePlus ModelArk v3
- **기능**: 영상 생성 및 상태 확인
- **설정**: 환경변수 기반 설정

### 🌐 Railway 백엔드 설정

- **도메인**: `videoprompt-production.up.railway.app`
- **역할**: 외부 API 프록시
- **환경**: 프로덕션 전용

---

**참고**: 이 문서는 프로젝트의 주요 변경사항과 결정사항을 기록합니다. 삭제하거나 수정하지 마시고, 새로운 내용은 추가만 해주세요.
