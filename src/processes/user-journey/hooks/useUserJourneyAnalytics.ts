/**
 * UserJourney Analytics Hook
 *
 * FSD processes 레이어 - UserJourney 분석 및 추적 훅
 * CLAUDE.md 준수: React 19 훅 규칙, 성능 측정
 */

import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useUserJourneyContext } from '../orchestrator'
import type {
  UserJourneyStep,
  AnalyticsEvent,
  JourneyStats,
  StepMetrics
} from '../types'

import {
  createAnalyticsEvent,
  calculatePerformanceMetrics,
  calculateWeightedProgress
} from '../utils'

import { logger } from '../../../shared/lib/logger'

/**
 * 분석 이벤트 버퍼 관리
 */
class AnalyticsBuffer {
  private buffer: AnalyticsEvent[] = []
  private maxSize: number
  private flushCallback: (events: AnalyticsEvent[]) => void

  constructor(maxSize: number, flushCallback: (events: AnalyticsEvent[]) => void) {
    this.maxSize = maxSize
    this.flushCallback = flushCallback
  }

  add(event: AnalyticsEvent) {
    this.buffer.push(event)

    if (this.buffer.length >= this.maxSize) {
      this.flush()
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      this.flushCallback([...this.buffer])
      this.buffer = []
    }
  }

  getBufferSize() {
    return this.buffer.length
  }
}

/**
 * 성능 측정 유틸리티
 */
class PerformanceTracker {
  private measurements: Map<string, number> = new Map()
  private startTimes: Map<string, number> = new Map()

  startMeasurement(key: string) {
    this.startTimes.set(key, performance.now())
  }

  endMeasurement(key: string): number {
    const startTime = this.startTimes.get(key)
    if (!startTime) return 0

    const duration = performance.now() - startTime
    this.measurements.set(key, duration)
    this.startTimes.delete(key)

    return duration
  }

  getMeasurement(key: string): number {
    return this.measurements.get(key) || 0
  }

  getAllMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements)
  }

  clear() {
    this.measurements.clear()
    this.startTimes.clear()
  }
}

/**
 * UserJourney 분석 및 추적 훅
 * 성능 메트릭, 사용자 행동, 이탈 지점 등을 추적
 */
export function useUserJourneyAnalytics() {
  const context = useUserJourneyContext()
  const { state, config, analytics } = context

  // 분석 버퍼
  const bufferRef = useRef<AnalyticsBuffer | null>(null)
  const performanceTrackerRef = useRef<PerformanceTracker>(new PerformanceTracker())

  // 세션별 메트릭
  const sessionMetricsRef = useRef<{
    pageViews: number
    interactions: number
    errors: number
    apiCalls: number
    sessionStart: number
  }>({
    pageViews: 0,
    interactions: 0,
    errors: 0,
    apiCalls: 0,
    sessionStart: Date.now()
  })

  // 분석 버퍼 초기화
  useEffect(() => {
    if (config.analytics.enabled && !bufferRef.current) {
      bufferRef.current = new AnalyticsBuffer(
        config.analytics.bufferSize,
        (events) => {
          // 실제 분석 서비스로 전송
          sendAnalyticsEvents(events)
        }
      )
    }
  }, [config.analytics.enabled, config.analytics.bufferSize])

  // 분석 이벤트 전송 함수
  const sendAnalyticsEvents = useCallback(async (events: AnalyticsEvent[]) => {
    try {
      // 실제 구현에서는 Google Analytics, Mixpanel, 자체 분석 서버 등으로 전송
      logger.info('Analytics events sent', {
        eventCount: events.length,
        sessionId: state.sessionId
      })

      // 개발 환경에서는 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.group('📊 Analytics Events')
        events.forEach(event => {
          console.log(`${event.type} - ${event.step}:`, event.data)
        })
        console.groupEnd()
      }

    } catch (error) {
      logger.error('Failed to send analytics events', { error })
    }
  }, [state.sessionId])

  // 이벤트 추적
  const trackEvent = useCallback((
    type: AnalyticsEvent['type'],
    data: Record<string, any> = {}
  ) => {
    if (!config.analytics.enabled) return

    const event = createAnalyticsEvent(
      type,
      state.currentStep,
      state.sessionId,
      {
        ...data,
        timestamp: Date.now(),
        sessionMetrics: sessionMetricsRef.current
      },
      state.persistedData.auth.userId
    )

    if (config.analytics.realTime) {
      sendAnalyticsEvents([event])
    } else if (bufferRef.current) {
      bufferRef.current.add(event)
    }

    // 세션 메트릭 업데이트
    if (type === 'step_started') {
      sessionMetricsRef.current.pageViews++
    } else if (type === 'error_occurred') {
      sessionMetricsRef.current.errors++
    }

  }, [config.analytics.enabled, config.analytics.realTime, state.currentStep, state.sessionId, state.persistedData.auth.userId, sendAnalyticsEvents])

  // 성능 측정 시작
  const startPerformanceMeasurement = useCallback((key: string) => {
    performanceTrackerRef.current.startMeasurement(key)

    trackEvent('performance_measured', {
      metric: key,
      action: 'start'
    })
  }, [trackEvent])

  // 성능 측정 종료
  const endPerformanceMeasurement = useCallback((key: string) => {
    const duration = performanceTrackerRef.current.endMeasurement(key)

    trackEvent('performance_measured', {
      metric: key,
      duration,
      action: 'end'
    })

    analytics.measure(key, duration)

    return duration
  }, [trackEvent, analytics])

  // 사용자 상호작용 추적
  const trackInteraction = useCallback((
    action: string,
    element: string,
    data: Record<string, any> = {}
  ) => {
    sessionMetricsRef.current.interactions++

    trackEvent('step_started', { // 상호작용도 step_started로 분류
      interactionType: 'user_interaction',
      action,
      element,
      ...data
    })
  }, [trackEvent])

  // API 호출 추적
  const trackApiCall = useCallback((
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    data: Record<string, any> = {}
  ) => {
    sessionMetricsRef.current.apiCalls++

    trackEvent('step_started', { // API 호출도 step_started로 분류
      interactionType: 'api_call',
      endpoint,
      method,
      duration,
      status,
      ...data
    })
  }, [trackEvent])

  // 오류 추적
  const trackError = useCallback((
    error: Error | string,
    context: Record<string, any> = {}
  ) => {
    const errorMessage = typeof error === 'string' ? error : error.message
    const errorStack = typeof error === 'string' ? undefined : error.stack

    trackEvent('error_occurred', {
      message: errorMessage,
      stack: errorStack,
      context,
      step: state.currentStep
    })

    logger.error('User journey error tracked', {
      error: errorMessage,
      step: state.currentStep,
      sessionId: state.sessionId
    })
  }, [trackEvent, state.currentStep, state.sessionId])

  // 현재 세션 통계
  const currentSessionStats = useMemo(() => {
    const sessionDuration = Date.now() - sessionMetricsRef.current.sessionStart
    const performanceMetrics = calculatePerformanceMetrics(state)

    return {
      sessionId: state.sessionId,
      duration: sessionDuration,
      currentStep: state.currentStep,
      completedSteps: state.completedSteps.length,
      progressPercentage: calculateWeightedProgress(state.completedSteps),
      pageViews: sessionMetricsRef.current.pageViews,
      interactions: sessionMetricsRef.current.interactions,
      errors: sessionMetricsRef.current.errors,
      apiCalls: sessionMetricsRef.current.apiCalls,
      errorRate: sessionMetricsRef.current.interactions > 0
        ? (sessionMetricsRef.current.errors / sessionMetricsRef.current.interactions) * 100
        : 0,
      performanceMetrics,
      allMeasurements: performanceTrackerRef.current.getAllMeasurements()
    }
  }, [state])

  // 단계별 메트릭 계산
  const getStepMetrics = useCallback((step: UserJourneyStep): StepMetrics => {
    const stepProgress = state.stepProgress[step]
    const measurements = performanceTrackerRef.current.getAllMeasurements()
    const stepMeasurements = Object.entries(measurements)
      .filter(([key]) => key.includes(step))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

    return {
      duration: stepProgress?.duration || 0,
      interactions: 0, // 실제 구현에서는 단계별 상호작용 수 계산
      errors: state.errors.filter(error => error.step === step).length,
      retries: stepProgress?.attempts ? Math.max(0, stepProgress.attempts - 1) : 0,
      customMetrics: stepMeasurements
    }
  }, [state.stepProgress, state.errors])

  // 전체 여정 통계 생성
  const generateJourneyStats = useCallback((): Partial<JourneyStats> => {
    const totalDuration = Date.now() - state.startedAt.getTime()
    const completionRate = (state.completedSteps.length / state.overallProgress.totalSteps) * 100

    return {
      totalJourneys: 1, // 현재 세션만
      completedJourneys: state.completedSteps.includes('project-completion') ? 1 : 0,
      completionRate,
      averageDuration: totalDuration
    }
  }, [state])

  // 이탈 지점 분석
  const analyzeDropoffPoints = useCallback(() => {
    const currentIndex = state.overallProgress.currentStepIndex
    const dropoffPoints = []

    // 현재 단계에서 오류가 많이 발생했다면 이탈 위험 지점
    const currentStepErrors = state.errors.filter(error => error.step === state.currentStep).length
    if (currentStepErrors > 2) {
      dropoffPoints.push({
        step: state.currentStep,
        risk: 'high',
        reason: 'multiple_errors',
        errorCount: currentStepErrors
      })
    }

    // 현재 단계에서 너무 오래 머물고 있다면
    const currentStepProgress = state.stepProgress[state.currentStep]
    if (currentStepProgress?.startedAt) {
      const timeInCurrentStep = Date.now() - currentStepProgress.startedAt.getTime()
      const expectedDuration = state.metadata.performance.maxStepDuration?.[state.currentStep] || 300000

      if (timeInCurrentStep > expectedDuration * 2) {
        dropoffPoints.push({
          step: state.currentStep,
          risk: 'medium',
          reason: 'excessive_time',
          duration: timeInCurrentStep
        })
      }
    }

    return dropoffPoints
  }, [state])

  // 성능 예산 체크
  const checkPerformanceBudgets = useCallback(() => {
    const budgets = config.performance
    const violations = []

    // 단계별 최대 시간 체크
    for (const [step, progress] of Object.entries(state.stepProgress)) {
      if (progress.duration && budgets.maxStepDuration[step as UserJourneyStep]) {
        const maxDuration = budgets.maxStepDuration[step as UserJourneyStep]
        if (progress.duration > maxDuration) {
          violations.push({
            type: 'duration',
            step,
            actual: progress.duration,
            budget: maxDuration,
            violation: progress.duration - maxDuration
          })
        }
      }
    }

    // API 호출 횟수 체크
    const apiCallCount = sessionMetricsRef.current.apiCalls
    const maxApiCalls = Object.values(budgets.maxApiCalls).reduce((sum, limit) => sum + limit, 0)
    if (apiCallCount > maxApiCalls) {
      violations.push({
        type: 'api_calls',
        actual: apiCallCount,
        budget: maxApiCalls,
        violation: apiCallCount - maxApiCalls
      })
    }

    return violations
  }, [config.performance, state.stepProgress])

  // 분석 버퍼 플러시 (컴포넌트 언마운트 시)
  useEffect(() => {
    return () => {
      bufferRef.current?.flush()
    }
  }, [])

  // 주기적 메트릭 수집
  useEffect(() => {
    const interval = setInterval(() => {
      trackEvent('step_started', { // 주기적 메트릭도 step_started로 분류
        type: 'periodic_metrics',
        sessionStats: currentSessionStats,
        dropoffAnalysis: analyzeDropoffPoints(),
        performanceBudgets: checkPerformanceBudgets()
      })
    }, 60000) // 1분마다

    return () => clearInterval(interval)
  }, [trackEvent, currentSessionStats, analyzeDropoffPoints, checkPerformanceBudgets])

  return {
    // 이벤트 추적
    trackEvent,
    trackInteraction,
    trackApiCall,
    trackError,

    // 성능 측정
    startPerformanceMeasurement,
    endPerformanceMeasurement,
    getPerformanceMeasurements: () => performanceTrackerRef.current.getAllMeasurements(),

    // 통계 및 분석
    currentSessionStats,
    getStepMetrics,
    generateJourneyStats,
    analyzeDropoffPoints,
    checkPerformanceBudgets,

    // 버퍼 관리
    flushAnalyticsBuffer: () => bufferRef.current?.flush(),
    getBufferSize: () => bufferRef.current?.getBufferSize() || 0,

    // 설정
    isAnalyticsEnabled: config.analytics.enabled,
    isRealTimeMode: config.analytics.realTime
  }
}

export default useUserJourneyAnalytics