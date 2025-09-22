# VideoPlanet 영상 기획 위저드 FSD 아키텍처 설계서

**Version**: 1.0
**Date**: 2025-01-22
**Author**: Claude (Chief Architect)

## 🎯 설계 목표

**핵심 목표**: 한 줄 스토리 → 4단계 → 12숏 → 콘티/인서트 → JSON + Marp PDF 자동·반자동 산출

**비기능 요구사항**:
- **비용 안전**: $300 사건 재발 방지 (API 호출 제한, 캐싱, 중복 방지)
- **성능**: 12숏 병렬 처리, 이미지 지연 로딩, 코드 스플리팅
- **사용성**: 3-Step Wizard, 자동 저장, 세션 복원
- **확장성**: FSD 단방향 의존성, 모듈화된 Hook 설계

## 🏗️ FSD 아키텍처 개요

```
src/
├── entities/planning/           # 도메인 순수성 (비즈니스 로직)
├── features/planning/           # 기능 레이어 (Hook + Redux)
├── widgets/planning/            # UI 컴포넌트 레이어
└── app/api/planning/           # API 라우트 (Next.js)
```

### 📁 1. entities/planning (도메인 레이어)

**책임**: 비즈니스 로직, 타입 정의, 검증 규칙

```typescript
// 핵심 타입
PlanningProject       // 전체 기획 프로젝트
PlanningInputData     // Step 1: 입력 데이터
StoryStep             // Step 2: 4단계 스토리
ShotSequence          // Step 3: 12숏 시퀀스
InsertShot            // 인서트 3컷
ContiGenerationRequest // 콘티 생성 요청
MarpPdfExportRequest  // PDF 내보내기 요청

// 비즈니스 규칙
PLANNING_BUSINESS_RULES = {
  MAX_TITLE_LENGTH: 100,
  MAX_LOGLINE_LENGTH: 300,
  DEFAULT_SHOT_COUNT: 12,
  MIN_SHOT_DURATION: 3,
  MAX_SHOT_DURATION: 60,
  DEFAULT_AUTO_SAVE_INTERVAL: 30,
}

// 검증 함수
validatePlanningInput()
validateStorySteps()
validateShotSequences()
calculateWizardProgress()
```

### 🔧 2. features/planning (기능 레이어)

**책임**: 비즈니스 로직 실행, 상태 관리, API 연동

#### 2.1 핵심 Hooks

```typescript
// 메인 위저드 상태 관리
usePlanningWizard(projectId?, options) {
  // 3단계 네비게이션, 자동저장, 세션복원
  return {
    currentStep, currentProject, progress,
    startNewProject, saveProject, goToStep,
    updateInputData, updateStorySteps, updateShotSequences
  }
}

// AI 스토리 생성 (Gemini)
useStoryGeneration(options) {
  // 4단계 스토리 자동 생성
  return {
    generateStory, regenerateStory, useDefaultTemplate,
    isGenerating, progress, error
  }
}

// 12숏 자동 분해
useShotBreakdown(options) {
  // 스토리 → 12숏 변환, 시간 배분 계산
  return {
    breakdownShots, useDefaultBreakdown,
    isGenerating, progress, error
  }
}

// 콘티 이미지 생성 (ByteDance)
useContiGeneration(options) {
  // 병렬 배치 처리, 재시도 로직
  return {
    generateBatchConti, regenerateConti,
    isGenerating, progress, completedShots, failedShots
  }
}

// PDF 내보내기 (Marp)
useMarpExport(options) {
  // Markdown → PDF 변환, 다운로드
  return {
    exportToPdf, exportToJson, generatePreview,
    isExporting, progress, downloadUrl
  }
}
```

#### 2.2 Redux 상태 관리

```typescript
// features/planning/store/planning-slice.ts
interface PlanningState {
  currentProject: PlanningProject | null
  projects: PlanningProject[]
  currentStep: WizardStep
  isLoading: boolean
  error: string | null
  lastFetch: number | null  // 캐싱용
  isDirty: boolean         // 자동저장용
}

// 비동기 액션
createProject()   // 새 프로젝트 생성
loadProject()     // 기존 프로젝트 로드
saveProject()     // 프로젝트 저장
loadProjects()    // 목록 조회 (캐시 적용)

// 동기 액션
updateInputData()      // Step 1 데이터 업데이트
updateStorySteps()     // Step 2 스토리 업데이트
updateShotSequences()  // Step 3 숏 업데이트
updateShotContiImage() // 개별 콘티 이미지 업데이트
```

### 🎨 3. widgets/planning (UI 레이어)

**책임**: 사용자 인터페이스, 상호작용, 접근성

#### 3.1 메인 컴포넌트

```typescript
// 메인 위저드 컨테이너
<PlanningWizard
  projectId?
  onComplete?
  enableAutoSave={true}
  enableSessionRestore={true}
/>

// Step 1: 입력 폼
<StoryInputForm
  onSubmit={handleGenerateStory}
  onUseTemplate={useDefaultTemplate}
  isGenerating={isGeneratingStory}
/>

// Step 2: 4단계 스토리 편집
<StoryStepEditor
  storySteps={storySteps}
  onChange={updateStorySteps}
  onGenerateShots={handleBreakdownShots}
/>

// Step 3: 12숏 그리드 편집
<ShotGridEditor
  shotSequences={shotSequences}
  onChange={updateShotSequences}
  onComplete={handleComplete}
/>
```

#### 3.2 보조 컴포넌트

```typescript
<WizardProgress />        // 진행률 표시
<WizardNavigation />      // 단계 네비게이션
<AutoSaveIndicator />     // 자동저장 상태
<ContiImageViewer />      // 콘티 이미지 뷰어
<ShotEditor />           // 개별 숏 편집기
<ExportModal />          // PDF 내보내기 모달
```

### 🌐 4. API 라우트 설계

```typescript
// 프로젝트 CRUD
GET    /api/planning/projects          // 목록 조회 (필터, 페이징)
POST   /api/planning/projects          // 새 프로젝트 생성
GET    /api/planning/projects/[id]     // 개별 프로젝트 조회
PUT    /api/planning/projects/[id]     // 프로젝트 수정
DELETE /api/planning/projects/[id]     // 프로젝트 삭제

// AI 생성 API
POST   /api/planning/generate-story    // Gemini 4단계 스토리 생성
POST   /api/planning/generate-shots    // 12숏 자동 분해
POST   /api/planning/generate-conti    // ByteDance 콘티 생성
POST   /api/planning/export-marp       // Marp PDF 내보내기

// 템플릿 관리
GET    /api/planning/templates         // 템플릿 목록
POST   /api/planning/templates         // 템플릿 생성
```

## 🔄 사용자 여정 (3-Step Wizard)

### Step 1: 입력/선택 단계
1. **입력 항목**:
   - 제목, 로그라인 (한 줄 스토리)
   - 톤앤매너: casual | professional | creative | educational | marketing
   - 전개방식: linear | dramatic | problem_solution | comparison | tutorial
   - 스토리 강도: low | medium | high
   - 목표 시간 (초), 추가 요청사항

2. **검증 및 처리**:
   - 실시간 폼 검증 (Zod 스키마)
   - 자동 저장 (2초 디바운싱)
   - [생성] 버튼 → Gemini API 호출
   - [기본 템플릿] 버튼 → 즉시 4단계 생성

### Step 2: 4단계 검토/수정
1. **표시 정보**:
   - 4개 카드: 도입부 → 전개부 → 심화부 → 마무리
   - 각 카드: 제목, 설명, 예상시간, 핵심포인트
   - 총 시간, 평균 시간, 목표 시간 비교

2. **편집 기능**:
   - 인라인 편집 (클릭 시 즉시 편집 모드)
   - 드래그 앤 드롭 순서 변경
   - 핵심 포인트 추가/삭제
   - [숏 생성] 버튼 → 12개 숏으로 자동 분해
   - [AI 개선 요청] 모달

### Step 3: 12숏 편집·콘티·내보내기
1. **그리드 레이아웃**:
   - 좌측: 3x4 그리드 (12개 숏 카드)
   - 우측: 선택된 숏 상세 편집기

2. **콘티 생성**:
   - [모든 콘티 생성] → ByteDance API 배치 호출
   - 개별 재생성, 스타일 변경 가능
   - 실시간 진행률 표시

3. **내보내기**:
   - JSON + Marp PDF 동시 생성
   - 테마, 색상, 포함 옵션 설정
   - 자동 다운로드

## 🛡️ 비용 안전 조치 ($300 사건 재발 방지)

### 1. API 호출 제한
```typescript
// useEffect 의존성에 함수 절대 금지
useEffect(() => {
  checkAuth()
}, []) // ✅ 빈 배열만 사용

// 중복 호출 방지
if (state.isGenerating) {
  logger.warn('이미 스토리 생성이 진행 중입니다.')
  return null
}

// 캐싱 (5분 타임아웃)
if (now - lastFetch < 5 * 60 * 1000) {
  return cachedData
}
```

### 2. 비용 로깅
```typescript
// 모든 외부 API 호출 시 비용 기록
logger.logCostEvent('gemini_story_generation', 0.015, {
  userId, stepsCount, generationTime
})

logger.logCostEvent('bytedance_conti_generation', 0.05, {
  shotId, style
})
```

### 3. 자동 저장 최적화
```typescript
// 타이머 기반 1회 실행 (의존성 배열에서 함수 제외)
useEffect(() => {
  const timer = setTimeout(() => {
    if (hasUnsavedChanges) saveProject()
  }, 30000)
  return () => clearTimeout(timer)
}, [hasUnsavedChanges]) // 함수는 의존성에서 제외
```

## ⚡ 성능 최적화

### 1. 병렬 처리
```typescript
// 콘티 생성 배치 처리 (3개씩 동시)
const batchPromises = batchShots.map(shot =>
  generateSingleConti(shot, projectContext)
)
const results = await Promise.allSettled(batchPromises)
```

### 2. 코드 스플리팅
```typescript
// 위저드 단계별 지연 로딩
const StoryInputForm = lazy(() => import('./StoryInputForm'))
const StoryStepEditor = lazy(() => import('./StoryStepEditor'))
const ShotGridEditor = lazy(() => import('./ShotGridEditor'))
```

### 3. 이미지 최적화
```typescript
// 콘티 이미지 지연 로딩
<LazyImage
  src={shot.contiImageUrl}
  alt={`${shot.title} 콘티`}
  placeholder={<ContiPlaceholder />}
/>
```

## 🧪 테스트 전략

### 1. 단위 테스트 (entities)
```typescript
// entities/planning/model.test.ts
describe('validatePlanningInput', () => {
  it('should validate title length', () => {
    const result = validatePlanningInput({ title: 'a'.repeat(101) })
    expect(result.isValid).toBe(false)
  })
})
```

### 2. 통합 테스트 (features)
```typescript
// features/planning/hooks/usePlanningWizard.test.ts
describe('usePlanningWizard', () => {
  it('should handle step navigation', async () => {
    const { result } = renderHook(() => usePlanningWizard())
    await act(() => result.current.goToStep('story'))
    expect(result.current.currentStep).toBe('story')
  })
})
```

### 3. E2E 테스트 (Cypress)
```typescript
// cypress/e2e/planning-wizard.cy.ts
describe('Planning Wizard Flow', () => {
  it('should complete full planning flow', () => {
    cy.visit('/planning/create')
    cy.fillPlanningForm()
    cy.generateStory()
    cy.editStorySteps()
    cy.generateShots()
    cy.generateConti()
    cy.exportPdf()
  })
})
```

## 📊 데이터베이스 스키마

```sql
-- 기획 프로젝트 메인 테이블
CREATE TABLE planning_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  status planning_status NOT NULL DEFAULT 'draft',
  current_step wizard_step NOT NULL DEFAULT 'input',
  completion_percentage INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 180,
  input_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 스토리 스텝 테이블
CREATE TABLE story_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_project_id UUID NOT NULL REFERENCES planning_projects(id),
  order_index INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  duration INTEGER,
  key_points TEXT[],
  thumbnail_url TEXT
);

-- 숏 시퀀스 테이블
CREATE TABLE shot_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_project_id UUID NOT NULL REFERENCES planning_projects(id),
  story_step_id UUID NOT NULL REFERENCES story_steps(id),
  order_index INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  duration INTEGER NOT NULL,
  conti_description TEXT NOT NULL,
  conti_image_url TEXT,
  conti_style conti_style NOT NULL DEFAULT 'rough',
  shot_type shot_type DEFAULT 'medium',
  camera_movement camera_movement DEFAULT 'static',
  visual_elements TEXT[],
  transition_type transition_type DEFAULT 'cut'
);
```

## 🚀 배포 및 모니터링

### 1. 배포 파이프라인
- **Vercel**: Frontend 자동 배포 (feature branch → preview)
- **Railway**: API 서버 배포
- **Supabase**: 데이터베이스 + 스토리지

### 2. 모니터링
```typescript
// 비즈니스 메트릭
logger.logBusinessEvent('planning_project_created', {
  userId, projectId, toneAndManner, development
})

// 성능 메트릭
logger.logPerformanceEvent('wizard_step_transition', {
  fromStep, toStep, duration
})

// 비용 메트릭
logger.logCostEvent('api_call', cost, { provider, endpoint })
```

### 3. 에러 추적
- **Sentry**: 프론트엔드 에러 모니터링
- **구조화된 로깅**: 서버 에러 추적
- **Health Check**: `/api/health/planning` 엔드포인트

## 📋 완료 체크리스트

### ✅ 완료된 항목

- [x] **entities/planning**: 도메인 타입, 비즈니스 규칙, 검증 함수
- [x] **features/planning**: 5개 핵심 Hook, Redux 상태 관리
- [x] **widgets/planning**: 메인 위저드, 3단계 컴포넌트들
- [x] **API 라우트**: 프로젝트 CRUD, 스토리 생성, 숏 분해
- [x] **비용 안전**: $300 재발 방지 조치들
- [x] **성능 최적화**: 병렬 처리, 코드 스플리팅, 캐싱

### 🔄 추가 구현 필요

- [ ] **콘티 생성 API**: `/api/planning/generate-conti`
- [ ] **PDF 내보내기 API**: `/api/planning/export-marp`
- [ ] **프로젝트 상세 API**: `/api/planning/projects/[id]/route.ts`
- [ ] **템플릿 관리 API**: `/api/planning/templates`
- [ ] **보조 UI 컴포넌트들**: `ContiImageViewer`, `ShotEditor`, `ExportModal`
- [ ] **E2E 테스트**: Cypress 통합 테스트
- [ ] **DB 마이그레이션**: Supabase 스키마 적용

## 🎯 성공 지표

### 기술적 지표
- **경계 위반**: 0건 (FSD 규칙 준수)
- **API 비용**: 월 $50 이하 유지
- **성능**: LCP < 2.5초, INP < 200ms
- **테스트 커버리지**: 85% 이상

### 비즈니스 지표
- **위저드 완료율**: 80% 이상
- **평균 기획 시간**: 15분 이하
- **사용자 만족도**: 4.5/5 이상
- **PDF 다운로드율**: 90% 이상

---

**설계 완료**: 2025-01-22
**다음 단계**: 나머지 API 라우트 구현 → E2E 테스트 → 프로덕션 배포