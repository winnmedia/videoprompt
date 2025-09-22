/**
 * UserJourney Selectors
 *
 * FSD entities 레이어 - UserJourney 상태 선택자
 * CLAUDE.md 준수: 메모이제이션으로 성능 최적화, 타입 안전성
 */

import { createSelector } from '@reduxjs/toolkit'
import type { UserJourneyReduxState } from './user-journey-slice'
import type {
  UserJourneyStep,
  JourneyProgress,
  UserJourneyData,
  StepMetrics,
  AnalyticsEvent
} from '../../../processes/user-journey/types'

import {
  calculateProgress,
  getNextAllowedStep,
  calculateWeightedProgress,
  validateStepTransition,
  USER_JOURNEY_STEPS
} from '../../../processes/user-journey'

// FSD 준수: entities는 app을 import하지 않음
// 대신 generic 타입으로 상태 형태 정의
export interface StateWithUserJourney {
  userJourney: UserJourneyReduxState
}

// === 기본 선택자들 ===

/**
 * 전체 UserJourney 상태 선택
 */
export const selectUserJourneyState = (state: StateWithUserJourney) => state.userJourney

/**
 * 현재 활성 여정 선택
 */
export const selectCurrentJourney = (state: StateWithUserJourney) => state.userJourney.currentJourney

/**
 * 현재 단계 선택
 */
export const selectCurrentStep = (state: StateWithUserJourney) =>
  state.userJourney.currentJourney?.currentStep || null

/**
 * 현재 페이지 상태 선택
 */
export const selectCurrentPageState = (state: StateWithUserJourney) =>
  state.userJourney.currentJourney?.currentPageState || 'loading'

/**
 * 완료된 단계들 선택
 */
export const selectCompletedSteps = (state: StateWithUserJourney) =>
  state.userJourney.currentJourney?.completedSteps || []

/**
 * 저장된 데이터 선택
 */
export const selectPersistedData = (state: StateWithUserJourney) =>
  state.userJourney.currentJourney?.persistedData || {
    auth: {},
    scenario: {},
    planning: {},
    video: {},
    feedback: {},
    project: {}
  }

/**
 * 여정 오류들 선택
 */
export const selectJourneyErrors = (state: StateWithUserJourney) =>
  state.userJourney.currentJourney?.errors || []

/**
 * 여정 설정 선택
 */
export const selectJourneyConfig = (state: StateWithUserJourney) => state.userJourney.config

/**
 * 분석 버퍼 선택
 */
export const selectAnalyticsBuffer = (state: StateWithUserJourney) => state.userJourney.analyticsBuffer

/**
 * 성능 메트릭 선택
 */
export const selectPerformanceMetrics = (state: StateWithUserJourney) => state.userJourney.performanceMetrics

/**
 * 여정 히스토리 선택
 */
export const selectJourneyHistory = (state: StateWithUserJourney) => state.userJourney.journeyHistory

/**
 * 로딩 상태 선택
 */
export const selectIsJourneyLoading = (state: StateWithUserJourney) => state.userJourney.isLoading

/**
 * 오류 상태 선택
 */
export const selectJourneyError = (state: StateWithUserJourney) => state.userJourney.error

/**
 * 마지막 동기화 시간 선택
 */
export const selectLastSyncedAt = (state: StateWithUserJourney) => state.userJourney.lastSyncedAt

// === 계산된 선택자들 (메모이제이션) ===

/**
 * 현재 진행률 계산
 */
export const selectJourneyProgress = createSelector(
  [selectCurrentJourney],
  (currentJourney): JourneyProgress => {
    if (!currentJourney) {
      return {
        totalSteps: USER_JOURNEY_STEPS.length,
        completedSteps: 0,
        currentStepIndex: 0,
        progressPercentage: 0,
        phaseProgress: {
          auth: 0,
          scenario: 0,
          planning: 0,
          video: 0,
          feedback: 0
        }
      }
    }

    return calculateProgress(currentJourney)
  }
)

/**
 * 가중치를 고려한 진행률 계산
 */
export const selectWeightedProgress = createSelector(
  [selectCompletedSteps],
  (completedSteps): number => {
    return calculateWeightedProgress(completedSteps)
  }
)

/**
 * 다음 허용된 단계 계산
 */
export const selectNextAllowedStep = createSelector(
  [selectCurrentStep, selectCurrentJourney],
  (currentStep, currentJourney): UserJourneyStep | null => {
    if (!currentStep || !currentJourney) return null
    return getNextAllowedStep(currentStep, currentJourney)
  }
)

/**
 * 현재 단계의 검증 결과
 */
export const selectCurrentStepValidation = createSelector(
  [selectCurrentStep, selectNextAllowedStep, selectCurrentJourney],
  (currentStep, nextStep, currentJourney) => {
    if (!currentStep || !nextStep || !currentJourney) {
      return {
        isValid: false,
        requiredData: [],
        missingData: [],
        warnings: [],
        errors: ['활성화된 여정이 없습니다'],
        canProceed: false
      }
    }

    return validateStepTransition(currentStep, nextStep, currentJourney)
  }
)

/**
 * 특정 데이터 키 선택자 팩토리
 */
export const createDataSelector = <T>(key: keyof UserJourneyData) =>
  createSelector(
    [selectPersistedData],
    (persistedData): T => (persistedData[key] as T) || ({} as T)
  )

/**
 * 인증 데이터 선택
 */
export const selectAuthData = createDataSelector<UserJourneyData['auth']>('auth')

/**
 * 시나리오 데이터 선택
 */
export const selectScenarioData = createDataSelector<UserJourneyData['scenario']>('scenario')

/**
 * 기획 데이터 선택
 */
export const selectPlanningData = createDataSelector<UserJourneyData['planning']>('planning')

/**
 * 영상 데이터 선택
 */
export const selectVideoData = createDataSelector<UserJourneyData['video']>('video')

/**
 * 피드백 데이터 선택
 */
export const selectFeedbackData = createDataSelector<UserJourneyData['feedback']>('feedback')

/**
 * 프로젝트 데이터 선택
 */
export const selectProjectData = createDataSelector<UserJourneyData['project']>('project')

/**
 * 현재 단계의 Phase 계산
 */
export const selectCurrentPhase = createSelector(
  [selectCurrentStep],
  (currentStep): string => {
    if (!currentStep) return 'none'

    if (currentStep.startsWith('auth-')) return 'auth'
    if (currentStep.startsWith('scenario-')) return 'scenario'
    if (currentStep.startsWith('planning-')) return 'planning'
    if (currentStep.startsWith('video-')) return 'video'
    if (currentStep.startsWith('feedback-') || currentStep === 'project-completion') return 'feedback'

    return 'unknown'
  }
)

/**
 * 현재 Phase의 진행률 계산
 */
export const selectCurrentPhaseProgress = createSelector(
  [selectJourneyProgress, selectCurrentPhase],
  (progress, currentPhase) => {
    if (currentPhase === 'none' || currentPhase === 'unknown') return 0
    return progress.phaseProgress[currentPhase as keyof typeof progress.phaseProgress] || 0
  }
)

/**
 * 여정 완료 여부
 */
export const selectIsJourneyCompleted = createSelector(
  [selectCompletedSteps],
  (completedSteps): boolean => {
    return completedSteps.includes('project-completion')
  }
)

/**
 * 여정 활성 여부
 */
export const selectIsJourneyActive = createSelector(
  [selectCurrentJourney],
  (currentJourney): boolean => {
    return currentJourney !== null
  }
)

/**
 * 최근 오류 (최대 5개)
 */
export const selectRecentErrors = createSelector(
  [selectJourneyErrors],
  (errors) => {
    return errors.slice(-5).reverse() // 최신 순으로 정렬
  }
)

/**
 * 단계별 오류 카운트
 */
export const selectErrorsByStep = createSelector(
  [selectJourneyErrors],
  (errors) => {
    return errors.reduce((acc, error) => {
      acc[error.step] = (acc[error.step] || 0) + 1
      return acc
    }, {} as Record<UserJourneyStep, number>)
  }
)

/**
 * 분석 이벤트 통계
 */
export const selectAnalyticsStats = createSelector(
  [selectAnalyticsBuffer],
  (analyticsBuffer) => {
    const stats = {
      totalEvents: analyticsBuffer.length,
      eventsByType: {} as Record<string, number>,
      eventsByStep: {} as Record<UserJourneyStep, number>,
      recentEvents: analyticsBuffer.slice(-10).reverse()
    }

    analyticsBuffer.forEach(event => {
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1
      stats.eventsByStep[event.step] = (stats.eventsByStep[event.step] || 0) + 1
    })

    return stats
  }
)

/**
 * 세션 메타데이터
 */
export const selectSessionMetadata = createSelector(
  [selectCurrentJourney],
  (currentJourney) => {
    if (!currentJourney) return null

    return {
      sessionId: currentJourney.sessionId,
      startedAt: currentJourney.startedAt,
      lastActivityAt: currentJourney.lastActivityAt,
      duration: Date.now() - currentJourney.startedAt.getTime(),
      version: currentJourney.metadata.version,
      userAgent: currentJourney.metadata.userAgent,
      deviceInfo: currentJourney.metadata.deviceInfo
    }
  }
)

/**
 * 예상 완료 시간 계산
 */
export const selectEstimatedCompletionTime = createSelector(
  [selectCurrentStep, selectJourneyProgress],
  (currentStep, progress) => {
    if (!currentStep || progress.progressPercentage >= 100) return null

    // 간단한 추정: 남은 단계 수 * 평균 단계 시간
    const remainingSteps = progress.totalSteps - progress.completedSteps
    const averageStepTime = 3 * 60 * 1000 // 3분 (밀리초)
    const estimatedTime = remainingSteps * averageStepTime

    return new Date(Date.now() + estimatedTime)
  }
)

/**
 * 여정 요약 정보
 */
export const selectJourneySummary = createSelector(
  [
    selectCurrentStep,
    selectJourneyProgress,
    selectWeightedProgress,
    selectIsJourneyCompleted,
    selectSessionMetadata,
    selectRecentErrors
  ],
  (currentStep, progress, weightedProgress, isCompleted, sessionMetadata, recentErrors) => {
    return {
      currentStep,
      progress,
      weightedProgress,
      isCompleted,
      sessionMetadata,
      hasRecentErrors: recentErrors.length > 0,
      errorCount: recentErrors.length,
      status: isCompleted
        ? 'completed'
        : recentErrors.length > 0
        ? 'error'
        : progress.progressPercentage > 0
        ? 'in-progress'
        : 'not-started'
    }
  }
)

/**
 * 디버그 정보 (개발 환경 전용)
 */
export const selectDebugInfo = createSelector(
  [selectUserJourneyState],
  (userJourneyState) => {
    if (process.env.NODE_ENV !== 'development') {
      return null
    }

    return {
      state: userJourneyState,
      stateSize: JSON.stringify(userJourneyState).length,
      lastSyncedAt: userJourneyState.lastSyncedAt,
      bufferSize: userJourneyState.analyticsBuffer.length,
      historySize: userJourneyState.journeyHistory.length
    }
  }
)

// === 조건부 선택자 팩토리 ===

/**
 * 특정 단계 완료 여부 확인 선택자 팩토리
 */
export const createStepCompletedSelector = (step: UserJourneyStep) =>
  createSelector(
    [selectCompletedSteps],
    (completedSteps): boolean => completedSteps.includes(step)
  )

/**
 * 특정 Phase 완료 여부 확인 선택자 팩토리
 */
export const createPhaseCompletedSelector = (phase: string) =>
  createSelector(
    [selectCompletedSteps],
    (completedSteps): boolean => {
      const phaseSteps = USER_JOURNEY_STEPS.filter(step => step.startsWith(phase))
      return phaseSteps.every(step => completedSteps.includes(step))
    }
  )

/**
 * 특정 데이터 존재 여부 확인 선택자 팩토리
 */
export const createDataExistsSelector = (key: keyof UserJourneyData, field?: string) =>
  createSelector(
    [selectPersistedData],
    (persistedData): boolean => {
      const data = persistedData[key]
      if (!data) return false
      if (!field) return Object.keys(data).length > 0
      return (data as any)[field] !== undefined && (data as any)[field] !== null
    }
  )

// === 권한 및 접근 제어 선택자 ===

/**
 * 특정 단계 접근 가능 여부
 */
export const createCanAccessStepSelector = (targetStep: UserJourneyStep) =>
  createSelector(
    [selectCurrentStep, selectCurrentJourney],
    (currentStep, currentJourney): boolean => {
      if (!currentStep || !currentJourney) return false

      const validation = validateStepTransition(currentStep, targetStep, currentJourney)
      return validation.canProceed
    }
  )