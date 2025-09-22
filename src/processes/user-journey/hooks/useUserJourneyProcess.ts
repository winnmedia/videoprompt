/**
 * UserJourney Process Hook
 *
 * FSD processes 레이어 - UserJourney 상태 관리 훅
 * CLAUDE.md 준수: React 19 훅 규칙, 타입 안전성
 */

import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useUserJourneyContext } from '../orchestrator'
import type {
  UserJourneyStep,
  JourneyProgress,
  StepValidationResult,
  UserJourneyData,
  JourneyError
} from '../types'

import {
  validateStepTransition,
  calculateProgress,
  getNextAllowedStep,
  createAnalyticsEvent,
  createJourneyError
} from '../utils'

import { logger } from '../../../shared/lib/logger'

/**
 * UserJourney 프로세스 관리 훅
 * 전체 22단계 여정의 상태와 진행을 관리
 */
export function useUserJourneyProcess() {
  const context = useUserJourneyContext()
  const { state, dispatch, navigation, data, analytics } = context

  // 성능 추적을 위한 ref
  const stepStartTimeRef = useRef<Date | null>(null)

  // 현재 진행률 계산
  const progress = useMemo((): JourneyProgress => {
    return calculateProgress(state)
  }, [state])

  // 다음 단계 정보
  const nextStep = useMemo((): UserJourneyStep | null => {
    return getNextAllowedStep(state.currentStep, state)
  }, [state.currentStep, state])

  // 현재 단계 검증
  const currentStepValidation = useMemo((): StepValidationResult => {
    const nextStepToValidate = nextStep || state.currentStep
    return validateStepTransition(state.currentStep, nextStepToValidate, state)
  }, [state.currentStep, nextStep, state])

  // 단계 시작
  const startStep = useCallback((step: UserJourneyStep) => {
    stepStartTimeRef.current = new Date()

    dispatch({
      type: 'UPDATE_PROGRESS',
      payload: { step, progress: 0 }
    })

    analytics.track(createAnalyticsEvent(
      'step_started',
      step,
      state.sessionId,
      { startTime: stepStartTimeRef.current },
      state.persistedData.auth.userId
    ))

    logger.info('Step started', {
      step,
      sessionId: state.sessionId,
      userJourneyStep: step
    })
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 단계 완료
  const completeStep = useCallback((
    step: UserJourneyStep,
    stepData?: Partial<UserJourneyData>
  ) => {
    const endTime = new Date()
    const duration = stepStartTimeRef.current
      ? endTime.getTime() - stepStartTimeRef.current.getTime()
      : 0

    dispatch({
      type: 'COMPLETE_STEP',
      payload: { step, data: stepData }
    })

    analytics.track(createAnalyticsEvent(
      'step_completed',
      step,
      state.sessionId,
      {
        duration,
        endTime,
        stepData: stepData ? Object.keys(stepData) : []
      },
      state.persistedData.auth.userId
    ))

    logger.info('Step completed', {
      step,
      duration,
      sessionId: state.sessionId,
      userJourneyStep: step
    })

    // 성능 메트릭 측정
    analytics.measure(`step_duration_${step}`, duration)
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 단계 실패 처리
  const failStep = useCallback((
    step: UserJourneyStep,
    error: string | Error,
    context?: Record<string, any>
  ) => {
    const journeyError = createJourneyError(
      step,
      'STEP_FAILED',
      typeof error === 'string' ? error : error.message,
      'error',
      context
    )

    dispatch({
      type: 'FAIL_STEP',
      payload: { step, error: journeyError }
    })

    analytics.track(createAnalyticsEvent(
      'step_failed',
      step,
      state.sessionId,
      {
        error: journeyError.message,
        context: journeyError.context
      },
      state.persistedData.auth.userId
    ))

    logger.error('Step failed', {
      step,
      error: journeyError.message,
      sessionId: state.sessionId,
      userJourneyStep: step
    })
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 단계 진행률 업데이트
  const updateStepProgress = useCallback((
    step: UserJourneyStep,
    progress: number
  ) => {
    dispatch({
      type: 'UPDATE_PROGRESS',
      payload: { step, progress }
    })

    // 25%, 50%, 75% 마일스톤에서 분석 이벤트 발생
    if ([25, 50, 75].includes(progress)) {
      analytics.track(createAnalyticsEvent(
        'step_started', // 진행률 업데이트는 step_started 타입으로 추적
        step,
        state.sessionId,
        { progress, milestone: `${progress}%` },
        state.persistedData.auth.userId
      ))
    }
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 데이터 저장
  const persistStepData = useCallback((
    key: string,
    value: any
  ) => {
    data.persist(key, value)

    analytics.track(createAnalyticsEvent(
      'data_persisted',
      state.currentStep,
      state.sessionId,
      { key, valueType: typeof value },
      state.persistedData.auth.userId
    ))
  }, [data, analytics, state.currentStep, state.sessionId, state.persistedData.auth.userId])

  // 단계 건너뛰기
  const skipStep = useCallback((
    step: UserJourneyStep,
    reason: string
  ) => {
    dispatch({
      type: 'COMPLETE_STEP',
      payload: { step }
    })

    analytics.track(createAnalyticsEvent(
      'step_skipped',
      step,
      state.sessionId,
      { reason },
      state.persistedData.auth.userId
    ))

    logger.info('Step skipped', {
      step,
      reason,
      sessionId: state.sessionId,
      userJourneyStep: step
    })
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 오류에서 복구
  const recoverFromError = useCallback((
    error: JourneyError,
    strategy: string
  ) => {
    dispatch({
      type: 'RECOVER_FROM_ERROR',
      payload: { error, strategy }
    })

    analytics.track(createAnalyticsEvent(
      'recovery_attempted',
      error.step,
      state.sessionId,
      {
        errorCode: error.code,
        strategy,
        attempt: state.recoveryAttempts + 1
      },
      state.persistedData.auth.userId
    ))

    logger.info('Recovery attempted', {
      errorCode: error.code,
      strategy,
      step: error.step,
      sessionId: state.sessionId
    })
  }, [dispatch, analytics, state.sessionId, state.recoveryAttempts, state.persistedData.auth.userId])

  // 여정 재시작
  const restartJourney = useCallback((keepData: boolean = false) => {
    dispatch({
      type: 'RESET_JOURNEY',
      payload: { keepData }
    })

    analytics.track(createAnalyticsEvent(
      'step_started', // 여정 재시작도 step_started로 추적
      'auth-login',
      state.sessionId,
      { restart: true, keepData },
      state.persistedData.auth.userId
    ))

    logger.info('Journey restarted', {
      keepData,
      sessionId: state.sessionId
    })
  }, [dispatch, analytics, state.sessionId, state.persistedData.auth.userId])

  // 자동 진행률 추적 (현재 단계가 변경될 때)
  useEffect(() => {
    startStep(state.currentStep)
  }, [state.currentStep]) // startStep을 의존성에서 제외하여 무한 루프 방지

  // 세션 활동 추적
  useEffect(() => {
    const interval = setInterval(() => {
      analytics.track(createAnalyticsEvent(
        'step_started', // 활동 추적도 step_started로 분류
        state.currentStep,
        state.sessionId,
        { type: 'heartbeat' },
        state.persistedData.auth.userId
      ))
    }, 60000) // 1분마다

    return () => clearInterval(interval)
  }, [state.currentStep, state.sessionId, analytics, state.persistedData.auth.userId])

  return {
    // 상태
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    progress,
    nextStep,
    validation: currentStepValidation,
    errors: state.errors,
    isLoading: state.currentPageState === 'loading',

    // 액션
    startStep,
    completeStep,
    failStep,
    updateStepProgress,
    skipStep,
    persistStepData,
    recoverFromError,
    restartJourney,

    // 네비게이션
    canNavigateTo: navigation.canNavigateTo,
    navigateTo: navigation.navigateTo,
    goBack: navigation.goBack,
    goNext: navigation.goNext,

    // 데이터
    getData: data.retrieve,
    setData: data.persist,
    clearData: data.clear,
    allData: state.persistedData,

    // 메타데이터
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    lastActivityAt: state.lastActivityAt,
    metadata: state.metadata
  }
}

export default useUserJourneyProcess