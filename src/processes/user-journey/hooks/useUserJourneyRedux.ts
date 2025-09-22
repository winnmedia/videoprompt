/**
 * UserJourney Redux Integration Hook
 *
 * FSD processes 레이어 - Redux 상태와 오케스트레이터 통합 훅
 * CLAUDE.md 준수: React 19 훅 규칙, Redux Toolkit 2.0, 비용 안전
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { useUserJourneyContext } from '../orchestrator'
import {
  UserJourneyRedux,
  selectCurrentStep,
  selectCurrentJourney,
  selectJourneyProgress,
  selectIsJourneyLoading,
  selectJourneyError,
  selectSessionMetadata,
  selectJourneySummary,
  selectCompletedSteps,
  selectPersistedData,
  selectJourneyConfig,
  type UserJourneyStep,
  type UserJourneyData
} from '../../../entities/user-journey'

import type {
  UserJourneyState,
  JourneyProgress,
  StepValidationResult
} from '../types'

import { logger } from '../../../shared/lib/logger'

/**
 * UserJourney Redux 통합 관리 훅
 *
 * Redux 상태와 React Context 오케스트레이터를 통합하여
 * 완전한 UserJourney 관리 기능을 제공합니다.
 *
 * 특징:
 * - Redux 상태 관리와 Context 오케스트레이션 통합
 * - 자동 상태 동기화
 * - 비용 안전 규칙 준수 ($300 사건 방지)
 * - 22단계 UserJourneyMap 완전 지원
 */
export function useUserJourneyRedux() {
  const dispatch = useAppDispatch()

  // Redux 상태 선택자들
  const currentStep = useAppSelector(selectCurrentStep)
  const currentJourney = useAppSelector(selectCurrentJourney)
  const journeyProgress = useAppSelector(selectJourneyProgress)
  const isLoading = useAppSelector(selectIsJourneyLoading)
  const error = useAppSelector(selectJourneyError)
  const sessionMetadata = useAppSelector(selectSessionMetadata)
  const journeySummary = useAppSelector(selectJourneySummary)
  const completedSteps = useAppSelector(selectCompletedSteps)
  const persistedData = useAppSelector(selectPersistedData)
  const config = useAppSelector(selectJourneyConfig)

  // Context 오케스트레이터 (선택적 사용)
  const contextOrchestrator = useUserJourneyContext()

  // 여정 시작 (Redux + Context 동기화)
  const startJourney = useCallback(async (userId?: string) => {
    try {
      logger.info('Starting UserJourney via Redux integration', {
        userId,
        userJourneyStep: 'journey-start-redux'
      })

      // Redux에서 여정 시작
      const result = await dispatch(UserJourneyRedux.actions.startUserJourney({ userId }))

      if (UserJourneyRedux.actions.startUserJourney.fulfilled.match(result)) {
        // Context 오케스트레이터와 동기화 (있는 경우)
        if (contextOrchestrator) {
          contextOrchestrator.dispatch({
            type: 'SYNC_WITH_REDUX',
            payload: { journey: result.payload }
          })
        }

        return { success: true, journey: result.payload }
      } else {
        throw new Error(result.payload as string)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '여정 시작 중 오류가 발생했습니다'
      logger.error('Failed to start UserJourney via Redux', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [dispatch, contextOrchestrator])

  // 단계 완료 (Redux + Context 동기화)
  const completeStep = useCallback(async (
    step: UserJourneyStep,
    data?: Partial<UserJourneyData>
  ) => {
    try {
      logger.info('Completing journey step via Redux integration', {
        step,
        userJourneyStep: step
      })

      // Redux에서 단계 완료
      const result = await dispatch(UserJourneyRedux.actions.completeJourneyStep({ step, data }))

      if (UserJourneyRedux.actions.completeJourneyStep.fulfilled.match(result)) {
        // Context 오케스트레이터와 동기화 (있는 경우)
        if (contextOrchestrator) {
          contextOrchestrator.dispatch({
            type: 'COMPLETE_STEP',
            payload: { step, data }
          })
        }

        return { success: true, journey: result.payload.updatedJourney }
      } else {
        throw new Error(result.payload as string)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '단계 완료 중 오류가 발생했습니다'
      logger.error('Failed to complete journey step via Redux', { error: errorMessage, step })
      return { success: false, error: errorMessage }
    }
  }, [dispatch, contextOrchestrator])

  // 단계 변경 (동기화)
  const setCurrentStep = useCallback((step: UserJourneyStep) => {
    logger.info('Setting current step via Redux integration', {
      step,
      userJourneyStep: step
    })

    dispatch(UserJourneyRedux.actions.setCurrentStep(step))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'NAVIGATE_TO_STEP',
        payload: { step }
      })
    }
  }, [dispatch, contextOrchestrator])

  // 데이터 저장 (동기화)
  const persistData = useCallback((key: string, value: any) => {
    logger.info('Persisting journey data via Redux integration', {
      key,
      userJourneyStep: currentStep || 'unknown'
    })

    dispatch(UserJourneyRedux.actions.persistJourneyData({ key, value }))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'PERSIST_DATA',
        payload: { [key]: value }
      })
    }
  }, [dispatch, contextOrchestrator, currentStep])

  // 페이지 상태 변경
  const setPageState = useCallback((state: 'loading' | 'ready' | 'processing' | 'completed' | 'error') => {
    dispatch(UserJourneyRedux.actions.setPageState(state))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'SET_PAGE_STATE',
        payload: { state }
      })
    }
  }, [dispatch, contextOrchestrator])

  // 여정 리셋
  const resetJourney = useCallback((keepData?: boolean) => {
    logger.info('Resetting UserJourney via Redux integration', {
      keepData,
      userJourneyStep: 'journey-reset'
    })

    dispatch(UserJourneyRedux.actions.resetCurrentJourney({ keepData }))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'RESET_JOURNEY',
        payload: { keepData }
      })
    }
  }, [dispatch, contextOrchestrator])

  // 분석 이벤트 플러시
  const flushAnalytics = useCallback(async () => {
    try {
      const result = await dispatch(UserJourneyRedux.actions.flushAnalyticsEvents())

      if (UserJourneyRedux.actions.flushAnalyticsEvents.fulfilled.match(result)) {
        logger.info('Analytics events flushed via Redux integration', {
          flushedCount: result.payload.flushedCount
        })
        return { success: true, flushedCount: result.payload.flushedCount }
      } else {
        throw new Error(result.payload as string)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '분석 이벤트 플러시 중 오류가 발생했습니다'
      logger.error('Failed to flush analytics events via Redux', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [dispatch])

  // 오류 추가
  const addError = useCallback((error: {
    step: UserJourneyStep
    message: string
    timestamp: Date
    context?: Record<string, any>
  }) => {
    dispatch(UserJourneyRedux.actions.addJourneyError(error))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'ADD_ERROR',
        payload: { error }
      })
    }
  }, [dispatch, contextOrchestrator])

  // 설정 업데이트
  const updateConfig = useCallback((configUpdate: Partial<any>) => {
    dispatch(UserJourneyRedux.actions.updateJourneyConfig(configUpdate))

    // Context와 동기화
    if (contextOrchestrator) {
      contextOrchestrator.dispatch({
        type: 'UPDATE_CONFIG',
        payload: { config: configUpdate }
      })
    }
  }, [dispatch, contextOrchestrator])

  // 오류 클리어
  const clearError = useCallback(() => {
    dispatch(UserJourneyRedux.actions.clearError())
  }, [dispatch])

  // 비용 안전: Redux와 Context 상태 동기화 감지
  useEffect(() => {
    if (contextOrchestrator && currentJourney) {
      const contextState = contextOrchestrator.state
      const reduxState = currentJourney

      // 상태 불일치 감지
      if (contextState.currentStep !== reduxState.currentStep) {
        logger.warn('State synchronization mismatch detected', {
          contextStep: contextState.currentStep,
          reduxStep: reduxState.currentStep,
          action: 'auto-sync-to-redux',
          userJourneyStep: 'state-sync-warning'
        })

        // Redux 상태를 우선으로 Context 동기화
        contextOrchestrator.dispatch({
          type: 'SYNC_WITH_REDUX',
          payload: { journey: reduxState }
        })
      }
    }
  }, [currentJourney, contextOrchestrator])

  // 여정 상태 요약 (계산된 값들)
  const journeyState = useMemo((): {
    isActive: boolean
    isCompleted: boolean
    currentPhase: string
    progressPercentage: number
    canProceedToNext: boolean
    validation: StepValidationResult | null
  } => {
    if (!currentJourney) {
      return {
        isActive: false,
        isCompleted: false,
        currentPhase: 'none',
        progressPercentage: 0,
        canProceedToNext: false,
        validation: null
      }
    }

    const isCompleted = completedSteps.includes('project-completion')
    const currentPhase = currentStep?.split('-')[0] || 'unknown'
    const progressPercentage = journeyProgress?.progressPercentage || 0

    // 간단한 검증 (실제로는 utils의 validateStepTransition 사용)
    const canProceedToNext = !isLoading && !error && currentStep !== null

    return {
      isActive: true,
      isCompleted,
      currentPhase,
      progressPercentage,
      canProceedToNext,
      validation: null // 필요시 validateStepTransition 호출
    }
  }, [currentJourney, completedSteps, currentStep, journeyProgress, isLoading, error])

  return {
    // 상태
    currentStep,
    currentJourney,
    journeyProgress,
    isLoading,
    error,
    sessionMetadata,
    journeySummary,
    completedSteps,
    persistedData,
    config,
    journeyState,

    // 액션들
    startJourney,
    completeStep,
    setCurrentStep,
    persistData,
    setPageState,
    resetJourney,
    flushAnalytics,
    addError,
    updateConfig,
    clearError,

    // 유틸리티
    isReduxOnly: !contextOrchestrator,
    hasContextOrchestrator: !!contextOrchestrator
  }
}

export default useUserJourneyRedux