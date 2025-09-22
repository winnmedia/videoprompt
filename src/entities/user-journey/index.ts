/**
 * UserJourney Entity Layer Public API
 *
 * FSD entities 레이어 - UserJourney 도메인 모델 및 상태 관리
 * CLAUDE.md 준수: Public API 패턴, 타입 안전성
 */

// === Redux Store 통합 ===

/**
 * UserJourney Redux Slice
 * 메인 Redux store에서 사용할 리듀서
 */
export { default as userJourneyReducer } from './store/user-journey-slice'

/**
 * UserJourney Actions
 * 동기/비동기 액션 및 액션 타입들
 */
export {
  // 동기 액션
  setCurrentStep,
  setPageState,
  persistJourneyData,
  addJourneyError,
  addAnalyticsEvent,
  updateJourneyConfig,
  resetCurrentJourney,
  clearError,
  setLoading,

  // 비동기 액션 (Thunks)
  startUserJourney,
  completeJourneyStep,
  flushAnalyticsEvents,

  // 액션 타입 상수들
  userJourneyActionTypes
} from './store/user-journey-slice'

/**
 * UserJourney State Type
 * Redux store에서 사용할 상태 타입
 */
export type { UserJourneyReduxState } from './store/user-journey-slice'

// === Selectors (상태 선택자) ===

/**
 * 기본 선택자들
 */
export {
  selectUserJourneyState,
  selectCurrentJourney,
  selectCurrentStep,
  selectCurrentPageState,
  selectCompletedSteps,
  selectPersistedData,
  selectJourneyErrors,
  selectJourneyConfig,
  selectAnalyticsBuffer,
  selectPerformanceMetrics,
  selectJourneyHistory,
  selectIsJourneyLoading,
  selectJourneyError,
  selectLastSyncedAt
} from './store/selectors'

/**
 * 계산된 선택자들 (메모이제이션)
 */
export {
  selectJourneyProgress,
  selectWeightedProgress,
  selectNextAllowedStep,
  selectCurrentStepValidation,
  selectCurrentPhase,
  selectCurrentPhaseProgress,
  selectIsJourneyCompleted,
  selectIsJourneyActive,
  selectRecentErrors,
  selectErrorsByStep,
  selectAnalyticsStats,
  selectSessionMetadata,
  selectEstimatedCompletionTime,
  selectJourneySummary,
  selectDebugInfo
} from './store/selectors'

/**
 * 데이터 선택자들
 */
export {
  createDataSelector,
  selectAuthData,
  selectScenarioData,
  selectPlanningData,
  selectVideoData,
  selectFeedbackData,
  selectProjectData
} from './store/selectors'

/**
 * 조건부 선택자 팩토리들
 */
export {
  createStepCompletedSelector,
  createPhaseCompletedSelector,
  createDataExistsSelector,
  createCanAccessStepSelector
} from './store/selectors'

/**
 * State 타입 (제네릭)
 * 컴포넌트에서 사용할 state 타입
 */
export type { StateWithUserJourney } from './store/selectors'

// === Types 재export ===

/**
 * processes 레이어의 타입들을 entities에서 재export
 * FSD 규칙: processes → entities 의존 허용
 */
export type {
  UserJourneyState,
  UserJourneyStep,
  JourneyPhase,
  JourneyProgress,
  StepProgress,
  SubStepProgress,
  StepValidationResult,
  NavigationGuard,
  StepRequirement,
  ValidationRule,
  UserJourneyData,
  JourneyError,
  StepMetrics,
  AnalyticsEvent,
  AnalyticsEventType,
  JourneyStats,
  JourneyConfig,
  JourneyContext,
  JourneyAction,
  JourneyEventListener,
  JourneyMetadata,
  JourneyRecommendation
} from '../../processes/user-journey/types'

// === 설정 및 상수 재export ===

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
} from '../../processes/user-journey/config'

// === 유틸리티 함수 재export ===

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
} from '../../processes/user-journey/utils'

// === Redux 통합을 위한 복합 객체 ===

/**
 * UserJourney Redux 관련 모든 기능을 포함하는 객체
 *
 * 사용 예시:
 * ```tsx
 * import { UserJourneyRedux } from '@/entities/user-journey'
 *
 * // Store 설정
 * const store = configureStore({
 *   reducer: {
 *     userJourney: UserJourneyRedux.reducer
 *   }
 * })
 *
 * // 컴포넌트에서 사용
 * function MyComponent() {
 *   const currentStep = useSelector(UserJourneyRedux.selectors.selectCurrentStep)
 *   const dispatch = useDispatch()
 *
 *   const handleStart = () => {
 *     dispatch(UserJourneyRedux.actions.startUserJourney({ userId: 'user123' }))
 *   }
 * }
 * ```
 */
export const UserJourneyRedux = {
  // 리듀서
  reducer: userJourneyReducer,

  // 액션들
  actions: {
    // 동기 액션
    setCurrentStep,
    setPageState,
    persistJourneyData,
    addJourneyError,
    addAnalyticsEvent,
    updateJourneyConfig,
    resetCurrentJourney,
    clearError,
    setLoading,

    // 비동기 액션
    startUserJourney,
    completeJourneyStep,
    flushAnalyticsEvents
  },

  // 선택자들을 그룹화
  selectors: {
    // 기본 선택자
    selectUserJourneyState,
    selectCurrentJourney,
    selectCurrentStep,
    selectCurrentPageState,
    selectCompletedSteps,
    selectPersistedData,
    selectJourneyErrors,
    selectJourneyConfig,
    selectAnalyticsBuffer,
    selectPerformanceMetrics,
    selectJourneyHistory,
    selectIsJourneyLoading,
    selectJourneyError,
    selectLastSyncedAt,

    // 계산된 선택자
    selectJourneyProgress,
    selectWeightedProgress,
    selectNextAllowedStep,
    selectCurrentStepValidation,
    selectCurrentPhase,
    selectCurrentPhaseProgress,
    selectIsJourneyCompleted,
    selectIsJourneyActive,
    selectRecentErrors,
    selectErrorsByStep,
    selectAnalyticsStats,
    selectSessionMetadata,
    selectEstimatedCompletionTime,
    selectJourneySummary,
    selectDebugInfo,

    // 데이터 선택자
    selectAuthData,
    selectScenarioData,
    selectPlanningData,
    selectVideoData,
    selectFeedbackData,
    selectProjectData,

    // 팩토리 함수들
    createDataSelector,
    createStepCompletedSelector,
    createPhaseCompletedSelector,
    createDataExistsSelector,
    createCanAccessStepSelector
  },

  // 액션 타입들
  actionTypes: userJourneyActionTypes
} as const