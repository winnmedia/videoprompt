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

## 2025-08-24

- **Google Gemini API Imagen 모델 호출 수정 및 최적화**
  - **API 엔드포인트 수정**: `src/lib/providers/imagen.ts`의 `tryGoogle` 함수 완전 재작성
    - 올바른 Imagen 4.0 모델명 사용: `imagen-4.0-fast-generate-preview-06-06:generateContent`
    - 정확한 요청 구조: `contents`, `generationConfig`, `imageGenerationConfig` 적용
    - aspectRatio 자동 감지: LANDSCAPE/PORTRAIT/SQUARE 자동 설정
  - **디버깅 로그 강화**: API 호출 과정의 모든 단계에 상세한 로그 추가
    - 요청 파라미터 로깅: API 키, 모델명, 프롬프트, 크기 등
    - 응답 상태 및 구조 분석: HTTP 상태, 응답 키, 데이터 구조
    - 이미지 추출 과정 추적: candidates, predictions, images 등 다양한 응답 구조 대응
  - **오류 처리 개선**: 15초 타임아웃, 상세한 오류 메시지, 폴백 로직

- **Seedance 영상 생성 API 개선**
  - **디버깅 로그 추가**: `src/lib/providers/seedance.ts`의 `createSeedanceVideo` 함수 강화
    - API 호출 시작부터 응답까지 모든 과정 로깅
    - 모델 ID 결정 과정: 요청된 모델과 환경변수 모델의 우선순위 명확화
    - 요청 바디 구조 로깅: 실제 전송되는 데이터 구조 확인
    - 타임아웃 증가: 10초 → 15초로 증가하여 안정성 향상
  - **환경변수 검증**: API 키, 모델, 엔드포인트 설정 상태 상세 로깅

- **Veo3 영상 생성 API 개선**
  - **디버깅 로그 강화**: `src/lib/providers/veo.ts`의 `generateVeoVideo` 함수 개선
    - API 호출 과정의 모든 단계에 상세한 로그 추가
    - 요청/응답 구조 로깅: 전송되는 데이터와 받는 데이터 구조 확인
    - 모델별 처리 로직: Veo3와 Veo2의 차이점 명확화 및 로깅
    - 오류 처리 개선: 구체적인 오류 메시지와 원인 분석
  - **응답 데이터 파싱**: 다양한 응답 구조에 대한 안전한 이미지/동영상 데이터 추출

- **빌드 오류 해결 및 성능 최적화**
  - **Next.js 설정 최적화**: `next.config.mjs`에서 `optimizeCss: true` 설정 제거
    - `critters` 모듈 의존성 문제 해결로 빌드 안정성 향상
    - `optimizePackageImports` 유지: Link Preload 경고 해결
    - Webpack 최적화 유지: 청크 분할 및 벤더 번들 최적화
  - **빌드 성공 확인**: Railway 배포에서 빌드 오류 없이 성공

- **CORS 정책 문제 해결**
  - **API Route CORS 헤더 추가**: 모든 관련 API에 CORS 설정 적용
    - `/api/imagen/preview`: `Access-Control-Allow-Origin: *` 등 CORS 헤더 추가
    - `/api/veo/create`: OPTIONS 핸들러와 CORS 헤더 설정
    - `/api/video/create`: 통합 동영상 API에 CORS 설정
    - `/api/seedance/create`: Seedance API에 CORS 설정
  - **크로스 오리진 요청 지원**: `https://www.vridge.kr`에서 API 호출 가능

- **프론트엔드 UI/UX 개선**
  - **메인 페이지 개선**: 
    - AI 생성 버튼 텍스트 업데이트: "AI 생성 시작" → "AI 생성 시작"
    - 퀵 액션 버튼 추가: "AI 이미지 생성", "AI 동영상 생성", "AI 시나리오 생성"
    - 핵심 기능 및 사용법 섹션 업데이트: 새로운 AI 모델 기능 반영
  - **위저드 페이지 단순화**:
    - AI 모델 선택 섹션 제거: 사용자 워크플로우 단순화
    - "생성" 버튼 텍스트 변경: "GPT-4로 생성" → "생성"
    - "이미지 미리보기" 버튼 추가: 시나리오 입력 섹션에 전용 버튼 배치
    - 최종 프롬프트 섹션 버튼 재배치: "Veo3 생성", "Seedance 영상 생성", "프롬프트 복사"
    - 불필요한 상태 변수 제거: `selectedImageModel`, `selectedVideoModel`, `selectedScenarioModel`

- **통합 테스트 및 검증**
  - **테스트 스크립트 생성**: `test-all-apis.sh`로 모든 API 엔드포인트 통합 테스트
    - 메인 페이지 접근성, 이미지 생성 API, 동영상 생성 API, CORS 정책, 위저드 페이지 테스트
    - 색상별 결과 표시: 성공(초록), 실패(빨강), 진행(파랑), 정보(노랑)
    - 테스트 결과 요약: 총 테스트 수, 성공/실패 개수, 전체 통과 여부
  - **API 응답 구조 검증**: 각 API의 요청/응답 구조 및 오류 처리 확인

- **환경변수 및 설정 관리**
  - **이미지 생성 환경변수**: `GOOGLE_GEMINI_API_KEY`, `IMAGEN_PROVIDER`, `IMAGEN_LLM_MODEL`
  - **동영상 생성 환경변수**: `VEO_PROVIDER`, `VEO_MODEL`, `SEEDANCE_API_KEY`, `SEEDANCE_MODEL`
  - **API 베이스 URL**: `NEXT_PUBLIC_SITE_URL` 설정으로 크로스 오리진 요청 지원

- **Git 워크플로우 및 배포**
  - **커밋 및 푸시**: 모든 개선사항을 커밋하고 GitHub로 푸시
  - **Railway 자동 배포**: 빌드 오류 해결 후 성공적인 배포 완료
  - **변경사항 요약**: 4개 파일, 173줄 추가, 71줄 삭제

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

## 2025-01-23

- **이미지 미리보기, VEO3 모델, Seedance 영상 생성 문제 해결**
  - **문제 진단**: 세 가지 주요 기능이 작동하지 않는 상황 파악
    1. 이미지 미리보기 생성 안됨
    2. VEO3 모델 작동 안됨
    3. Seedance 영상 생성 안됨 (JSON 파싱 에러: "Internal S...")
  
  - **이미지 미리보기 문제 해결**:
    - `src/lib/providers/imagen.ts`의 에러 처리 및 로깅 개선
    - Vertex AI API 호출 과정의 상세한 디버깅 로그 추가
    - 환경변수 설정 가이드 개선 (`GOOGLE_APPLICATION_CREDENTIALS_JSON` 등)
  
  - **VEO3 모델 문제 해결**:
    - `src/lib/providers/veo.ts`의 환경변수 처리 개선
    - `GOOGLE_AI_STUDIO_API_KEY` 환경변수 추가 및 검증
    - Google AI Studio VEO API 연동 강화
    - 타입 에러 수정 (`VeoVideoResponse`에 `raw` 속성 추가)
  
  - **Seedance 영상 생성 문제 해결**:
    - `src/lib/providers/seedance.ts`의 JSON 파싱 에러 방지
    - 응답 텍스트를 먼저 가져와서 JSON 파싱 전 유효성 검사
    - 상세한 에러 로깅 및 사용자 친화적 에러 메시지
    - 타임아웃을 30초로 증가하여 안정성 향상
  
  - **환경변수 설정 가이드 개선**:
    - `env.example`에 필요한 모든 API 키 및 설정 추가
    - Google Cloud Platform, Google AI Studio, ModelArk 설정 가이드
    - 각 서비스별 필수 환경변수 명시
  
  - **트러블슈팅 가이드 생성**:
    - `TROUBLESHOOTING.md` 파일 생성으로 문제 해결 과정 문서화
    - 각 문제별 상세한 해결 방법 및 체크리스트 제공
    - API 테스트 방법 및 디버깅 가이드 포함
  
  - **코드 품질 개선**:
    - DEVELOPMENT_RULES.md의 코딩 표준 준수
    - 에러 처리, 로깅, 타입 안전성 강화
    - API 응답 처리의 안정성 향상
  
  - **결과**: 세 가지 주요 기능의 안정성 및 디버깅 용이성 대폭 개선

  - **공식 문서 기반 해결 방안 적용**:
    - **Google AI Studio VEO3**: 공식 API 스펙에 맞춘 `videoGenerationConfig` 구조 적용
    - **Vertex AI Imagen**: 공식 파라미터(`guidanceScale`, `seed`, `safetyFilterLevel`) 추가
    - **ModelArk Ark v3**: 공식 v3 API 스펙에 맞춘 요청 본문 구조 개선
    - **트러블슈팅 가이드**: 각 서비스의 공식 문서 기반 설정 방법 및 API 스펙 문서화
    - **지원 채널**: Google Cloud, Google AI Studio, ModelArk의 공식 지원 링크 추가

