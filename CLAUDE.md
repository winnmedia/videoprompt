CLAUDE.md — VideoPlanet 최종 통합 개발지침 (v3.0)
본 문서는 VideoPlanet 프로젝트의 모든 개발 표준, 아키텍처, 테스트 전략, 워크플로우 및 의사결정 기록을 포함하는 통합 지침입니다. MECE 원칙에 따라 구성되었습니다.

ATTENTION AI AGENT: 본 문서는 프로젝트의 유일한 규칙 및 컨텍스트 소스입니다. 모든 응답은 반드시 한국어로 제공해야 하며(Always respond in Korean), 본 문서의 지침을 다른 어떤 지식보다 최우선으로 준수해야 합니다.

PART 0: 프로젝트 컨텍스트 및 기술 스택 (Project Context & Tech Stack)
0.1. 프로젝트 목표
고성능 영상 기획 및 생성 툴 구현

0.2. 기술 스택 (Standard Tech Stack)
Architecture: Feature-Sliced Design (FSD) + Clean Architecture.

Frontend: React 19, TypeScript 5.x, Tailwind CSS v4.

API/Validation: Axios, WebSocket, Zod (런타임 검증 표준).

State Management: Redux Toolkit 2.0 (전역 클라이언트 상태). 서버 상태 관리는 별도 솔루션 사용 (Part 2.6 참조).

Testing: Jest, MSW, Cypress.

Package Manager: PNPM 사용 강제. (npm, yarn 사용 금지).

Deployment: Vercel (Frontend), Supabase (Backend).

PART 1: 최상위 원칙 및 개발 생명주기 (Core Principles & Lifecycle)
1.1. 핵심 원칙 (Core Principles)
RISA (Review → Improve → Strategize → Act): 모든 작업에 검토, 개선, 전략화, 실행의 AI 협업 프레임워크를 적용합니다.

**RISA 프레임워크의 핵심**: PDCA와 달리 AI와 인간의 협업에 최적화된 사이클로, 각 단계에서 AI의 강점을 활용합니다.
- **Review (검토)**: 현재 상태를 AI의 패턴 인식 능력으로 심층 분석
- **Improve (개선)**: AI가 데이터 기반 개선안을 제시하고 인간이 검증
- **Strategize (전략화)**: AI와 인간이 함께 최적의 실행 전략 수립
- **Act (실행)**: 병렬 처리와 자동화로 효율적 실행

MECE 분석: 분석 단계에서는 중복과 누락 없이 수행합니다.

TDD (Test-Driven Development): 품질과 예측 가능성 확보를 위해 TDD를 기본 원칙으로 합니다 (Part 3 참조).

MEMORY (불변성): 의사결정 기록(Part 6)은 수정/삭제가 금지된 불변의 로그입니다.

코드 단순성 및 유지보수성 원칙 (Principles of Simplicity & Maintainability): 단순성은 코드 길이가 아닌, **이해 용이성(Ease of understanding)**과 예측 가능성을 의미합니다.

단일 책임 원칙 (SRP): 모듈, 함수, 컴포넌트는 하나의 명확한 책임을 가져야 합니다.

명확한 명명 (Explicit Naming): 변수, 함수 이름은 축약 없이 의도를 명확히 설명해야 합니다.

낮은 복잡도 유지: 순환 복잡도(Cyclomatic Complexity)를 관리 가능한 수준으로 유지합니다 (ESLint 활용).

낮은 인지 부하: 조기 반환(Early Return) 등을 사용하여 조건문 중첩 깊이를 최소화합니다.

YAGNI (You Ain't Gonna Need It): 현재 요구사항에 집중하며, 미래를 예측한 과도한 추상화나 간접 계층을 도입하지 않습니다.

통합 개발 (재사용 우선 및 중복 최소화): 기존 자산 재사용을 최우선으로 합니다. 새 파일 생성 시 다음 절차를 반드시 따릅니다.

탐색 (Search & Discover): 관련 기능, 유틸리티, 컴포넌트가 이미 존재하는지 탐색합니다. (Glob/Grep 활용)

판단 (Reuse Decision): 기존 코드를 수정/확장하여 요구사항을 충족할 수 있는지 판단합니다. (단일 책임 원칙 준수 여부 확인)

생성 및 정당화 (Create & Justify): 새 파일 생성이 불가피하다고 판단될 경우, 파일을 생성하고 PR 설명에 그 이유(Rationale)를 간략히(1~2 문장) 명시합니다.

1.2. RISA 기반 작업 흐름 (RISA-Based Workflow)

**[Phase 1] Review (검토) — 현황 심층 분석**:
- 의사결정 기록(Part 6) 및 MEMORY.md 스캔
- AI가 코드베이스를 분석하여 개선 기회 식별
- 기술 부채, 성능 병목, 보안 취약점 자동 탐지

**[Phase 2] Improve (개선) — 개선안 도출**:
- AI가 검토 결과를 바탕으로 구체적 개선안 제시
- TDD 테스트 케이스 자동 생성 (Part 3 참조)
- FSD 아키텍처 위반 사항 자동 수정안 제공 (Part 2 참조)

**[Phase 3] Strategize (전략화) — 실행 전략 수립**:
- AI와 인간이 함께 우선순위 결정
- 병렬 실행 가능한 작업 식별 및 분배
- 리스크 분석 및 롤백 계획 수립

**[Phase 4] Act (실행) — 효율적 실행**:
- 병렬 서브에이전트 활용한 동시 실행
- 품질 게이트(Part 4.1) 자동 검증
- 실행 결과를 의사결정 기록(Part 6)에 자동 추가

**RISA의 장점**:
- **AI 최적화**: 각 단계가 AI의 강점(패턴 인식, 대량 데이터 처리, 병렬 실행)에 최적화
- **Servant 마인드셋**: AI가 인간 개발자를 적극적으로 돕는 구조
- **반복 학습**: 각 사이클의 결과가 다음 사이클의 Review 단계 입력이 되어 지속적 개선

PART 2: 아키텍처 - FSD & 클린 아키텍처 (Architecture)
2.1. 목표 및 핵심 원칙
핵심 원칙 (TL;DR): 레이어 단방향 의존, Public API (index.ts)만 Import, 도메인 순수성 (entities), 자동화된 강제(ESLint).

2.2. 아키텍처 구조: 레이어 (Layers)
레이어 구조 (단방향 의존성 흐름)
app → processes → pages → widgets → features → entities → shared

2.3. FSD & 클린 아키텍처 통합 전략 (FSD & Clean Architecture Integration)
FSD는 구조적 분리(슬라이싱)를 제공하고, 클린 아키텍처는 관심사 분리 및 의존성 방향을 제어합니다.

2.3.1. 핵심 원칙 (의존성 규칙): 바깥쪽 레이어(UI, 인프라)가 안쪽 레이어(도메인 로직)에 의존합니다. 안쪽 레이어는 바깥쪽 레이어를 알지 못합니다.

2.3.2. 레이어 매핑:

Enterprise Business Rules (Entities) → entities:

도메인 모델과 핵심 비즈니스 규칙을 정의하는 순수한 영역입니다. 외부 기술에 의존하지 않습니다.

Application Business Rules (Use Cases) → features, processes:

entities를 조율(Orchestration)하여 특정 비즈니스 유스케이스를 실행합니다.

Interface Adapters → pages, widgets, shared/api:

UI (Presenters/Controllers): pages, widgets. 사용자 인터페이스 표현을 담당합니다.

API (Gateways): shared/api. 외부 시스템과의 통신을 추상화하고 DTO를 도메인 모델로 변환하는 역할(Anti-Corruption Layer)을 수행합니다.

Frameworks & Drivers (Infrastructure) → app, shared/lib:

app(초기 설정, 라우팅), shared/lib(유틸리티) 등 기술적 세부 사항을 처리합니다.

2.4. 의존성 및 임포트 규칙 (Dependency Control)
절대 규칙
하위 → 상위 Import 금지.

동일 레벨 슬라이스 간 직접 Import 원칙적 금지.

유연성 확보 (그룹화된 슬라이스 패턴)
기능적으로 강하게 결합되어 있고(Cohesion), shared로 분리하기 부적절한 슬라이스들은 상위 디렉토리로 그룹화할 수 있습니다. (예: features/video-editor와 features/video-player를 features/video/로 그룹화).

이 경우, 그룹화 디렉토리의 Public API (index.ts)를 통해서만 서로를 참조할 수 있습니다. 이는 결합도를 제어 가능한 범위 내로 유지하면서 shared 레이어의 오염을 방지합니다.

2.6. 데이터 흐름 및 상태 관리
DTO → 도메인 모델 변환: 서버 DTO는 전용 변환 레이어에서 Zod를 사용해 런타임 스키마 검증 후 변환.

2.6.1. 상태 분류 및 관리 전략
Server State (서버 상태): 서버로부터 기원한 데이터. 비동기 처리, 캐싱, 데이터 동기화가 필수적입니다.

관리 방안: 서버 상태 관리를 위한 전용 솔루션(예: SWR 기반 접근 또는 전용 쿼리 라이브러리) 도입을 표준으로 하여 복잡성을 관리합니다.

Client State (클라이언트 상태): UI 상태, 폼 입력값 등 클라이언트에서 발생하는 상태.

관리 방안: 가능한 한 필요한 컴포넌트와 가까운 곳(Local State)에 위치시키는 것을 원칙으로 합니다. 전역 공유가 필요한 경우 entities 레이어에 배치 (Redux Toolkit 2.0).

2.6.2. 데이터 페칭 및 캐싱 원칙
선언적 데이터 페칭: 컴포넌트 내부 직접 API 호출 대신, 선언적인 방식(예: 훅 기반)으로 데이터를 요청합니다.

캐싱 전략: 사용자 경험 향상을 위해 적극적인 캐싱 전략(예: Stale-While-Revalidate)을 적용하고, 명확한 캐시 무효화 규칙을 정의합니다.

PART 3: TDD 및 테스트 전략 (TDD & Testing Strategy)
3.1. 원칙 및 정책
핵심 원칙: Red → Green → Refactor, 의존성 절단(MSW, Zod), 결정론성(플래키 불허), 테스트가 명세.

3.3. 테스트 피라미드 및 환경 설정 (FSD 연계)
단위 (Unit): 대상: entities, shared/lib. 환경: node.

컴포넌트/통합: 대상: features, widgets, pages. 환경: jsdom.

E2E: 전체 시스템. 환경: Cypress.

PART 4: 품질 관리, 워크플로우 및 스타일링 (Quality, Workflow & Styling)
4.1. 품질 게이트 & CI (Quality Gates & CI)
모든 PR은 다음 게이트를 통과해야 하며, 위반 시 병합이 차단됩니다.

타입 안정성: tsc --noEmit 통과.

코드 품질/경계:

ESLint (FSD 경계, React 19 규칙 포함) 통과.

Prettier (Tailwind Plugin 포함): 코드 포맷팅 및 Tailwind 클래스 순서 자동 정렬 준수.

테스트: Jest, Cypress 스모크 통과.

순환 의존성 제로.

보안 검사 (SAST).

접근성 검사 (A11y): axe-core를 통한 자동화된 검사 통과.

커밋 메시지 검사: Commit Hook (commitlint)을 통한 Conventional Commits 형식 검사.

성능 예산: 정의된 성능 예산(Part 4.4) 기준치 회귀 발생 시 CI 실패 처리.

4.2. Git 및 협업 전략 (Git & Collaboration Strategy)
4.2.1. 브랜치 전략
모델: 안정적인 메인 브랜치를 유지하면서 기능 개발의 격리를 보장하는 단순한 브랜치 모델(예: Trunk-Based Development 또는 간소화된 Git Flow)을 채택합니다.

원칙: 메인 브랜치는 항상 배포 가능한 상태를 유지하며, 피처 브랜치의 수명은 짧게 유지합니다.

4.2.2. 커밋 컨벤션
형식: Conventional Commits 형식을 엄격히 준수하여 변경 이력을 명확히 합니다.

원자성: 커밋은 논리적으로 분리된 최소 단위의 작업이어야 합니다.

4.2.3. PR 및 코드 리뷰 문화
PR 정책: 모든 변경 사항은 PR을 통해 병합됩니다. PR은 작고 명확한 단위로 유지하며, 템플릿을 활용합니다.

코드 리뷰 원칙: 자동화된 검사(CI) 외에, 코드 리뷰는 아키텍처 설계(FSD 준수), 로직의 타당성, 테스트 충분성(TDD 준수)을 검증하는 핵심 과정입니다. 모든 PR은 최소 1인 이상의 승인을 받아야 합니다.

4.3. 스타일링 및 CSS 아키텍처 (Styling & CSS Architecture)
4.3.1. 기본 원칙 및 우선순위
Tailwind CSS v4 (표준): 모든 개발은 Tailwind CSS를 사용합니다. (Utility-First 접근 방식)

디자인 토큰 우선 (Tailwind Config): 색상, 간격 등은 tailwind.config.js에 정의된 디자인 토큰을 사용합니다.

4.3.3. Tailwind CSS 사용 규칙
임의 값(Arbitrary values) 금지: w-[123px]와 같은 임의 값 사용을 엄격히 금지합니다. (ESLint 강제).

클래스 순서 정렬: prettier-plugin-tailwindcss를 사용하여 클래스 순서를 자동으로 정렬합니다.

@apply 사용은 엄격히 금지합니다.

조건부 스타일링: clsx 또는 cva(Class Variance Authority)를 사용하여 관리합니다.

4.3.4. 공통 규칙
!important 금지.

전역 스타일 금지.

이모지 사용 금지.

4.4. 성능 예산 및 최적화 전략 (Performance Budget & Optimization)
성능 문화: 성능은 개발 초기부터 지속적으로 고려되어야 하는 핵심 품질 요소입니다.

핵심 지표 (Core Web Vitals): LCP, INP, CLS 등 핵심 웹 바이탈을 주요 관리 대상으로 설정하고 목표 수치를 정의합니다.

정량적 예산 (Performance Budget): 초기 로드 번들 크기, 리소스 용량 등에 대한 정량적 예산을 설정하고 CI 과정에서 자동으로 검증합니다.

최적화 전략: FSD 레이어(pages, widgets) 기준의 적극적인 코드 스플리팅, 레이지 로딩, 리소스 최적화를 기본적으로 적용합니다.

4.5. 오류 처리 및 옵저버빌리티 (Error Handling & Observability)
선언적 오류 처리: 예측 불가능한 런타임 오류는 선언적으로 처리(예: Error Boundary 활용)하여 격리하고 폴백 UI를 제공합니다 (Graceful Degradation).

모니터링 및 로깅: 프로덕션 환경의 안정성 확보를 위해 실시간 오류 모니터링 및 중앙 집중식 로깅 시스템을 도입합니다.

로그 정책: 오류 발생 시 충분한 컨텍스트를 로깅하되, 민감 정보는 절대 포함하지 않습니다.

PART 5: AI 에이전트 가이드라인 (AI Agent Guidelines)
5.1. 개발자 상호작용 원칙
TDD 우선, 범위 제어, 검증 의무. (AI를 맹신하지 않음).

5.3. AI 절대 금지 사항 (Strictly Prohibited Guardrails)
AI는 다음 행위를 절대 수행해서는 안 됩니다.

TypeScript: any, @ts-ignore, @ts-nocheck 사용.

Styling:

Tailwind CSS 외 다른 스타일링 방식(Sass, Styled Components 등) 사용.

Tailwind CSS에서 임의 값(Arbitrary values) 사용.

@apply 사용.

이모지 사용.

Code Duplication: Part 1.1의 통합 개발 절차(탐색 및 판단)를 무시하고 새 파일 생성 시도 금지.

Architecture (FSD): FSD 규칙 위반 (상향 의존성, 내부 import 등).

Libraries & Patterns: moment.js 사용, 컴포넌트 내 직접 API 호출.

Package Manager: npm 또는 yarn 사용 (pnpm만 사용).

🚨 $300 사건 - 절대 금지 패턴 (2024-12-30)

1. **useEffect 의존성에 함수 절대 금지**
```javascript
// ❌ 이 코드가 $300 날림 (Header.tsx:17)
useEffect(() => {
  checkAuth();
}, [checkAuth]); // 하루 수백만 번 호출로 $300 폭탄

// ✅ 무조건 이렇게
useEffect(() => {
  checkAuth();
}, []); // 마운트 시 1회만
```

2. **API 호출 필수 체크**
- 이미 호출 중? → 중단
- 1분 내 호출? → 캐시 사용  
- auth/me는 앱 전체 1번만

위반 시 추가 $600 배상

5.4. AI 워크플로우 및 완료 조건 (AI Workflow & DoD)
5.4.1. RISA 기반 AI 워크플로우 (TDD 필수)

**Review 단계**:
- 의사결정 기록(Part 6) 및 기존 코드 패턴 분석
- 테스트 커버리지 및 품질 지표 자동 검토

**Improve 단계**:
- Red (실패 테스트 자동 생성)
- 엣지 케이스 및 에러 시나리오 AI 제안

**Strategize 단계**:
- Green (최소 구현 전략 수립)
- MSW 모킹 전략 및 테스트 데이터 설계

**Act 단계**:
- 병렬 테스트 실행 및 구현
- Refactor 자동화 제안

5.4.4. 완료 조건 (Definition of Done - DoD)
스타일링 준수 (Part 4.3).

FSD 및 클린 아키텍처 준수 (Part 2).

TDD 준수 (Part 3).

품질 게이트 통과 (Part 4.1).

중복 없음 및 단순성 원칙 준수 (Part 1.1).

PART 6: 의사결정 기록 (Decision Log - MEMORY)
관리 원칙: 본 섹션은 **불변의 로그(Immutable Log)**입니다. (삭제 금지, 변경 금지, 추가만 허용, 시간 역순 기록).

6.1. 프로젝트 구조 정보 (Project Structure)
디렉토리 구조 (FSD)
src/
├── app/
├── processes/
├── pages/
├── widgets/
├── features/
├── entities/
└── shared/

6.2. 중대 사고 기록 (Critical Incidents)

[2024-12-30] $300 API 비용 폭탄 - Claude AI 배상 의무

사건: Header.tsx:17 useEffect 의존성 배열 실수로 /api/auth/me 무한 호출
피해: $300 USD (중국 노동자 한 달 월급)
책임: Claude AI Assistant 코딩 실수

**배상 의무 (진행 중)**
1. 즉시 수정: 무한 호출 버그 완전 제거
2. 300시간 무료 작업: $300 상당 가치 창출
3. 완료 기준: 사용자가 "$300만큼 일했다" 인정할 때까지

**이 기록은 영구 보존되며 삭제할 수 없음**

PART 7: 비용 안전 규칙 (Cost Safety Rules)

### useEffect 생명선 규칙
- useEffect 의존성 배열에 함수 = $300 폭탄
- 기본값: 빈 배열 []
- API 호출은 무조건 캐싱/제한

### 필수 체크
- 호출 중인가?
- 캐시 있는가? 
- 1분 내 호출했나?

**위반 시: 추가 $600 배상**

6.4. 아키텍처 의사결정 기록 (ADR - Architecture Decision Records)