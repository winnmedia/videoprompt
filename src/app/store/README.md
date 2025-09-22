# Redux Store Integration Guide

## 개요

시나리오 기획 기능의 Redux Store 통합이 완료되었습니다. 이 문서는 통합된 상태 관리 시스템의 사용법과 비용 안전 규칙을 설명합니다.

## 🔥 비용 안전 규칙 ($300 사건 방지)

### 핵심 원칙
1. **useEffect 의존성 배열에 함수 절대 금지**
2. **API 호출 1분 내 중복 방지**
3. **무한 렌더링 감지 및 차단**

### 안전 장치
- **costSafetyMiddleware**: 위험한 Redux 액션 차단
- **IntegrationCallLimiter**: API 호출 빈도 제한
- **ActionCallTracker**: 액션 호출 모니터링

## 🏗️ 아키텍처 구조

```
src/app/store/
├── index.ts          # 메인 스토어 설정
├── hooks.ts          # 타입 안전 훅
└── README.md         # 이 문서

src/entities/
├── scenario/store.ts # 시나리오 상태 관리
└── project/store.ts  # 프로젝트 상태 관리

src/shared/
├── hooks/useProjectScenarioIntegration.ts # 통합 훅
├── lib/cost-safety-middleware.ts           # 비용 안전 미들웨어
└── testing/msw/                           # MSW 모킹
```

## 📖 사용법

### 1. 기본 훅 사용

```typescript
import { useAppSelector, useAppDispatch } from '../app/store/hooks'
import { scenarioSelectors, scenarioActions } from '../entities/scenario'
import { projectSelectors, projectActions } from '../entities/project'

function MyComponent() {
  const dispatch = useAppDispatch()

  // 안전한 방식 - 빈 배열 의존성
  const currentScenario = useAppSelector(scenarioSelectors.getCurrentScenario)
  const currentProject = useAppSelector(projectSelectors.getCurrentProject)

  // ❌ 절대 금지 - 함수를 의존성에 넣으면 $300 폭탄
  // useEffect(() => {
  //   fetchData()
  // }, [fetchData])

  // ✅ 안전한 방식
  useEffect(() => {
    dispatch(scenarioActions.setLoading(true))
  }, []) // 빈 배열
}
```

### 2. 프로젝트-시나리오 통합

```typescript
import { useProjectScenarioIntegration } from '../shared/hooks/useProjectScenarioIntegration'

function ProjectScenarioManager() {
  const {
    linkScenarioToProject,
    unlinkScenarioFromProject,
    getLinkedScenarios,
    isLinked,
    isLinking,
    error
  } = useProjectScenarioIntegration()

  const handleLinkScenario = async () => {
    // 비용 안전: 자동으로 중복 호출 방지
    const success = await linkScenarioToProject()
    if (success) {
      console.log('연결 완료')
    }
  }

  return (
    <div>
      <button
        onClick={handleLinkScenario}
        disabled={isLinking}
      >
        시나리오 연결
      </button>
      {error && <p>오류: {error}</p>}
    </div>
  )
}
```

### 3. MSW 테스트 설정

```typescript
import { setupMswForTests } from '../shared/testing/msw/setup'

describe('My Component Test', () => {
  // MSW 자동 설정 - 실제 API 호출 차단
  setupMswForTests()

  it('should work without real API calls', () => {
    // 테스트 코드 - 모든 API 호출이 모킹됨
  })
})
```

## 🎯 핵심 기능

### 1. 시나리오 상태 관리
- 시나리오 생성/수정/삭제
- 씬 관리 (추가/수정/삭제/재정렬)
- 검증 및 에러 처리
- 에디터 상태 추적

### 2. 프로젝트 상태 관리
- 프로젝트 생성/수정/삭제
- 상태 변경 (draft → planning → production → review → completed)
- 마일스톤 관리
- 시나리오 연결/해제

### 3. 통합 기능
- 프로젝트-시나리오 연결 관리
- 연결 상태 추적
- 통합 검증
- 에러 복구

## 🧪 테스트 전략

### 1. 단위 테스트
- 각 리듀서 동작 검증
- 셀렉터 로직 테스트
- 모델 비즈니스 로직 검증

### 2. 통합 테스트
- 프로젝트-시나리오 연동 테스트
- MSW를 통한 API 모킹
- 실제 사용 시나리오 재현

### 3. 비용 안전 테스트
- 무한 호출 시나리오 테스트
- 액션 호출 빈도 테스트
- 미들웨어 차단 로직 검증

## 📊 상태 구조

### RootState
```typescript
interface RootState {
  scenario: ScenarioState
  project: ProjectState
}
```

### ScenarioState
```typescript
interface ScenarioState {
  currentScenario: Scenario | null
  scenarioList: Scenario[]
  isLoading: boolean
  selectedSceneId: string | null
  editorState: EditorState
  validationResult: ValidationResult | null
  error: string | null
}
```

### ProjectState
```typescript
interface ProjectState {
  currentProject: Project | null
  projectList: Project[]
  isLoading: boolean
  selectedProjectId: string | null
  validationResult: ProjectValidationResult | null
  filter: ProjectFilter
  sortBy: ProjectSortBy
  sortOrder: 'asc' | 'desc'
  error: string | null
}
```

## 🚨 주의사항

### 1. 비용 폭탄 방지
- API 호출 전 반드시 캐시 확인
- 동일 작업 1분 내 중복 실행 금지
- useEffect 의존성 배열 신중히 관리

### 2. 메모리 누수 방지
- 컴포넌트 언마운트 시 정리 로직 실행
- 이벤트 리스너 정리
- 타이머 정리

### 3. 타입 안전성
- 반드시 타입이 지정된 훅 사용
- any 타입 사용 금지
- Redux DevTools는 개발 환경에서만 활성화

## 📈 성능 최적화

### 1. 셀렉터 메모화
- createSelector를 사용한 계산 최적화
- 불필요한 리렌더링 방지

### 2. 액션 배칭
- 관련된 상태 변경을 함께 처리
- UI 업데이트 최소화

### 3. 지연 로딩
- 필요한 시점에만 데이터 로드
- 초기 번들 크기 최소화

## 🔧 디버깅

### 개발 환경 도구
```typescript
// 액션 모니터링 리포트
import { getActionMonitoringReport } from '../shared/lib/cost-safety-middleware'

const report = getActionMonitoringReport()
console.log('액션 호출 통계:', report)

// 통합 디버그
import { useProjectScenarioDebug } from '../shared/hooks/useProjectScenarioIntegration'

const { debug } = useProjectScenarioDebug()
debug?.resetCallLimiter() // 호출 제한 리셋
```

## 📝 체크리스트

### 새로운 기능 추가 시
- [ ] 비용 안전 규칙 준수 확인
- [ ] MSW 핸들러 구현
- [ ] 통합 테스트 작성
- [ ] 타입 안전성 검증
- [ ] 문서 업데이트

### 배포 전 확인사항
- [ ] 모든 테스트 통과
- [ ] Redux DevTools 비활성화 (프로덕션)
- [ ] API 호출 제한 설정 확인
- [ ] 메모리 누수 검사
- [ ] 성능 프로파일링

---

**⚠️ 경고**: 이 시스템은 $300 사건 재발 방지를 위한 엄격한 안전 장치가 적용되어 있습니다. 안전 규칙을 우회하거나 수정할 경우 심각한 비용 손실이 발생할 수 있습니다.