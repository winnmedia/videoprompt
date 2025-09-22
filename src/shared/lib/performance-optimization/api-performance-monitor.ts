/**
 * API Performance Monitor
 *
 * CLAUDE.md 준수: API 성능 모니터링 및 최적화
 * 응답 시간, 처리량, 에러율 모니터링 시스템
 */

import logger from '../logger'
import { apiCache } from './cache-manager'

// ===========================================
// 타입 정의
// ===========================================

interface ApiMetrics {
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  userId?: string
  userAgent?: string
  ip?: string
  timestamp: number
  error?: string
}

interface PerformanceStats {
  totalRequests: number
  averageResponseTime: number
  medianResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  requestsPerMinute: number
  slowestEndpoints: Array<{
    endpoint: string
    averageResponseTime: number
    requestCount: number
  }>
  errorsByEndpoint: Record<string, number>
  responseTimePercentiles: number[]
}

interface EndpointStats {
  requestCount: number
  totalResponseTime: number
  responseTimes: number[]
  errorCount: number
  lastRequestTime: number
}

// ===========================================
// 성능 모니터링 클래스
// ===========================================

export class ApiPerformanceMonitor {
  private metrics: ApiMetrics[] = []
  private endpointStats: Map<string, EndpointStats> = new Map()
  private readonly maxMetricsSize = 10000 // 최대 메트릭 보관 개수
  private readonly performanceThresholds = {
    slow: 1000, // 1초 이상이면 느림
    verySlow: 3000, // 3초 이상이면 매우 느림
    critical: 5000, // 5초 이상이면 심각
  }

  /**
   * API 요청 메트릭 기록
   */
  recordMetric(metric: ApiMetrics): void {
    // 메트릭 저장
    this.metrics.push(metric)

    // 메트릭 크기 제한
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize)
    }

    // 엔드포인트별 통계 업데이트
    this.updateEndpointStats(metric)

    // 성능 알림 체크
    this.checkPerformanceAlerts(metric)

    // 디버그 로깅
    if (metric.responseTime > this.performanceThresholds.slow) {
      logger.warn('느린 API 응답 감지', {
        component: 'ApiPerformanceMonitor',
        endpoint: metric.endpoint,
        method: metric.method,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode,
        userId: metric.userId,
      })
    }
  }

  /**
   * 엔드포인트별 통계 업데이트
   */
  private updateEndpointStats(metric: ApiMetrics): void {
    const key = `${metric.method} ${metric.endpoint}`
    const stats = this.endpointStats.get(key) || {
      requestCount: 0,
      totalResponseTime: 0,
      responseTimes: [],
      errorCount: 0,
      lastRequestTime: 0,
    }

    stats.requestCount++
    stats.totalResponseTime += metric.responseTime
    stats.responseTimes.push(metric.responseTime)
    stats.lastRequestTime = metric.timestamp

    if (metric.statusCode >= 400) {
      stats.errorCount++
    }

    // 응답 시간 배열 크기 제한 (최근 1000개만 보관)
    if (stats.responseTimes.length > 1000) {
      stats.responseTimes = stats.responseTimes.slice(-1000)
    }

    this.endpointStats.set(key, stats)
  }

  /**
   * 성능 알림 체크
   */
  private checkPerformanceAlerts(metric: ApiMetrics): void {
    const { responseTime, endpoint, method, statusCode } = metric

    // 심각한 응답 시간 지연
    if (responseTime > this.performanceThresholds.critical) {
      logger.error('심각한 API 응답 지연', {
        component: 'ApiPerformanceMonitor',
        endpoint,
        method,
        responseTime,
        threshold: this.performanceThresholds.critical,
        alert: 'CRITICAL_RESPONSE_TIME',
      })
    }

    // 5xx 에러
    if (statusCode >= 500) {
      logger.error('서버 에러 발생', {
        component: 'ApiPerformanceMonitor',
        endpoint,
        method,
        statusCode,
        responseTime,
        alert: 'SERVER_ERROR',
      })
    }

    // 연속된 에러 체크
    this.checkConsecutiveErrors(endpoint, method, statusCode >= 400)
  }

  /**
   * 연속된 에러 체크
   */
  private checkConsecutiveErrors(endpoint: string, method: string, isError: boolean): void {
    const key = `${method} ${endpoint}`
    const recentMetrics = this.metrics
      .filter(m => m.endpoint === endpoint && m.method === method)
      .slice(-5) // 최근 5개 요청

    if (recentMetrics.length >= 5) {
      const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length

      if (errorCount >= 4) {
        logger.error('연속된 API 에러 감지', {
          component: 'ApiPerformanceMonitor',
          endpoint,
          method,
          errorCount,
          totalChecked: recentMetrics.length,
          alert: 'CONSECUTIVE_ERRORS',
        })
      }
    }
  }

  /**
   * 전체 성능 통계 조회
   */
  getPerformanceStats(timeRangeMs?: number): PerformanceStats {
    const cutoffTime = timeRangeMs ? Date.now() - timeRangeMs : 0
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoffTime)

    if (relevantMetrics.length === 0) {
      return this.getEmptyStats()
    }

    // 응답 시간 배열 (정렬됨)
    const responseTimes = relevantMetrics
      .map(m => m.responseTime)
      .sort((a, b) => a - b)

    // 기본 통계
    const totalRequests = relevantMetrics.length
    const averageResponseTime = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
    const medianResponseTime = this.calculatePercentile(responseTimes, 50)
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95)
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99)

    // 에러율 계산
    const errorCount = relevantMetrics.filter(m => m.statusCode >= 400).length
    const errorRate = (errorCount / totalRequests) * 100

    // 분당 요청 수 계산
    const timeSpanMs = Math.max(timeRangeMs || (Date.now() - relevantMetrics[0].timestamp), 60000)
    const requestsPerMinute = (totalRequests / timeSpanMs) * 60000

    // 가장 느린 엔드포인트들
    const slowestEndpoints = this.getSlowestEndpoints(relevantMetrics)

    // 엔드포인트별 에러 수
    const errorsByEndpoint = this.getErrorsByEndpoint(relevantMetrics)

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      medianResponseTime: Math.round(medianResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      slowestEndpoints,
      errorsByEndpoint,
      responseTimePercentiles: [
        this.calculatePercentile(responseTimes, 50),
        this.calculatePercentile(responseTimes, 75),
        this.calculatePercentile(responseTimes, 90),
        this.calculatePercentile(responseTimes, 95),
        this.calculatePercentile(responseTimes, 99),
      ],
    }
  }

  /**
   * 엔드포인트별 상세 통계 조회
   */
  getEndpointStats(endpoint: string, method: string): EndpointStats | null {
    const key = `${method} ${endpoint}`
    return this.endpointStats.get(key) || null
  }

  /**
   * 모든 엔드포인트 통계 조회
   */
  getAllEndpointStats(): Map<string, EndpointStats> {
    return new Map(this.endpointStats)
  }

  /**
   * 퍼센타일 계산
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * 가장 느린 엔드포인트들 조회
   */
  private getSlowestEndpoints(metrics: ApiMetrics[]): Array<{
    endpoint: string
    averageResponseTime: number
    requestCount: number
  }> {
    const endpointMap = new Map<string, { totalTime: number; count: number }>()

    metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      const current = endpointMap.get(key) || { totalTime: 0, count: 0 }
      endpointMap.set(key, {
        totalTime: current.totalTime + metric.responseTime,
        count: current.count + 1,
      })
    })

    return Array.from(endpointMap.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageResponseTime: Math.round(stats.totalTime / stats.count),
        requestCount: stats.count,
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10) // 상위 10개
  }

  /**
   * 엔드포인트별 에러 수 조회
   */
  private getErrorsByEndpoint(metrics: ApiMetrics[]): Record<string, number> {
    const errorMap: Record<string, number> = {}

    metrics
      .filter(m => m.statusCode >= 400)
      .forEach(metric => {
        const key = `${metric.method} ${metric.endpoint}`
        errorMap[key] = (errorMap[key] || 0) + 1
      })

    return errorMap
  }

  /**
   * 빈 통계 객체 반환
   */
  private getEmptyStats(): PerformanceStats {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      requestsPerMinute: 0,
      slowestEndpoints: [],
      errorsByEndpoint: {},
      responseTimePercentiles: [0, 0, 0, 0, 0],
    }
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport(timeRangeMs: number = 3600000): string {
    const stats = this.getPerformanceStats(timeRangeMs)
    const timeRangeHours = timeRangeMs / (1000 * 60 * 60)

    return `
=== API 성능 리포트 (최근 ${timeRangeHours}시간) ===

📊 전체 통계:
- 총 요청 수: ${stats.totalRequests.toLocaleString()}
- 평균 응답 시간: ${stats.averageResponseTime}ms
- 중간값 응답 시간: ${stats.medianResponseTime}ms
- 95퍼센타일: ${stats.p95ResponseTime}ms
- 99퍼센타일: ${stats.p99ResponseTime}ms
- 에러율: ${stats.errorRate}%
- 분당 요청 수: ${stats.requestsPerMinute}

🐌 가장 느린 엔드포인트:
${stats.slowestEndpoints.slice(0, 5).map(ep =>
  `- ${ep.endpoint}: ${ep.averageResponseTime}ms (${ep.requestCount}회 요청)`
).join('\n')}

❌ 에러가 많은 엔드포인트:
${Object.entries(stats.errorsByEndpoint).slice(0, 5).map(([endpoint, count]) =>
  `- ${endpoint}: ${count}회 에러`
).join('\n')}

📈 응답 시간 분포:
- 50%: ${stats.responseTimePercentiles[0]}ms
- 75%: ${stats.responseTimePercentiles[1]}ms
- 90%: ${stats.responseTimePercentiles[2]}ms
- 95%: ${stats.responseTimePercentiles[3]}ms
- 99%: ${stats.responseTimePercentiles[4]}ms
`
  }

  /**
   * 메트릭 데이터 정리
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - olderThanMs
    const initialLength = this.metrics.length

    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime)

    const removedCount = initialLength - this.metrics.length

    logger.info('API 메트릭 데이터 정리', {
      component: 'ApiPerformanceMonitor',
      removedCount,
      remainingCount: this.metrics.length,
      cutoffHours: olderThanMs / (1000 * 60 * 60),
    })

    return removedCount
  }

  /**
   * 성능 최적화 제안 생성
   */
  getOptimizationSuggestions(): string[] {
    const stats = this.getPerformanceStats()
    const suggestions: string[] = []

    // 느린 응답 시간 체크
    if (stats.averageResponseTime > 500) {
      suggestions.push(`평균 응답 시간이 ${stats.averageResponseTime}ms로 높습니다. 캐싱이나 쿼리 최적화를 고려하세요.`)
    }

    // 높은 에러율 체크
    if (stats.errorRate > 5) {
      suggestions.push(`에러율이 ${stats.errorRate}%로 높습니다. 에러 처리 로직을 점검하세요.`)
    }

    // 99퍼센타일이 너무 높은 경우
    if (stats.p99ResponseTime > 2000) {
      suggestions.push(`99퍼센타일 응답 시간이 ${stats.p99ResponseTime}ms입니다. 최악의 경우를 최적화하세요.`)
    }

    // 느린 엔드포인트가 많은 경우
    const slowEndpoints = stats.slowestEndpoints.filter(ep => ep.averageResponseTime > 1000)
    if (slowEndpoints.length > 3) {
      suggestions.push(`${slowEndpoints.length}개의 엔드포인트가 1초 이상 걸립니다. 개별 최적화가 필요합니다.`)
    }

    return suggestions
  }
}

// ===========================================
// 전역 성능 모니터 인스턴스
// ===========================================

export const apiPerformanceMonitor = new ApiPerformanceMonitor()

// ===========================================
// Express/Next.js 미들웨어 함수
// ===========================================

/**
 * API 성능 모니터링 미들웨어
 */
export function createPerformanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()

    // 응답 완료 시 메트릭 기록
    res.on('finish', () => {
      const responseTime = Date.now() - startTime

      apiPerformanceMonitor.recordMetric({
        endpoint: req.route?.path || req.url || 'unknown',
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        userId: req.user?.userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: Date.now(),
        error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
      })
    })

    next()
  }
}

/**
 * 성능 모니터링 시작
 */
export function startPerformanceMonitoring(intervalMs: number = 300000): NodeJS.Timeout {
  return setInterval(() => {
    const stats = apiPerformanceMonitor.getPerformanceStats(intervalMs)

    logger.info('API 성능 모니터링 리포트', {
      component: 'ApiPerformanceMonitor',
      stats: {
        totalRequests: stats.totalRequests,
        averageResponseTime: stats.averageResponseTime,
        errorRate: stats.errorRate,
        requestsPerMinute: stats.requestsPerMinute,
        p95ResponseTime: stats.p95ResponseTime,
      },
      suggestions: apiPerformanceMonitor.getOptimizationSuggestions(),
    })

    // 24시간 이상 된 메트릭 정리
    apiPerformanceMonitor.cleanup()
  }, intervalMs)
}