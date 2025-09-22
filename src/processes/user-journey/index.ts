/**
 * UserJourney Process
 *
 * FSD processes 레이어 - 전체 UserJourneyMap 22단계 오케스트레이션
 * CLAUDE.md 준수: 비즈니스 프로세스 관리, 단방향 의존성
 */

// === 프로세스 오케스트레이터 ===

/**
 * 메인 UserJourney 프로세스 오케스트레이터
 * 22단계 전체 플로우를 관리하고 조율
 */
export { UserJourneyOrchestrator } from './orchestrator'

/**
 * UserJourney 상태 관리 훅
 * 전체 여정의 진행 상황과 상태를 추적
 */
export { useUserJourneyProcess } from './hooks/useUserJourneyProcess'

/**
 * 단계 간 네비게이션 로직
 * 조건부 라우팅 및 검증을 포함한 네비게이션
 */
export { useUserJourneyNavigation } from './hooks/useUserJourneyNavigation'

/**
 * 진행 상황 추적 및 분석
 * 각 단계별 성과 측정과 이탈 지점 분석
 */
export { useUserJourneyAnalytics } from './hooks/useUserJourneyAnalytics'

// === 타입 정의 ===

export type {
  UserJourneyState,
  UserJourneyStep,
  StepValidationResult,
  JourneyProgress,
  NavigationGuard,
  AnalyticsEvent
} from './types'

// === 상수 및 설정 ===

export {
  USER_JOURNEY_STEPS,
  STEP_REQUIREMENTS,
  NAVIGATION_RULES
} from './config'

// === 유틸리티 ===

export {
  validateStepTransition,
  calculateProgress,
  getNextAllowedStep,
  createAnalyticsEvent
} from './utils'

// === 기본 내보내기 ===

/**
 * 가장 핵심적인 UserJourney 오케스트레이터를 기본 내보내기로 제공
 */
export { UserJourneyOrchestrator as default } from './orchestrator'