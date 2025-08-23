# MEMORY

## 2025-08-20

- Seedance(ModelArk) 연동
  - Provider(`src/lib/providers/seedance.ts`)를 BytePlus ModelArk 비디오 생성 API 스펙에 맞게 구현
    - 생성: POST /modelark/video_generation/tasks (model, input.prompt, parameters)
    - 상태: GET /modelark/video_generation/tasks/{id} (data.status/progress/result.video_url 파싱)
    - 키: `SEEDANCE_API_KEY` 또는 `MODELARK_API_KEY` 지원, 베이스: `MODELARK_API_BASE` 선택
  - 위저드(`src/app/wizard/page.tsx`)
    - “SEEDANCE로 생성” 시 최종 프롬프트(veo3Preview) 우선 사용, 영문화 후 전송
    - 단일/영화팩 모두 상태 폴링 및 플레이어 표시 (지수 백오프)
    - 모델 기본값: `seedance-1.0-pro`

- 빌드/배포 안정화
  - /wizard: `useSearchParams` 제거 → CSR 파라미터 파싱, 빌드 에러 해결
  - API Route 핸들러: Next.js 타입 제약에 맞게 시그니처 정리

 - 환경변수
   - Railway에 `SEEDANCE_API_KEY` 등록 완료 (사용자 보고)
   - 선택: `MODELARK_API_KEY`, `MODELARK_API_BASE`, `NEXT_PUBLIC_SITE_URL`



## 2025-08-21

- FSD 경계 강화 및 리팩터 시작
  - ESLint: `no-restricted-imports`로 상향 의존/내부 경로 import 차단 규칙 추가 (`eslint.config.mjs`)
  - 프리셋 import 경로 정리: `src/lib/presets/{themes,cameras}.ts` → `@/lib/schema` 사용
  - Seedance 상태 폴링 로직 FSD 분리: `useSeedancePolling` 훅 추가 (`src/features/seedance/status/useSeedancePolling.ts`)
  - 에디터에서 훅 사용하도록 교체: `src/app/editor/[id]/EditorClient.tsx`
  - 품질 게이트: 로컬에서 린트/타입체크 통과 확인 (유닛 테스트 실행 시 오류 없음 보고)

- 위저드 FSD 분리(1차)
  - Seedance 폴링 훅 적용: `src/app/wizard/page.tsx`에서 로컬 폴링 제거, `features/seedance/status` 사용
  - Seedance 생성 훅 도입: `useSeedanceCreate`(`features/seedance/create`)로 생성 호출 캡슐화
  - 진행 패널 위젯화: `widgets/seedance/SeedanceProgressPanel` 추가, 위저드에서 위젯 사용

- Seedance(ModelArk) v3 정합성 개선 및 프로덕션 검증
  - 리전/엔드포인트 확정: Johor(`ap-southeast`) → `https://ark.ap-southeast.bytepluses.com`
  - 환경변수 표준화: `SEEDANCE_API_BASE`, `SEEDANCE_API_KEY`, `SEEDANCE_MODEL(ep-...)`
  - Provider 수정(`src/lib/providers/seedance.ts`)
    - 생성 API를 Ark v3 스키마에 맞춤: `POST /api/v3/contents/generations/tasks`
    - 요청 바디: `model`, `content[]`(text[, image_url]), `parameters.duration|aspect_ratio|seed`
    - 상태 API: `GET /api/v3/contents/generations/tasks/{id}` 파싱 경로 확장(`data.result.output[0].url` 등)
    - 키 헤더 병행 전송: `Authorization: Bearer <KEY>` + `X-Api-Key: <KEY>`
    - DNS IPv4 우선, fetch 타임아웃(10s), 에러 메시지 개선
  - Diagnose 라우트(`src/app/api/seedance/diagnose/route.ts`)
    - Ark v3 엔드포인트/스키마로 수정, `hasKey/hasModel` 노출
  - 위저드/스크립트에서 하드코딩 모델 제거(`seedance-1.0-pro` → env)
  - 프로덕션 원격 스모크 결과(Railway):
    - `/api/health` 200 OK
    - `/api/seedance/diagnose` 200 OK (`hasKey=true`, `hasModel=true`)
    - `/api/imagen/preview` 200 OK(이미지 반환)
    - `/api/seedance/create` 200 OK(`jobId=cgt-20250821162311-7r559`)
    - `status/status-debug`는 200 JSON 보장(폴링로직 정상)

- 기타
  - Supabase 코드/테스트 제거 완료
  - 린트 통과 확인(변경 파일 기준)

## 2025-08-22

- **사용자 여정 완벽 구현**: 시나리오 입력 → LLM 개발 → 최종 프롬프트 → 이미지/영상 생성
  - **LLM 프롬프트 변환 강화**: `transformPromptForTarget()` 함수로 이미지/비디오용 최적화
    - 이미지용: 정적 구도, 명확한 주체, 프레이밍, 조명, 색상 등에 최적화
    - 비디오용: 동적 움직임, 카메라 모션, 시간적 흐름, 시각적 연속성에 최적화
  - **위저드 페이지 통합**: 
    - 이미지 미리보기: `handleImagenPreview()`에서 LLM 변환 후 Google Imagen API 호출
    - Seedance 영상 생성: `handleSeedanceCreate()`에서 LLM 변환 후 Ark v3 API 호출
    - 영화팩 모드: 4씬 각각에 대해 개별 LLM 변환 적용
  - **상태 UI 개선**: 성공/에러/정보 메시지를 아이콘과 함께 표시
  - **에러 처리 강화**: LLM 변환 실패 시 원본 프롬프트로 폴백, 상세한 사용자 피드백
- **FSD/TDD 방식 적용**:
  - 테스트 우선: `wizard-user-journey.test.ts`로 LLM 변환 기능 검증
  - 최소 구현: `transformPromptForTarget()`, `rewritePromptForSeedance()` 함수 추가
  - 리팩터링: 기존 코드와 통합하여 일관성 유지
- **통합 검증**: `test-integration.sh`로 프로덕션 환경에서 이미지/영상 생성 확인
  - 이미지 미리보기: ✅ 성공
  - Seedance 영상 생성: ✅ 작업 ID 생성 성공

## 2025-08-23

- **시나리오 개발 시스템 구현**: 사용자 한 줄 입력 → LLM 개발 → 이미지/영상 생성 워크플로우
  - **새로운 컴포넌트 생성**:
    - `ScenarioDeveloper`: 시나리오 입력 및 LLM 개발 처리
    - `ScenarioWorkflow`: 전체 워크플로우 관리 (개발 → 이미지 → 영상)
    - `/api/scenario/develop`: LLM을 통한 시나리오 개발 및 프롬프트 변환 API
  - **위저드 페이지 통합**: 
    - 모드 선택 탭 추가 (고급 위저드 모드 ↔ 시나리오 개발 모드)
    - 시나리오 개발 모드에서 단계별 진행 상황 표시
    - 기존 기능과의 호환성 유지
  - **AI 클라이언트 확장**:
    - `AIServiceManager`에 `rewritePromptForImage`, `rewritePromptForSeedance` 메서드 추가
    - Mock 모드 지원으로 개발/테스트 환경에서도 동작
  - **아키텍처 개선**:
    - 클라이언트/서버 코드 분리로 번들 크기 최적화
    - API Route를 통한 안전한 외부 API 호출
    - 에러 처리 및 사용자 피드백 강화
  - **UI/UX 개선**:
    - 단계별 진행 상황 시각화
    - 에러 상태 및 성공 상태 명확한 표시
    - 반응형 디자인으로 모바일/데스크톱 지원
  - **문제 해결**:
    - `net::ERR_EMPTY_RESPONSE` 오류 해결 (클라이언트에서 서버 모듈 import 방지)
    - `Failed to fetch` 오류 해결 (API Route를 통한 안전한 호출)
    - 모듈 의존성 문제 해결 (`dns`, `google-auth-library` 서버 전용으로 제한)
  - **워크플로우**:
    1. 시나리오 입력 (한 줄)
    2. LLM 개발 (상세 프롬프트 생성)
    3. 프롬프트 변환 (이미지용/영상용)
    4. 이미지 미리보기 생성
    5. 영상 생성 및 상태 추적

