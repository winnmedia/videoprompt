/**
 * UserJourney Orchestrator
 *
 * FSD processes 레이어 - 전체 UserJourneyMap 22단계 오케스트레이션
 * CLAUDE.md 준수: 비즈니스 프로세스 관리, React 19
 */

'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'

import type {
  UserJourneyState,
  UserJourneyStep,
  JourneyAction,
  JourneyContext,
  JourneyConfig,
  JourneyProgress,
  JourneyError,
  AnalyticsEvent,
  UserJourneyData
} from './types'

import {
  USER_JOURNEY_STEPS,
  STEP_REQUIREMENTS,
  NAVIGATION_RULES,
  DEFAULT_JOURNEY_CONFIG
} from './config'

import { logger } from '../../shared/lib/logger'

/**
 * UserJourney 상태 리듀서
 */
function userJourneyReducer(state: UserJourneyState, action: JourneyAction): UserJourneyState {
  switch (action.type) {
    case 'START_JOURNEY': {
      const sessionId = `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return {
        ...state,
        sessionId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        currentStep: 'auth-login',
        persistedData: {
          ...state.persistedData,
          auth: {
            ...state.persistedData.auth,
            userId: action.payload.userId
          }
        }
      }
    }

    case 'NAVIGATE_TO_STEP': {
      const { step, force = false } = action.payload

      // 강제 이동이 아닌 경우 네비게이션 가드 검증
      if (!force) {
        const guard = NAVIGATION_RULES.find(rule =>
          rule.from === state.currentStep && rule.to === step
        )

        if (guard && !guard.condition(state)) {
          logger.warn('Navigation blocked by guard', {
            from: state.currentStep,
            to: step,
            reason: guard.errorMessage
          })
          return state
        }
      }

      return {
        ...state,
        currentStep: step,
        lastActivityAt: new Date(),
        currentPageState: 'loading'
      }
    }

    case 'COMPLETE_STEP': {
      const { step, data } = action.payload
      const newCompletedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step]

      return {
        ...state,
        completedSteps: newCompletedSteps,
        stepProgress: {
          ...state.stepProgress,
          [step]: {
            ...state.stepProgress[step],
            status: 'completed',
            completedAt: new Date(),
            duration: state.stepProgress[step]?.startedAt
              ? Date.now() - state.stepProgress[step].startedAt!.getTime()
              : 0
          }
        },
        persistedData: data ? { ...state.persistedData, ...data } : state.persistedData,
        lastActivityAt: new Date()
      }
    }

    case 'FAIL_STEP': {
      const { step, error } = action.payload

      return {
        ...state,
        stepProgress: {
          ...state.stepProgress,
          [step]: {
            ...state.stepProgress[step],
            status: 'failed',
            attempts: (state.stepProgress[step]?.attempts || 0) + 1
          }
        },
        errors: [...state.errors, error],
        lastActivityAt: new Date()
      }
    }

    case 'UPDATE_PROGRESS': {
      const { step, progress } = action.payload

      return {
        ...state,
        stepProgress: {
          ...state.stepProgress,
          [step]: {
            ...state.stepProgress[step],
            status: progress === 100 ? 'completed' : 'in-progress',
            subSteps: state.stepProgress[step]?.subSteps || []
          }
        },
        lastActivityAt: new Date()
      }
    }

    case 'PERSIST_DATA': {
      const { key, value } = action.payload

      return {
        ...state,
        persistedData: {
          ...state.persistedData,
          [key]: value
        },
        lastActivityAt: new Date()
      }
    }

    case 'RECOVER_FROM_ERROR': {
      const { error, strategy } = action.payload

      return {
        ...state,
        recoveryAttempts: state.recoveryAttempts + 1,
        errors: state.errors.filter(e => e !== error),
        lastActivityAt: new Date()
      }
    }

    case 'RESET_JOURNEY': {
      const { keepData = false } = action.payload || {}

      return {
        ...initialUserJourneyState,
        persistedData: keepData ? state.persistedData : initialUserJourneyState.persistedData
      }
    }

    default:
      return state
  }
}

/**
 * 초기 UserJourney 상태
 */
const initialUserJourneyState: UserJourneyState = {
  currentStep: 'auth-login',
  currentPageState: 'loading',
  completedSteps: [],
  stepProgress: {},
  overallProgress: {
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
  },
  sessionId: '',
  startedAt: new Date(),
  lastActivityAt: new Date(),
  persistedData: {
    auth: {},
    scenario: {},
    planning: {},
    video: {},
    feedback: {},
    project: {}
  },
  errors: [],
  recoveryAttempts: 0,
  metadata: {
    version: '1.0.0',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceInfo: {
      type: 'desktop',
      os: 'unknown',
      browser: 'unknown'
    },
    experiments: {},
    recommendations: [],
    performance: {
      loadTimes: {},
      apiCallCounts: {},
      errorRates: {}
    }
  }
}

/**
 * UserJourney Context
 */
const UserJourneyContext = createContext<JourneyContext | null>(null)

/**
 * UserJourney Orchestrator Props
 */
interface UserJourneyOrchestratorProps {
  children: React.ReactNode
  config?: Partial<JourneyConfig>
  onStepChange?: (from: UserJourneyStep, to: UserJourneyStep) => void
  onProgressUpdate?: (progress: JourneyProgress) => void
  onError?: (error: JourneyError) => void
  onCompletion?: (state: UserJourneyState) => void
}

/**
 * UserJourney Orchestrator Component
 * 전체 22단계 UserJourneyMap을 오케스트레이션하는 최상위 프로세스
 */
export function UserJourneyOrchestrator({
  children,
  config: customConfig,
  onStepChange,
  onProgressUpdate,
  onError,
  onCompletion
}: UserJourneyOrchestratorProps) {
  const router = useRouter()
  const reduxDispatch = useDispatch<AppDispatch>()

  // 설정 병합
  const config = useMemo(() => ({
    ...DEFAULT_JOURNEY_CONFIG,
    ...customConfig
  }), [customConfig])

  // UserJourney 상태 관리
  const [state, dispatch] = useReducer(userJourneyReducer, initialUserJourneyState)

  // Redux 상태에서 필요한 데이터 추출
  const isAuthenticated = useSelector((state: RootState) =>
    state.auth?.status === 'authenticated'
  )

  // 전체 진행률 계산
  const overallProgress = useMemo((): JourneyProgress => {
    const currentStepIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)
    const completedSteps = state.completedSteps.length
    const progressPercentage = Math.round((completedSteps / USER_JOURNEY_STEPS.length) * 100)

    // Phase별 진행률 계산
    const phaseProgress = {
      auth: calculatePhaseProgress('auth', state.completedSteps),
      scenario: calculatePhaseProgress('scenario', state.completedSteps),
      planning: calculatePhaseProgress('planning', state.completedSteps),
      video: calculatePhaseProgress('video', state.completedSteps),
      feedback: calculatePhaseProgress('feedback', state.completedSteps)
    }

    return {
      totalSteps: USER_JOURNEY_STEPS.length,
      completedSteps,
      currentStepIndex,
      progressPercentage,
      phaseProgress
    }
  }, [state.completedSteps, state.currentStep])

  // Phase별 진행률 계산 헬퍼
  function calculatePhaseProgress(phase: string, completedSteps: UserJourneyStep[]): number {
    const phaseSteps = USER_JOURNEY_STEPS.filter(step => step.startsWith(phase))
    const completedPhaseSteps = completedSteps.filter(step => step.startsWith(phase))
    return phaseSteps.length > 0 ? Math.round((completedPhaseSteps.length / phaseSteps.length) * 100) : 0
  }

  // 네비게이션 헬퍼
  const navigation = useMemo(() => ({
    canNavigateTo: (step: UserJourneyStep): boolean => {
      const guard = NAVIGATION_RULES.find(rule =>
        rule.from === state.currentStep && rule.to === step
      )
      return !guard || guard.condition(state)
    },

    navigateTo: async (step: UserJourneyStep): Promise<boolean> => {
      try {
        dispatch({ type: 'NAVIGATE_TO_STEP', payload: { step } })

        // 페이지 라우팅
        const pageRoute = getPageRouteForStep(step)
        if (pageRoute) {
          router.push(pageRoute)
        }

        // 단계 변경 이벤트 발생
        onStepChange?.(state.currentStep, step)

        // 분석 이벤트 추적
        trackAnalyticsEvent({
          type: 'step_started',
          step,
          timestamp: new Date(),
          data: { previousStep: state.currentStep },
          sessionId: state.sessionId
        })

        return true
      } catch (error) {
        logger.error('Navigation failed', { from: state.currentStep, to: step, error })
        return false
      }
    },

    goBack: () => {
      const currentIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)
      if (currentIndex > 0) {
        const previousStep = USER_JOURNEY_STEPS[currentIndex - 1]
        navigation.navigateTo(previousStep)
      }
    },

    goNext: () => {
      const currentIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)
      if (currentIndex < USER_JOURNEY_STEPS.length - 1) {
        const nextStep = USER_JOURNEY_STEPS[currentIndex + 1]
        navigation.navigateTo(nextStep)
      }
    }
  }), [state.currentStep, router, onStepChange])

  // 데이터 관리 헬퍼
  const dataManager = useMemo(() => ({
    persist: (key: string, value: any) => {
      dispatch({ type: 'PERSIST_DATA', payload: { key, value } })

      // 로컬 스토리지에도 저장 (선택적)
      if (config.session.persistBetweenSessions) {
        try {
          localStorage.setItem(`userjourney_${state.sessionId}_${key}`, JSON.stringify(value))
        } catch (error) {
          logger.warn('Failed to persist to localStorage', { key, error })
        }
      }
    },

    retrieve: (key: string): any => {
      // 메모리에서 우선 조회
      const memoryValue = (state.persistedData as any)[key]
      if (memoryValue !== undefined) {
        return memoryValue
      }

      // 로컬 스토리지에서 조회
      if (config.session.persistBetweenSessions) {
        try {
          const storedValue = localStorage.getItem(`userjourney_${state.sessionId}_${key}`)
          return storedValue ? JSON.parse(storedValue) : undefined
        } catch (error) {
          logger.warn('Failed to retrieve from localStorage', { key, error })
        }
      }

      return undefined
    },

    clear: (key?: string) => {
      if (key) {
        dispatch({ type: 'PERSIST_DATA', payload: { key, value: undefined } })
        localStorage.removeItem(`userjourney_${state.sessionId}_${key}`)
      } else {
        dispatch({ type: 'RESET_JOURNEY', payload: { keepData: false } })
        // Clear all localStorage keys for this session
        Object.keys(localStorage).forEach(storageKey => {
          if (storageKey.startsWith(`userjourney_${state.sessionId}_`)) {
            localStorage.removeItem(storageKey)
          }
        })
      }
    }
  }), [state.sessionId, state.persistedData, config.session.persistBetweenSessions])

  // 분석 이벤트 추적
  const trackAnalyticsEvent = useCallback((event: AnalyticsEvent) => {
    if (!config.analytics.enabled) return

    dispatch({ type: 'TRACK_EVENT', payload: { event } })

    // 실제 분석 서비스로 전송 (예: Google Analytics, Mixpanel 등)
    logger.info('Analytics event', event)
  }, [config.analytics.enabled])

  // 분석 헬퍼
  const analytics = useMemo(() => ({
    track: trackAnalyticsEvent,
    measure: (metric: string, value: number) => {
      trackAnalyticsEvent({
        type: 'performance_measured',
        step: state.currentStep,
        timestamp: new Date(),
        data: { metric, value },
        sessionId: state.sessionId
      })
    }
  }), [trackAnalyticsEvent, state.currentStep, state.sessionId])

  // 컨텍스트 값 구성
  const contextValue: JourneyContext = useMemo(() => ({
    state,
    config,
    dispatch,
    navigation,
    data: dataManager,
    analytics
  }), [state, config, navigation, dataManager, analytics])

  // 자동 저장 설정
  useEffect(() => {
    if (!config.autoSave.enabled) return

    const interval = setInterval(() => {
      // 상태를 로컬 스토리지에 저장
      try {
        localStorage.setItem(`userjourney_state_${state.sessionId}`, JSON.stringify(state))
      } catch (error) {
        logger.warn('Auto-save failed', { error })
      }
    }, config.autoSave.interval)

    return () => clearInterval(interval)
  }, [config.autoSave.enabled, config.autoSave.interval, state])

  // 세션 타임아웃 관리
  useEffect(() => {
    if (!config.session.timeout) return

    const timeout = setTimeout(() => {
      logger.warn('Session timeout', { sessionId: state.sessionId })
      // 세션 만료 처리
    }, config.session.timeout)

    return () => clearTimeout(timeout)
  }, [config.session.timeout, state.sessionId, state.lastActivityAt])

  // 진행률 업데이트 알림
  useEffect(() => {
    onProgressUpdate?.(overallProgress)
  }, [overallProgress, onProgressUpdate])

  // 프로젝트 완료 감지
  useEffect(() => {
    if (state.currentStep === 'project-completion' &&
        state.completedSteps.includes('project-completion')) {
      onCompletion?.(state)

      trackAnalyticsEvent({
        type: 'step_completed',
        step: 'project-completion',
        timestamp: new Date(),
        data: {
          totalDuration: Date.now() - state.startedAt.getTime(),
          totalSteps: state.completedSteps.length
        },
        sessionId: state.sessionId
      })
    }
  }, [state.currentStep, state.completedSteps, state.startedAt, state.sessionId, onCompletion, trackAnalyticsEvent])

  // 인증 상태 변경 감지
  useEffect(() => {
    if (isAuthenticated && state.currentStep === 'auth-login') {
      dispatch({ type: 'COMPLETE_STEP', payload: { step: 'auth-login' } })
      navigation.navigateTo('auth-verification')
    }
  }, [isAuthenticated, state.currentStep, navigation])

  return (
    <UserJourneyContext.Provider value={contextValue}>
      {children}
    </UserJourneyContext.Provider>
  )
}

/**
 * UserJourney Context Hook
 */
export function useUserJourneyContext(): JourneyContext {
  const context = useContext(UserJourneyContext)
  if (!context) {
    throw new Error('useUserJourneyContext must be used within UserJourneyOrchestrator')
  }
  return context
}

/**
 * 단계에 따른 페이지 라우트 매핑
 */
function getPageRouteForStep(step: UserJourneyStep): string {
  if (step.startsWith('auth-')) return '/login'
  if (step.startsWith('scenario-')) return '/scenario'
  if (step.startsWith('planning-')) return '/planning'
  if (step.startsWith('video-')) return '/video-generator'
  if (step.startsWith('feedback-') || step === 'project-completion') return '/feedback'
  return '/'
}

export default UserJourneyOrchestrator