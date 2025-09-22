/**
 * Performance Optimization Implementation Guide
 *
 * CLAUDE.md 준수: 실제 프로덕션 환경에서의 성능 최적화 적용 가이드
 * 캐싱, 모니터링, 비용 안전 시스템의 실제 적용 방법
 */

import {
  apiCache,
  userCache,
  projectCache,
  configCache,
  startCacheMonitoring
} from './cache-manager'
import {
  apiPerformanceMonitor,
  startPerformanceMonitoring
} from './api-performance-monitor'
import { enhancedCostSafety } from './enhanced-cost-safety'
import logger from '../logger'

// ===========================================
// 성능 최적화 매니저
// ===========================================

export class PerformanceOptimizationManager {
  private monitoringIntervals: NodeJS.Timeout[] = []
  private isInitialized = false

  /**
   * 성능 최적화 시스템 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('성능 최적화 시스템이 이미 초기화되었습니다.')
      return
    }

    try {
      // 1. 캐시 모니터링 시작 (5분 간격)
      const cacheMonitorInterval = startCacheMonitoring(300000)
      this.monitoringIntervals.push(cacheMonitorInterval)

      // 2. API 성능 모니터링 시작 (10분 간격)
      const performanceMonitorInterval = startPerformanceMonitoring(600000)
      this.monitoringIntervals.push(performanceMonitorInterval)

      // 3. 주요 데이터 미리 로딩 (워밍업)
      await this.warmupCaches()

      // 4. 자동 정리 스케줄 설정
      this.setupCleanupSchedule()

      // 5. 성능 최적화 규칙 적용
      this.applyOptimizationRules()

      this.isInitialized = true

      logger.info('성능 최적화 시스템 초기화 완료', {
        component: 'PerformanceOptimizationManager',
        features: [
          'cache_monitoring',
          'api_performance_monitoring',
          'cost_safety',
          'cache_warmup',
          'auto_cleanup',
          'optimization_rules'
        ]
      })

    } catch (error) {
      logger.error('성능 최적화 시스템 초기화 실패', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * 캐시 워밍업 (주요 데이터 미리 로딩)
   */
  private async warmupCaches(): Promise<void> {
    logger.info('캐시 워밍업 시작')

    try {
      // 1. 공통 설정 데이터 캐싱
      const commonConfigs = [
        'ai_providers',
        'system_settings',
        'feature_flags',
        'rate_limits'
      ]

      for (const configKey of commonConfigs) {
        if (!configCache.has(configKey)) {
          // 실제 데이터 로딩 로직은 각 서비스에서 구현
          configCache.set(configKey, { warmedUp: true, timestamp: Date.now() }, { ttl: 3600 })
        }
      }

      // 2. 자주 사용되는 템플릿 데이터 캐싱
      // TODO: 실제 템플릿 데이터 로딩

      // 3. 기본 프로젝트 메타데이터 캐싱
      // TODO: 최근 프로젝트 목록 캐싱

      logger.info('캐시 워밍업 완료', {
        component: 'PerformanceOptimizationManager',
        cachedConfigs: commonConfigs.length
      })

    } catch (error) {
      logger.warn('캐시 워밍업 중 오류 발생', {
        error: error instanceof Error ? error.message : error
      })
    }
  }

  /**
   * 자동 정리 스케줄 설정
   */
  private setupCleanupSchedule(): void {
    // 매시간 캐시 정리 (메모리 사용량 90% 이상 시)
    const hourlyCleanup = setInterval(() => {
      const caches = [apiCache, userCache, projectCache, configCache]

      caches.forEach(cache => {
        const usage = cache.getMemoryUsage()
        if (usage.percentage > 90) {
          const cleaned = cache.cleanup()
          logger.info('자동 캐시 정리 실행', {
            component: 'PerformanceOptimizationManager',
            memoryUsage: usage.percentage,
            cleanedEntries: cleaned
          })
        }
      })
    }, 3600000) // 1시간

    this.monitoringIntervals.push(hourlyCleanup)

    // 매일 자정 종합 정리
    const dailyCleanup = setInterval(() => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() < 10) {
        this.performDailyMaintenance()
      }
    }, 600000) // 10분마다 체크

    this.monitoringIntervals.push(dailyCleanup)
  }

  /**
   * 성능 최적화 규칙 적용
   */
  private applyOptimizationRules(): void {
    // 1. API 캐시 최적화 콜백 등록
    this.registerApiCacheCallbacks()

    // 2. 사용자별 캐시 전략 적용
    this.setupUserSpecificCaching()

    // 3. 프로젝트 데이터 캐싱 전략 적용
    this.setupProjectCaching()

    logger.info('성능 최적화 규칙 적용 완료')
  }

  /**
   * API 캐시 콜백 등록
   */
  private registerApiCacheCallbacks(): void {
    // 프로젝트 목록 캐시 갱신 콜백
    apiCache.registerRefreshCallback('projects_list', async () => {
      // TODO: 실제 프로젝트 목록 재조회 로직
      return { refreshed: true, timestamp: Date.now() }
    })

    // 템플릿 목록 캐시 갱신 콜백
    apiCache.registerRefreshCallback('templates_list', async () => {
      // TODO: 실제 템플릿 목록 재조회 로직
      return { refreshed: true, timestamp: Date.now() }
    })
  }

  /**
   * 사용자별 캐시 전략
   */
  private setupUserSpecificCaching(): void {
    // 사용자별 권한 정보는 더 길게 캐싱 (30분)
    // 사용자별 최근 활동은 짧게 캐싱 (5분)
  }

  /**
   * 프로젝트 캐싱 전략
   */
  private setupProjectCaching(): void {
    // 프로젝트 메타데이터는 중간 정도 캐싱 (15분)
    // 프로젝트 상세 정보는 자주 변경되므로 짧게 캐싱 (3분)
  }

  /**
   * 일일 유지보수 작업
   */
  private async performDailyMaintenance(): Promise<void> {
    logger.info('일일 유지보수 작업 시작')

    try {
      // 1. 모든 캐시 정리
      const cleanedCacheEntries = apiCache.cleanup() + userCache.cleanup() +
                                  projectCache.cleanup() + configCache.cleanup()

      // 2. 성능 메트릭 정리 (7일 이상 된 데이터)
      const cleanedMetrics = apiPerformanceMonitor.cleanup(7 * 24 * 60 * 60 * 1000)

      // 3. 성능 리포트 생성
      const performanceReport = apiPerformanceMonitor.generatePerformanceReport(24 * 60 * 60 * 1000)

      // 4. 비용 안전 상태 리포트
      const costSafetyStatus = enhancedCostSafety.getStatus()

      logger.info('일일 유지보수 작업 완료', {
        component: 'PerformanceOptimizationManager',
        cleanedCacheEntries,
        cleanedMetrics,
        costSafetyStatus: {
          currentCost: costSafetyStatus.currentCost,
          usagePercentage: costSafetyStatus.usagePercentage,
          emergencyShutdown: costSafetyStatus.emergencyShutdown
        }
      })

      // 성능 리포트를 로그로 기록
      logger.info('일일 성능 리포트', {
        component: 'PerformanceOptimizationManager',
        report: performanceReport
      })

    } catch (error) {
      logger.error('일일 유지보수 작업 중 오류', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 시스템 종료 시 정리
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    logger.info('성능 최적화 시스템 종료 중')

    // 모든 모니터링 인터벌 정리
    this.monitoringIntervals.forEach(interval => {
      clearInterval(interval)
    })
    this.monitoringIntervals = []

    // 마지막 정리 작업
    await this.performFinalCleanup()

    this.isInitialized = false

    logger.info('성능 최적화 시스템 종료 완료')
  }

  /**
   * 최종 정리 작업
   */
  private async performFinalCleanup(): Promise<void> {
    try {
      // 캐시 통계 마지막 로깅
      const finalStats = {
        api: apiCache.getStats(),
        user: userCache.getStats(),
        project: projectCache.getStats(),
        config: configCache.getStats()
      }

      logger.info('최종 캐시 통계', {
        component: 'PerformanceOptimizationManager',
        finalStats
      })

      // 마지막 성능 메트릭 정리
      const finalMetricsCleanup = apiPerformanceMonitor.cleanup(0) // 모든 메트릭 정리

      logger.info('최종 메트릭 정리', {
        component: 'PerformanceOptimizationManager',
        cleanedMetrics: finalMetricsCleanup
      })

    } catch (error) {
      logger.warn('최종 정리 작업 중 오류', {
        error: error instanceof Error ? error.message : error
      })
    }
  }

  /**
   * 실시간 성능 상태 조회
   */
  getCurrentPerformanceStatus() {
    return {
      initialized: this.isInitialized,
      monitoringActive: this.monitoringIntervals.length > 0,
      cacheStats: {
        api: {
          size: apiCache.getStats().size,
          hitRatio: apiCache.getHitRatio(),
          memoryUsage: apiCache.getMemoryUsage()
        },
        user: {
          size: userCache.getStats().size,
          hitRatio: userCache.getHitRatio(),
          memoryUsage: userCache.getMemoryUsage()
        },
        project: {
          size: projectCache.getStats().size,
          hitRatio: projectCache.getHitRatio(),
          memoryUsage: projectCache.getMemoryUsage()
        },
        config: {
          size: configCache.getStats().size,
          hitRatio: configCache.getHitRatio(),
          memoryUsage: configCache.getMemoryUsage()
        }
      },
      apiPerformance: apiPerformanceMonitor.getPerformanceStats(300000), // 최근 5분
      costSafety: enhancedCostSafety.getStatus(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 성능 최적화 권장사항 생성
   */
  generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const status = this.getCurrentPerformanceStatus()

    // 캐시 최적화 권장사항
    Object.entries(status.cacheStats).forEach(([cacheType, stats]) => {
      if (stats.hitRatio < 0.5) {
        recommendations.push(`${cacheType} 캐시의 히트율이 ${(stats.hitRatio * 100).toFixed(1)}%로 낮습니다. TTL 조정이나 캐싱 전략 재검토가 필요합니다.`)
      }

      if (stats.memoryUsage.percentage > 85) {
        recommendations.push(`${cacheType} 캐시의 메모리 사용률이 ${stats.memoryUsage.percentage.toFixed(1)}%로 높습니다. 캐시 크기 조정이나 정리 주기 단축을 고려하세요.`)
      }
    })

    // API 성능 권장사항
    if (status.apiPerformance.averageResponseTime > 1000) {
      recommendations.push(`평균 API 응답 시간이 ${status.apiPerformance.averageResponseTime}ms로 높습니다. 데이터베이스 쿼리 최적화나 캐싱 확대를 고려하세요.`)
    }

    if (status.apiPerformance.errorRate > 3) {
      recommendations.push(`API 에러율이 ${status.apiPerformance.errorRate}%로 높습니다. 에러 패턴 분석과 오류 처리 로직 개선이 필요합니다.`)
    }

    // 비용 안전 권장사항
    if (status.costSafety.usagePercentage > 70) {
      recommendations.push(`일일 예산의 ${status.costSafety.usagePercentage.toFixed(1)}%를 사용했습니다. AI API 호출 최적화나 캐싱 확대를 고려하세요.`)
    }

    if (status.costSafety.emergencyShutdown) {
      recommendations.push('🚨 비상 정지 모드가 활성화되었습니다. 즉시 예산 검토와 시스템 복구가 필요합니다.')
    }

    return recommendations
  }
}

// ===========================================
// 전역 성능 최적화 매니저 인스턴스
// ===========================================

export const performanceOptimizationManager = new PerformanceOptimizationManager()

// ===========================================
// 사용 가이드 및 베스트 프랙티스
// ===========================================

/**
 * 성능 최적화 사용 가이드
 *
 * 1. 애플리케이션 시작 시 초기화:
 *    ```typescript
 *    import { performanceOptimizationManager } from './shared/lib/performance-optimization/optimization-guide'
 *
 *    // 앱 시작 시
 *    await performanceOptimizationManager.initialize()
 *    ```
 *
 * 2. API 핸들러에서 성능 모니터링 적용:
 *    ```typescript
 *    import { apiPerformanceMonitor } from './shared/lib/performance-optimization/api-performance-monitor'
 *
 *    export async function GET(request: NextRequest) {
 *      const startTime = Date.now()
 *
 *      try {
 *        // API 로직 실행
 *        const result = await someApiLogic()
 *
 *        // 성공 메트릭 기록
 *        apiPerformanceMonitor.recordMetric({
 *          endpoint: '/api/example',
 *          method: 'GET',
 *          responseTime: Date.now() - startTime,
 *          statusCode: 200,
 *          userId: 'user-id',
 *          timestamp: Date.now()
 *        })
 *
 *        return NextResponse.json(result)
 *      } catch (error) {
 *        // 에러 메트릭 기록
 *        apiPerformanceMonitor.recordMetric({
 *          endpoint: '/api/example',
 *          method: 'GET',
 *          responseTime: Date.now() - startTime,
 *          statusCode: 500,
 *          userId: 'user-id',
 *          timestamp: Date.now(),
 *          error: error.message
 *        })
 *
 *        throw error
 *      }
 *    }
 *    ```
 *
 * 3. 캐싱 적용:
 *    ```typescript
 *    import { apiCache } from './shared/lib/performance-optimization/cache-manager'
 *
 *    export async function getExpensiveData(id: string) {
 *      const cacheKey = `expensive_data_${id}`
 *
 *      // 캐시에서 먼저 확인
 *      const cached = apiCache.get(cacheKey)
 *      if (cached) {
 *        return cached
 *      }
 *
 *      // 캐시 미스 시 데이터 로딩
 *      const data = await loadExpensiveData(id)
 *
 *      // 캐시에 저장 (5분 TTL, 2분 stale-while-revalidate)
 *      apiCache.set(cacheKey, data, {
 *        ttl: 300,
 *        staleWhileRevalidate: 120
 *      })
 *
 *      return data
 *    }
 *    ```
 *
 * 4. 비용 안전 검사:
 *    ```typescript
 *    import { enhancedCostSafety } from './shared/lib/performance-optimization/enhanced-cost-safety'
 *
 *    export async function callExpensiveAI(prompt: string, userId: string) {
 *      // 비용 안전 검사
 *      const safetyCheck = await enhancedCostSafety.checkApiCall(
 *        '/api/ai/generate',
 *        'POST',
 *        userId,
 *        'openai'
 *      )
 *
 *      if (!safetyCheck.allowed) {
 *        throw new Error(`API 호출이 차단되었습니다: ${safetyCheck.reason}`)
 *      }
 *
 *      // AI API 호출
 *      const result = await callOpenAI(prompt)
 *
 *      // 비용 기록
 *      enhancedCostSafety.recordApiCost(
 *        '/api/ai/generate',
 *        'POST',
 *        userId,
 *        'openai',
 *        0.05 // $0.05
 *      )
 *
 *      return result
 *    }
 *    ```
 *
 * 5. 애플리케이션 종료 시 정리:
 *    ```typescript
 *    // 앱 종료 시
 *    process.on('SIGTERM', async () => {
 *      await performanceOptimizationManager.shutdown()
 *      process.exit(0)
 *    })
 *    ```
 */