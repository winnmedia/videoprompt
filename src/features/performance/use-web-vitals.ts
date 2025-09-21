import { useEffect, useCallback, useRef } from 'react'
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric, type ReportOpts } from 'web-vitals'
import { usePerformanceStore } from '@/entities/performance'
import { performanceApi } from '@/shared/api/performance-api'
import type { CoreWebVital } from '@/entities/performance'
import { logger } from '@/shared/lib/logger'

export interface WebVitalsConfig extends ReportOpts {
  /**
   * 메트릭을 자동으로 서버에 전송할지 여부
   * @default false
   */
  autoSend?: boolean
  
  /**
   * 배치 전송할 메트릭 개수
   * @default 10
   */
  batchSize?: number
  
  /**
   * 전송 실패 시 재시도 횟수
   * @default 3
   */
  retryCount?: number
  
  /**
   * 디버그 모드 활성화
   * @default false
   */
  debug?: boolean
  
  /**
   * 수집할 메트릭 종류 지정
   * @default ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']
   */
  metrics?: ('LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB')[]
}

const DEFAULT_CONFIG: WebVitalsConfig = {
  autoSend: false,
  batchSize: 10,
  retryCount: 3,
  debug: false,
  metrics: ['LCP', 'INP', 'CLS'],
  reportAllChanges: false
}

export interface WebVitalsHook {
  /**
   * 성능 모니터링 세션 시작
   */
  startSession: (sessionId: string, userId?: string) => void
  
  /**
   * 성능 모니터링 세션 종료
   */
  stopSession: () => void
  
  /**
   * 수집된 메트릭을 수동으로 전송
   */
  sendMetrics: () => Promise<void>
  
  /**
   * 현재 모니터링 상태
   */
  isMonitoring: boolean
  
  /**
   * 현재 세션 ID
   */
  sessionId: string | null
}

/**
 * Core Web Vitals 모니터링 훅
 * 
 * 이 훅은 웹 페이지의 핵심 성능 지표를 자동으로 수집하고
 * 성능 스토어에 저장합니다.
 * 
 * @param config 웹 바이탈 설정 옵션
 * @returns 웹 바이탈 관리 함수들
 */
export const useWebVitals = (config: WebVitalsConfig = {}): WebVitalsHook => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const {
    isMonitoring,
    sessionId,
    addCoreWebVital,
    startMonitoring,
    stopMonitoring,
    setCurrentSession,
    getCurrentSessionMetrics
  } = usePerformanceStore()
  
  const batchRef = useRef<CoreWebVital[]>([])
  const sendTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // 메트릭을 Core Web Vital 형식으로 변환
  const transformMetric = useCallback((metric: Metric): CoreWebVital => {
    return {
      name: metric.name as CoreWebVital['name'],
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType as CoreWebVital['navigationType'],
      id: metric.id,
      timestamp: Date.now(),
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      entries: metric.entries,
      attribution: (metric as any).attribution
    }
  }, [])

  // 메트릭 처리 함수
  const handleMetric = useCallback((metric: Metric) => {
    if (mergedConfig.debug) {
      logger.info(`[Web Vitals] ${metric.name}:`, { metric })
    }

    const coreWebVital = transformMetric(metric)
    addCoreWebVital(coreWebVital)

    // 자동 전송 처리
    if (mergedConfig.autoSend) {
      batchRef.current.push(coreWebVital)
      
      // 배치 크기에 도달했거나 타임아웃이 설정되지 않은 경우
      if (batchRef.current.length >= mergedConfig.batchSize!) {
        sendBatch()
      } else if (!sendTimeoutRef.current) {
        // 1초 후 자동 전송
        sendTimeoutRef.current = setTimeout(() => {
          sendBatch()
        }, 1000)
      }
    }
  }, [mergedConfig, addCoreWebVital, transformMetric])

  // 배치 전송
  const sendBatch = useCallback(async () => {
    if (batchRef.current.length === 0) return

    const metrics = batchRef.current.splice(0) // 배치 비우기
    
    if (sendTimeoutRef.current) {
      if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current)
    }
      sendTimeoutRef.current = undefined
    }

    try {
      const sessionMetrics = getCurrentSessionMetrics()
      await performanceApi.sendMetrics({
        ...sessionMetrics,
        coreWebVitals: metrics
      })
      
      if (mergedConfig.debug) {
        logger.info(`[Web Vitals] Sent ${metrics.length} metrics`)
      }
    } catch (error) {
      if (mergedConfig.debug) {
        logger.error('[Web Vitals] Failed to send metrics:', error instanceof Error ? error : new Error(String(error)))
      }
      
      // 실패한 메트릭을 다시 배치에 추가 (재시도)
      batchRef.current.unshift(...metrics)
    }
  }, [mergedConfig.debug, getCurrentSessionMetrics])

  // Web Vitals 리스너 설정
  useEffect(() => {
    const { metrics: enabledMetrics } = mergedConfig
    const reportOpts: ReportOpts = {
      reportAllChanges: mergedConfig.reportAllChanges
    }

    if (enabledMetrics?.includes('LCP')) {
      onLCP(handleMetric, reportOpts)
    }
    
    if (enabledMetrics?.includes('INP')) {
      onINP(handleMetric, reportOpts)
    }
    
    if (enabledMetrics?.includes('CLS')) {
      onCLS(handleMetric, reportOpts)
    }
    
    if (enabledMetrics?.includes('FCP')) {
      onFCP(handleMetric, reportOpts)
    }
    
    if (enabledMetrics?.includes('TTFB')) {
      onTTFB(handleMetric, reportOpts)
    }

    // Cleanup
    return () => {
      if (sendTimeoutRef.current) {
        if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current)
    }
      }
      
      // 페이지 언로드 시 남은 메트릭 전송
      if (batchRef.current.length > 0) {
        sendBatch()
      }
    }
  }, [handleMetric, mergedConfig, sendBatch])

  // 페이지 언로드 시 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (batchRef.current.length > 0) {
        // 동기적으로 전송 (beacon API 사용 가능한 경우)
        const metrics = batchRef.current.splice(0)
        const sessionMetrics = getCurrentSessionMetrics()
        
        try {
          const payload = JSON.stringify({
            ...sessionMetrics,
            coreWebVitals: metrics
          })
          
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/performance/metrics', payload)
          }
        } catch (error) {
          if (mergedConfig.debug) {
            logger.error('[Web Vitals] Failed to send metrics on unload:', error instanceof Error ? error : new Error(String(error)))
          }
        }
      }
      
      stopMonitoring()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [mergedConfig.debug, getCurrentSessionMetrics, stopMonitoring])

  // 세션 관리
  const startSession = useCallback((newSessionId: string, userId?: string) => {
    setCurrentSession(newSessionId, userId)
    startMonitoring()
    
    if (mergedConfig.debug) {
      logger.info(`[Web Vitals] Started session: ${newSessionId}`)
    }
  }, [setCurrentSession, startMonitoring, mergedConfig.debug])

  const stopSession = useCallback(() => {
    // 남은 메트릭 전송
    if (batchRef.current.length > 0) {
      sendBatch()
    }
    
    stopMonitoring()
    
    if (mergedConfig.debug) {
      logger.info('[Web Vitals] Stopped session')
    }
  }, [sendBatch, stopMonitoring, mergedConfig.debug])

  // 수동 전송
  const sendMetrics = useCallback(async () => {
    const sessionMetrics = getCurrentSessionMetrics()
    
    try {
      await performanceApi.sendMetrics(sessionMetrics)
      
      if (mergedConfig.debug) {
        logger.info('[Web Vitals] Metrics sent successfully')
      }
    } catch (error) {
      if (mergedConfig.debug) {
        logger.error('[Web Vitals] Failed to send metrics:', error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }, [getCurrentSessionMetrics, mergedConfig.debug])

  return {
    startSession,
    stopSession,
    sendMetrics,
    isMonitoring,
    sessionId
  }
}