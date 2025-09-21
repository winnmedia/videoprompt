import { useEffect, useCallback, useRef } from 'react'
import { usePerformanceStore } from '@/entities/performance'
import { performanceApi } from '@/shared/api/performance-api'
import type { APIPerformanceMetric } from '@/entities/performance'
import { logger } from '@/shared/lib/logger'

export interface ApiMonitoringConfig {
  /**
   * 모니터링할 API 엔드포인트 패턴
   * @default ['/api/*']
   */
  includePatterns?: string[]
  
  /**
   * 제외할 API 엔드포인트 패턴
   * @default ['/api/performance/*']
   */
  excludePatterns?: string[]
  
  /**
   * 자동으로 메트릭을 서버에 전송할지 여부
   * @default false
   */
  autoSend?: boolean
  
  /**
   * 배치 전송할 메트릭 개수
   * @default 10
   */
  batchSize?: number
  
  /**
   * 디버그 모드 활성화
   * @default false
   */
  debug?: boolean
  
  /**
   * 응답 시간 임계값 (ms) - 초과 시 경고
   * @default 1000
   */
  slowRequestThreshold?: number
}

const DEFAULT_CONFIG: ApiMonitoringConfig = {
  includePatterns: ['/api/*'],
  excludePatterns: ['/api/performance/*'],
  autoSend: false,
  batchSize: 10,
  debug: false,
  slowRequestThreshold: 1000
}

export interface ApiMonitoringHook {
  /**
   * API 모니터링 시작
   */
  startMonitoring: () => void
  
  /**
   * API 모니터링 중지
   */
  stopMonitoring: () => void
  
  /**
   * 수집된 API 메트릭을 수동으로 전송
   */
  sendMetrics: () => Promise<void>
  
  /**
   * 현재 모니터링 상태
   */
  isMonitoring: boolean
  
  /**
   * 현재 배치에 수집된 메트릭 개수
   */
  batchCount: number
}

// URL 패턴 매칭 함수
const matchesPattern = (url: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(url)
    }
    return url === pattern || url.startsWith(pattern)
  })
}

/**
 * API 성능 모니터링 훅
 * 
 * 이 훅은 fetch API를 intercept하여 API 요청의 성능 메트릭을 수집합니다.
 * 
 * @param config API 모니터링 설정 옵션
 * @returns API 모니터링 관리 함수들
 */
export const useApiMonitoring = (config: ApiMonitoringConfig = {}): ApiMonitoringHook => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const {
    sessionId,
    addApiMetric,
    isMonitoring,
    getCurrentSessionMetrics
  } = usePerformanceStore()
  
  const batchRef = useRef<APIPerformanceMetric[]>([])
  const originalFetchRef = useRef<typeof fetch | null>(null)
  const sendTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const monitoringRef = useRef(false)

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
        apiMetrics: metrics
      })
      
      if (mergedConfig.debug) {
        logger.info(`[API Monitor] Sent ${metrics.length} API metrics`)
      }
    } catch (error) {
      if (mergedConfig.debug) {
        logger.error('[API Monitor] Failed to send metrics:', error instanceof Error ? error : new Error(String(error)))
      }
      
      // 실패한 메트릭을 다시 배치에 추가
      batchRef.current.unshift(...metrics)
    }
  }, [mergedConfig.debug, getCurrentSessionMetrics])

  // fetch 인터셉터 생성
  const createFetchInterceptor = useCallback(() => {
    return async function interceptedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const startTime = performance.now()
      const url = typeof input === 'string' ? input : input.toString()
      
      // URL 패턴 필터링
      const shouldMonitor = matchesPattern(url, mergedConfig.includePatterns!) &&
                          !matchesPattern(url, mergedConfig.excludePatterns!)
      
      if (!shouldMonitor || !monitoringRef.current) {
        return originalFetchRef.current!(input, init)
      }

      const method = (init?.method || 'GET').toUpperCase()
      const requestSize = init?.body ? 
        new Blob([init.body as BlobPart]).size : 0
      
      try {
        const response = await originalFetchRef.current!(input, init)
        const endTime = performance.now()
        const responseTime = Math.round(endTime - startTime)
        
        // 응답 크기 추정 (정확하지 않음)
        const responseSize = parseInt(response.headers.get('content-length') || '0') || 
                           (response.body ? 1024 : 0) // 기본 추정값

        const metric: APIPerformanceMetric = {
          url,
          method: method as APIPerformanceMetric['method'],
          statusCode: response.status,
          responseTime,
          timestamp: Date.now(),
          requestSize,
          responseSize,
          sessionId: sessionId || undefined,
          cacheHit: response.headers.get('x-cache') === 'HIT',
          retryCount: 0
        }

        // 에러 타입 설정
        if (response.status >= 400) {
          if (response.status === 401) {
            metric.errorType = 'UNAUTHORIZED'
          } else if (response.status === 403) {
            metric.errorType = 'FORBIDDEN'
          } else if (response.status === 404) {
            metric.errorType = 'NOT_FOUND'
          } else if (response.status >= 500) {
            metric.errorType = 'SERVER_ERROR'
          } else {
            metric.errorType = 'CLIENT_ERROR'
          }
        }

        // 느린 요청 감지
        if (responseTime > mergedConfig.slowRequestThreshold!) {
          if (mergedConfig.debug) {
            logger.debug(`[API Monitor] Slow request detected: ${url} (${responseTime}ms)`)
          }
        }

        // 메트릭 저장
        addApiMetric(metric)

        // 자동 전송 처리
        if (mergedConfig.autoSend) {
          batchRef.current.push(metric)
          
          if (batchRef.current.length >= mergedConfig.batchSize!) {
            sendBatch()
          } else if (!sendTimeoutRef.current) {
            // 1초 후 자동 전송
            sendTimeoutRef.current = setTimeout(() => {
              sendBatch()
            }, 1000)
          }
        }

        if (mergedConfig.debug) {
          logger.info(`[API Monitor] ${method} ${url} - ${response.status} (${responseTime}ms)`)
        }

        return response
      } catch (error) {
        const endTime = performance.now()
        const responseTime = Math.round(endTime - startTime)
        
        const metric: APIPerformanceMetric = {
          url,
          method: method as APIPerformanceMetric['method'],
          statusCode: 0,
          responseTime,
          timestamp: Date.now(),
          requestSize,
          responseSize: 0,
          errorType: 'NETWORK_ERROR',
          sessionId: sessionId || undefined,
          retryCount: 0
        }

        addApiMetric(metric)
        
        if (mergedConfig.debug) {
          logger.error(`[API Monitor] Network error: ${method} ${url}`, error instanceof Error ? error : new Error(String(error)))
        }

        throw error
      }
    }
  }, [
    mergedConfig,
    sessionId,
    addApiMetric,
    sendBatch
  ])

  // 모니터링 시작
  const startMonitoring = useCallback(() => {
    if (monitoringRef.current) return

    // 원본 fetch 저장
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch
    }

    // fetch 인터셉터 설치
    window.fetch = createFetchInterceptor()
    monitoringRef.current = true

    if (mergedConfig.debug) {
      logger.info('[API Monitor] Started monitoring')
    }
  }, [createFetchInterceptor, mergedConfig.debug])

  // 모니터링 중지
  const stopMonitoring = useCallback(() => {
    if (!monitoringRef.current) return

    // 원본 fetch 복원
    if (originalFetchRef.current) {
      window.fetch = originalFetchRef.current
    }

    // 남은 메트릭 전송
    if (batchRef.current.length > 0) {
      sendBatch()
    }

    // 타임아웃 정리
    if (sendTimeoutRef.current) {
      if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current)
    }
      sendTimeoutRef.current = undefined
    }

    monitoringRef.current = false

    if (mergedConfig.debug) {
      logger.info('[API Monitor] Stopped monitoring')
    }
  }, [sendBatch, mergedConfig.debug])

  // 수동 메트릭 전송
  const sendMetrics = useCallback(async () => {
    const sessionMetrics = getCurrentSessionMetrics()
    
    try {
      await performanceApi.sendMetrics(sessionMetrics)
      
      if (mergedConfig.debug) {
        logger.info('[API Monitor] Metrics sent successfully')
      }
    } catch (error) {
      if (mergedConfig.debug) {
        logger.error('[API Monitor] Failed to send metrics:', error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }, [getCurrentSessionMetrics, mergedConfig.debug])

  // 페이지 언로드 시 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopMonitoring()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      stopMonitoring()
    }
  }, [stopMonitoring])

  return {
    startMonitoring,
    stopMonitoring,
    sendMetrics,
    isMonitoring: monitoringRef.current,
    batchCount: batchRef.current.length
  }
}