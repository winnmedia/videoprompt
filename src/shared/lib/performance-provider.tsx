'use client'

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { useWebVitals, useApiMonitoring } from '@/features/performance'
import { usePerformanceStore } from '@/entities/performance'
import { performanceApi } from '@/shared/api/performance-api'
import type { WebVitalsConfig } from '@/features/performance/use-web-vitals'
import type { ApiMonitoringConfig } from '@/features/performance/use-api-monitoring'
import { logger } from './logger';


export interface PerformanceProviderConfig {
  /**
   * 자동으로 모니터링을 시작할지 여부
   * @default true
   */
  autoStart?: boolean
  
  /**
   * 세션 ID 생성 함수
   * @default () => crypto.randomUUID()
   */
  generateSessionId?: () => string
  
  /**
   * 사용자 ID (로그인 사용자의 경우)
   */
  userId?: string
  
  /**
   * Web Vitals 설정
   */
  webVitalsConfig?: WebVitalsConfig
  
  /**
   * API 모니터링 설정
   */
  apiMonitoringConfig?: ApiMonitoringConfig
  
  /**
   * 에러 핸들러
   */
  onError?: (error: Error) => void
}

interface PerformanceContextValue {
  /**
   * 현재 세션 ID
   */
  sessionId: string | null
  
  /**
   * 모니터링 상태
   */
  isMonitoring: boolean
  
  /**
   * 새 세션 시작
   */
  startNewSession: (userId?: string) => void
  
  /**
   * 현재 세션 종료
   */
  endCurrentSession: () => void
  
  /**
   * 메트릭 수동 전송
   */
  sendMetrics: () => Promise<void>
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null)

export const usePerformanceContext = (): PerformanceContextValue => {
  const context = useContext(PerformanceContext)
  if (!context) {
    throw new Error('usePerformanceContext must be used within a PerformanceProvider')
  }
  return context
}

export interface PerformanceProviderProps {
  children: ReactNode
  config?: PerformanceProviderConfig
}

/**
 * 성능 모니터링 프로바이더
 * 
 * 이 프로바이더는 애플리케이션 전체에서 성능 모니터링을 관리합니다.
 * Web Vitals 수집, API 모니터링, 자동 세션 관리 등을 제공합니다.
 */
export const PerformanceProvider = ({ 
  children, 
  config = {} 
}: PerformanceProviderProps) => {
  const {
    autoStart = true,
    generateSessionId = () => crypto.randomUUID(),
    userId,
    webVitalsConfig = {},
    apiMonitoringConfig = {},
    onError
  } = config

  const { sessionId, setCurrentSession } = usePerformanceStore()
  const sessionIdRef = useRef<string | null>(null)

  // Web Vitals 훅
  const webVitals = useWebVitals({
    autoSend: true,
    batchSize: 5,
    debug: process.env.NODE_ENV === 'development',
    ...webVitalsConfig
  })

  // API 모니터링 훅
  const apiMonitoring = useApiMonitoring({
    autoSend: true,
    batchSize: 10,
    debug: process.env.NODE_ENV === 'development',
    slowRequestThreshold: 1000,
    excludePatterns: [
      '/api/performance/*',
      '/api/health*',
      '/_next/*',
      '/static/*'
    ],
    ...apiMonitoringConfig
  })

  // 새 세션 시작
  const startNewSession = (newUserId?: string) => {
    try {
      const newSessionId = generateSessionId()
      sessionIdRef.current = newSessionId
      
      // 스토어에 세션 설정
      setCurrentSession(newSessionId, newUserId || userId)
      
      // Web Vitals 모니터링 시작
      webVitals.startSession(newSessionId, newUserId || userId)
      
      // API 모니터링 시작
      apiMonitoring.startMonitoring()
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[Performance] Started session: ${newSessionId}`)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start session')
      onError?.(err)
      logger.debug('[Performance] Failed to start session:', err)
    }
  }

  // 현재 세션 종료
  const endCurrentSession = () => {
    try {
      if (sessionIdRef.current) {
        // Web Vitals 모니터링 중지
        webVitals.stopSession()
        
        // API 모니터링 중지
        apiMonitoring.stopMonitoring()
        
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[Performance] Ended session: ${sessionIdRef.current}`)
        }
        
        sessionIdRef.current = null
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to end session')
      onError?.(err)
      logger.debug('[Performance] Failed to end session:', err)
    }
  }

  // 메트릭 수동 전송
  const sendMetrics = async () => {
    try {
      await Promise.all([
        webVitals.sendMetrics(),
        apiMonitoring.sendMetrics()
      ])
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Performance] Metrics sent successfully')
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to send metrics')
      onError?.(err)
      logger.debug('[Performance] Failed to send metrics:', err)
      throw err
    }
  }

  // 페이지 라우팅 감지 및 자동 세션 관리
  useEffect(() => {
    if (!autoStart) return

    // 초기 세션 시작
    startNewSession()

    // 페이지 변경 감지 (Next.js 라우팅)
    const handleRouteChange = () => {
      // 새 페이지로 이동할 때 기존 세션 종료하고 새 세션 시작
      if (sessionIdRef.current) {
        endCurrentSession()
        setTimeout(() => startNewSession(), 100) // 잠시 대기 후 새 세션
      }
    }

    // Next.js 라우터 이벤트 리스너
    if (typeof window !== 'undefined') {
      // popstate 이벤트로 뒤로가기/앞으로가기 감지
      window.addEventListener('popstate', handleRouteChange)
      
      // pushState/replaceState 감지 (프로그래매틱 네비게이션)
      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args)
        handleRouteChange()
      }
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args)
        handleRouteChange()
      }
      
      return () => {
        window.removeEventListener('popstate', handleRouteChange)
        history.pushState = originalPushState
        history.replaceState = originalReplaceState
      }
    }
  }, [autoStart, userId])

  // 컴포넌트 언마운트 시 세션 정리
  useEffect(() => {
    return () => {
      endCurrentSession()
    }
  }, [])

  // 페이지 언로드 시 메트릭 전송
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        // 동기적으로 메트릭 전송 시도
        const currentSession = usePerformanceStore.getState().getCurrentSessionMetrics()
        
        try {
          const payload = JSON.stringify(currentSession)
          
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/performance/metrics', payload)
          }
        } catch (error) {
          logger.error('[Performance] Failed to send metrics on unload:', error instanceof Error ? error : new Error(String(error)))
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && sessionIdRef.current) {
        // 페이지가 숨겨질 때 메트릭 전송
        sendMetrics().catch(error => {
          logger.error('[Performance] Failed to send metrics on visibility change:', error instanceof Error ? error : new Error(String(error)))
        })
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [])

  const contextValue: PerformanceContextValue = {
    sessionId: sessionIdRef.current,
    isMonitoring: webVitals.isMonitoring || apiMonitoring.isMonitoring,
    startNewSession,
    endCurrentSession,
    sendMetrics
  }

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  )
}

/**
 * 성능 모니터링 HOC
 * 
 * 개별 페이지나 컴포넌트에서 성능 모니터링을 쉽게 활성화할 수 있습니다.
 */
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  config?: PerformanceProviderConfig
) => {
  return function PerformanceWrappedComponent(props: P) {
    return (
      <PerformanceProvider config={config}>
        <Component {...props} />
      </PerformanceProvider>
    )
  }
}