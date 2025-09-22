/**
 * Processes Layer Public API
 *
 * FSD processes 레이어 - 복잡한 비즈니스 프로세스 오케스트레이션
 * CLAUDE.md 준수: 최상위 레이어, 단방향 의존성
 */

// === UserJourney 프로세스 ===

/**
 * 메인 UserJourney 오케스트레이터
 * 전체 22단계 UserJourneyMap을 관리하는 최상위 프로세스
 */
export { default as UserJourneyOrchestrator, useUserJourneyContext } from './user-journey/orchestrator'

/**
 * UserJourney 프로세스 관리 훅
 * 상태, 진행률, 데이터 관리를 포함한 종합적인 여정 관리
 */
export { default as useUserJourneyProcess } from './user-journey/hooks/useUserJourneyProcess'

/**
 * UserJourney 네비게이션 훅
 * 단계별 라우팅, 검증, 조건부 네비게이션 관리
 */
export { default as useUserJourneyNavigation } from './user-journey/hooks/useUserJourneyNavigation'

/**
 * UserJourney 분석 훅
 * 성능 메트릭, 사용자 행동, 이탈 지점 분석
 */
export { default as useUserJourneyAnalytics } from './user-journey/hooks/useUserJourneyAnalytics'

/**
 * UserJourney Redux 통합 훅
 * Redux 상태와 오케스트레이터 통합 관리
 */
export { default as useUserJourneyRedux } from './user-journey/hooks/useUserJourneyRedux'

// === 타입 정의 ===

export type {
  // 기본 타입
  UserJourneyState,
  UserJourneyStep,
  JourneyPhase,

  // 진행 상황
  JourneyProgress,
  StepProgress,
  SubStepProgress,

  // 검증 및 네비게이션
  StepValidationResult,
  NavigationGuard,
  StepRequirement,
  ValidationRule,

  // 데이터 관리
  UserJourneyData,
  JourneyError,
  StepMetrics,

  // 분석 및 추적
  AnalyticsEvent,
  AnalyticsEventType,
  JourneyStats,

  // 설정 및 컨텍스트
  JourneyConfig,
  JourneyContext,
  JourneyAction,
  JourneyEventListener,

  // 기타
  JourneyMetadata,
  JourneyRecommendation
} from './user-journey/types'

// === 설정 및 상수 ===

export {
  USER_JOURNEY_STEPS,
  STEP_REQUIREMENTS,
  NAVIGATION_RULES,
  DEFAULT_JOURNEY_CONFIG,
  PHASE_MAPPING,
  ESTIMATED_TOTAL_DURATION,
  PHASE_DURATIONS,
  SKIPPABLE_STEPS,
  REQUIRED_STEPS,
  SKIP_CONDITIONS
} from './user-journey/config'

// === 유틸리티 함수 ===

export {
  validateStepTransition,
  calculateProgress,
  getNextAllowedStep,
  createAnalyticsEvent,
  createJourneyError,
  calculateStepDuration,
  getEstimatedCompletionTime,
  getSkippableSteps,
  getRequiredSteps,
  validateStepProgress,
  calculateCompletionRate,
  calculateWeightedProgress,
  calculatePerformanceMetrics,
  checkSkipConditions,
  generateJourneyStats
} from './user-journey/utils'

// === 복합 컴포넌트 패턴 ===

/**
 * UserJourney 관련 모든 기능을 포함하는 복합 객체
 *
 * 사용 예시:
 * ```tsx
 * import { UserJourney } from '@/processes'
 *
 * function App() {
 *   return (
 *     <UserJourney.Orchestrator>
 *       <UserJourneyPageComponent />
 *     </UserJourney.Orchestrator>
 *   )
 * }
 *
 * function UserJourneyPageComponent() {
 *   const journey = UserJourney.useProcess()
 *   const navigation = UserJourney.useNavigation()
 *   const analytics = UserJourney.useAnalytics()
 *   const redux = UserJourney.useRedux()
 *
 *   return <div>...</div>
 * }
 * ```
 */
export const UserJourney = {
  // 컴포넌트
  Orchestrator: UserJourneyOrchestrator,

  // 훅
  useProcess: useUserJourneyProcess,
  useNavigation: useUserJourneyNavigation,
  useAnalytics: useUserJourneyAnalytics,
  useRedux: useUserJourneyRedux,
  useContext: useUserJourneyContext
} as const

// === 기본 내보내기 ===

/**
 * 가장 많이 사용될 UserJourney 오케스트레이터를 기본 내보내기로 제공
 */
export { default } from './user-journey/orchestrator'
