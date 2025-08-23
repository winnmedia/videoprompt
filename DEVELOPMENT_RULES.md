DEVELOPMENT_RULES.md — VideoPlanet 최종 통합 개발지침 (v2.4.0)

본 문서는 프로젝트의 일정 예측성·품질·협업 효율을 높이기 위한 통합 지침입니다.

문서 지도 (Document Map)
본 문서 (DEVELOPMENT_RULES.md): TDD, Git, CI, 품질 등 모든 개발 프로세스의 최상위 원칙.

아키텍처/의존 규칙 (ARCHITECTURE_FSD.md): 폴더 구조, 의존성 경계, 데이터 흐름 등 코드의 설계에 대한 규칙.

의사결정 기록 (MEMORY.md): 주요 기술적 결정의 배경과 결과를 기록하는 불변의 로그.

0) 적용 범위 (기술 스택)
Frontend: Next.js 14(App Router), React 18, TypeScript

State: Redux Toolkit, Redux Persist(민감정보 제외)

Styling: SCSS Modules, Styled Components, Ant Design(래핑 권장)

스타일링 제1원칙은 SCSS Modules를 사용합니다. 컴포넌트 내부에서 동적 스타일링이 반드시 필요한 경우에 한해 Styled Components 사용을 허용하며, 이 경우 PR에 사유를 명시해야 합니다.

API/실시간: Axios, WebSocket

Testing: Jest, React Testing Library, Cypress(E2E)

Build: Webpack 5, SWC Compiler

Deployment: Vercel(Frontend), Railway(Backend)

CI 게이트(필수): tsc --noEmit, ESLint, Jest, Cypress 스모크, SAST

Ⅰ. 최상위 원칙 (Lifecycle)
Plan → Do → See 순환을 모든 작업에 적용합니다.

분석은 MECE로 수행합니다(중복/누락 금지).

통합 개발 원칙: 중복 파일 생성 금지, 기존 자산 재사용 우선.

MEMORY.md: 작업 전 전체 스캔, 작업 후 추가 기록만(내용 수정/삭제 금지, 오타/포맷 정리는 허용).

(이유: 모든 의사결정 과정을 투명하게 추적하고, 역사적 사실의 왜곡을 방지하기 위함)

문서 우선순위: CLAUDE.md > Architecture_fsd.md > Frontend_TDD.md = DEVELOPMENT_RULES.md

Ⅱ. 작업 흐름
(Alpha) 착수 — 컨텍스트 로드: 목표·수용 기준·리스크를 정리하고 Definition of Ready(DoR) 확정. 관련 결정 사항은 MEMORY.md 근거 링크로 연결합니다.

실행 — 병렬 진행: TDD 선행 개발을 기본으로 하며(아래 Ⅲ), 아키텍처 경계는 FSD 규칙을 준수합니다.

(Omega) 종료 — 컨텍스트 기록: 커밋 직전, [날짜/요청/핵심 해결책/주요 결정/리스크] 형식으로 MEMORY.md에 추가합니다. 체크리스트 통과 후 단일 논리 단위로 커밋합니다.

Ⅲ. TDD(테스트 주도 개발) 정책
원칙: Red → Green → Refactor, 결정론성, 의존성 절단.

테스트 전략 차별화:

코어 로직/비즈니스 규칙: 항상 TDD (테스트 먼저 작성)

UI 컴포넌트: 상태(state)나 조건부 렌더링이 없는 순수 Presentational 컴포넌트는 구현 후 테스트를 허용합니다. 그 외 모든 컴포넌트는 TDD를 원칙으로 합니다.

선행 개발 루틴:

DoR 확정(수용 기준 3~5개) + View-Model 스키마 합의

실패하는 테스트 선작성(접근성 쿼리 우선, data-test-id 보조)

최소 구현으로 Green(스타일/복잡 마크업 보류)

Refactor(의도 드러내기, a11y/성능 개선)

마크업 반영 시 테스트 선택자 유지

API 모킹으로 기능 100% 구현 후, 연결은 API Layer 단일 변환

회고·기록(플래키 원인·대기시간 감소 등)

의존성 제거:

디자인/마크업과 분리: 테스트는 의미 기반 쿼리 중심

API와 분리: View-Model 우선, DTO→VM 변환은 API Layer에서만

시간/랜덤/WS는 고정·시뮬레이션으로 결정론화

Ⅳ. 테스트 전략(피라미드)
단위(Unit): 도메인 규칙/정규화/셀렉터/유틸(최다)

컴포넌트(Component): 행동 중심 검증(가시성/상호작용/상태 전파, a11y)

통합(Integration): 라우팅·상태/캐시 상호작용(모킹 기반)

E2E(스모크): 핵심 경로 최소화(로그인→핵심 기능→로그아웃)

규칙: 스냅샷 남용 금지, 테스트 1건=1의도, Public API만 import

커버리지 목표: 전체 70%+, 핵심 도메인 85%+

플래키 제로: 간헐 실패 즉시 기록·격리, 해결 전 병합 금지

Ⅴ. 품질 게이트 & CI
필수 통과: 타입체크, ESLint(아키텍처 경계 포함), Jest, Cypress 스모크

써큘러 0: 순환 의존 검출을 CI에서 상시 체크

성능 가드: Web Vitals 수집, LCP/CLS/INP 회귀 방지 체크

접근성 스모크: 역할/라벨/대비 최소 기준 검증

SAST(정적 분석 보안 테스트) 적용: SonarQube, Snyk 등을 CI에 통합하여 잠재적 보안 취약점을 자동으로 검출합니다.

Ⅵ. Git/PR 규칙
브랜치: feat/*, fix/*, refactor/*, chore/*, docs/*

커밋 메시지: Conventional Commits, “왜”를 포함

PR 단위: PR은 '리뷰어가 이해할 수 있는 하나의 논리적 변경 단위'를 기준으로 하며, 300라인은 이를 위한 권장 사항입니다. 라인 수가 적더라도 여러 논리가 섞여있다면 분리해야 합니다.

PR 체크리스트:

FSD 레이어/의존 규칙 위반 없음(내부 파일 직접 import 금지)

TDD 루틴 준수(실패 테스트 선작성→Green→Refactor)

API 모킹→API Layer 단일 변환 연결

테스트 결정론성·플래키 0

성능/접근성 회귀 없음

문서/ADR/MEMORY.md 갱신

Ⅶ. 보안·컴플라이언스
비밀정보는 코드/로그에 금지(.env/프로바이더 시크릿 사용)

쿠키: httpOnly, secure, sameSite 설정

입력 검증: 서버단 스키마 검증(CSRF/XSS/CSP 고려)

로깅: PII 마스킹, 구조화(JSON), 레벨 기준 수립

CORS: 허용 도메인 화이트리스트, 프리플라이트 캐시 설정

Ⅷ. 안정성 강화 방안
즉시 적용 가능

에러 바운더리: 전역/레이어별 에러 격리 및 폴백 UI

환경 변수 검증: 런타임 스키마 검증, 필수값 체크

API 에러 처리: 재시도 로직, exponential backoff

아키텍처 개선

의존성 경계 자동화: ESLint 규칙으로 레이어 위반 차단

상태 관리 미들웨어: 로깅, 불변성 체크, 에러 복구

테스트 유틸 통합: 일관된 Provider 래핑, 모킹 표준화

개발 워크플로우

Pre-commit 훅: 타입/린트/테스트/순환 의존성 체크

자동 코드 리뷰: 경계 위반, 커버리지, 성능 지표 검증

개발 환경 표준화: VSCode 설정, 포맷터, 경로 매핑

Ⅸ. 성능 최적화
초기 로딩 3초 이내, 상호작용 100ms 이내 목표

코드 스플리팅(dyanmic import), 이미지 최적화(next/image)

메모이제이션은 병목에 한정(남용 금지)

번들 분석·중복 의존 제거, 폰트/아이콘 서브셋

Ⅹ. 스타일·디자인 토큰
디자인 토큰 우선: 색상/간격/폰트/그림자/브레이크포인트는 토큰으로만 사용

컴포넌트 기반 스타일: 페이지 전역 스타일 금지, CSS 모듈 권장

!important 금지, 특정성·구조로 해결

AntD는 래핑 컴포넌트로 테마/토큰 일관성 유지

z-index 관리 규칙: 모든 z-index는 shared/styles/zIndex.scss 파일에 정의된 토큰만을 사용해야 하며, 임의의 숫자 값 직접 사용을 금지합니다. (린트 규칙 추가)

Ⅺ. 배포·버전 관리
Vercel Preview → 승인 → Production(버전 태그 필수)

Railway 배포: 마이그레이션→헬스체크 통과 후 프런트 승격

배포 체크리스트: 환경변수 검증, 마이그레이션 여부, 스모크 통과, 롤백 플랜

Ⅻ. AI 에이전트 활용 지침
테스트가 명세: 실패 테스트부터 제공(수용 기준 포함)

작게·자주: 변경 파일≤5, 라인≤300, 새 의존성 금지 기본

태스크 카드: Context(경로/VM/에러모델)·Acceptance·Constraints·Artifacts 명시

품질 게이트: 빌드/타입/린트/커버리지/경계 위반 0/플래키 0

보안: 비밀값/개인정보/내부 URL은 프롬프트 금지(.env.example로 치환)

AI 생성 코드 검증 의무: AI가 생성한 모든 코드는 동료 개발자가 작성한 코드와 동일한 기준(TDD, 보안, 성능, 아키텍처 규칙)으로 리뷰 및 검증되어야 합니다. AI의 결과물을 맹신하지 않습니다.

ⅩⅢ. 문서화·변경 관리
아키텍처 변경은 ADR 필수 → 리뷰 → 반영

ARCHITECTURE_FSD.md와 본 문서의 링크/역할 분리 유지

CODEOWNERS로 문서 책임자 지정

ⅩⅣ. 실패·롤백
실패 3회 룰: 원인 분류(요구 불명/환경/제약/플래키) 및 대안 2가지 제시

부분 롤백: 새 테스트 유지, 구현만 되돌림(회귀 방지)

모든 조치 사항은 MEMORY.md에 기록

연계 문서
아키텍처/의존 규칙: ARCHITECTURE_FSD.md

TDD 상세 운영: 본 문서 Ⅲ·Ⅳ 절

스타일 가이드: styles/design-tokens.scss(토큰), 팀 UI 가이드

버전: 2.4.0
최종 업데이트: 2025-08-23