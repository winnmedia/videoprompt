/**
 * Performance Monitoring Admin API
 *
 * 성능 모니터링 및 비용 안전 상태 조회 관리자 전용 API
 * CLAUDE.md 준수: 관리자 전용 접근, 성능 최적화 모니터링
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withApiHandler,
  validateQueryParams,
  createSuccessResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
} from '@/shared/api/planning-utils'

import logger from '@/shared/lib/structured-logger'
import {
  getAllCacheStats,
  cleanupAllCaches,
  apiCache,
  userCache,
  projectCache,
  configCache
} from '@/shared/lib/performance-optimization/cache-manager'
import {
  apiPerformanceMonitor,
  startPerformanceMonitoring
} from '@/shared/lib/performance-optimization/api-performance-monitor'
import { enhancedCostSafety } from '@/shared/lib/performance-optimization/enhanced-cost-safety'

// ===========================================
// 요청/응답 스키마
// ===========================================

const PerformanceQuerySchema = z.object({
  action: z.enum(['status', 'report', 'cleanup', 'reset']).default('status'),
  timeRange: z.number().min(300000).max(86400000).default(3600000), // 5분~24시간
  detailed: z.enum(['true', 'false']).transform(val => val === 'true').default(false),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// GET: 성능 모니터링 상태 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const queryData = validateQueryParams(request, PerformanceQuerySchema)

    // 관리자 권한 확인 (임시로 userId 기반 체크)
    if (!user?.userId || !isAdmin(user.userId)) {
      throw new PlanningApiError('관리자 권한이 필요합니다.', 'ADMIN_REQUIRED', 403)
    }

    logger.info('성능 모니터링 상태 조회', {
      userId: user.userId,
      component: 'PerformanceAdminAPI',
      metadata: {
        action: queryData.action,
        timeRange: queryData.timeRange,
        detailed: queryData.detailed,
      },
    })

    try {
      switch (queryData.action) {
        case 'status':
          return await getPerformanceStatus(queryData.timeRange, queryData.detailed)

        case 'report':
          return await generatePerformanceReport(queryData.timeRange)

        case 'cleanup':
          return await performCleanup()

        case 'reset':
          return await resetSystems()

        default:
          throw new PlanningApiError('지원하지 않는 액션입니다.', 'INVALID_ACTION', 400)
      }

    } catch (error) {
      logger.error(
        '성능 모니터링 API 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user.userId,
          component: 'PerformanceAdminAPI',
          metadata: queryData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: false, // 관리자 API는 비용 안전 적용 안함
    endpoint: '/api/admin/performance',
  }
)

// ===========================================
// POST: 성능 최적화 액션 실행
// ===========================================

const PerformanceActionSchema = z.object({
  action: z.enum(['emergency_reset', 'cache_warmup', 'optimize_queries', 'reset_cost_safety']),
  parameters: z.record(z.any()).optional(),
})

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 관리자 권한 확인
    if (!user?.userId || !isAdmin(user.userId)) {
      throw new PlanningApiError('관리자 권한이 필요합니다.', 'ADMIN_REQUIRED', 403)
    }

    const requestData = await request.json()
    const actionData = PerformanceActionSchema.parse(requestData)

    logger.info('성능 최적화 액션 실행', {
      userId: user.userId,
      component: 'PerformanceAdminAPI',
      metadata: {
        action: actionData.action,
        parameters: actionData.parameters,
      },
    })

    try {
      switch (actionData.action) {
        case 'emergency_reset':
          return await executeEmergencyReset()

        case 'cache_warmup':
          return await executeCacheWarmup(actionData.parameters)

        case 'optimize_queries':
          return await executeQueryOptimization()

        case 'reset_cost_safety':
          return await resetCostSafety()

        default:
          throw new PlanningApiError('지원하지 않는 액션입니다.', 'INVALID_ACTION', 400)
      }

    } catch (error) {
      logger.error(
        '성능 최적화 액션 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user.userId,
          component: 'PerformanceAdminAPI',
          metadata: actionData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: false,
    endpoint: '/api/admin/performance',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 관리자 권한 확인 (임시 구현)
 */
function isAdmin(userId: string): boolean {
  // TODO: 실제 관리자 권한 체크 로직 구현
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || []
  return adminUsers.includes(userId)
}

/**
 * 성능 상태 조회
 */
async function getPerformanceStatus(timeRange: number, detailed: boolean) {
  const cacheStats = getAllCacheStats()
  const apiStats = apiPerformanceMonitor.getPerformanceStats(timeRange)
  const costSafetyStatus = enhancedCostSafety.getStatus()

  const response = {
    timestamp: new Date().toISOString(),
    timeRange,
    overview: {
      systemHealth: calculateSystemHealth(apiStats, cacheStats, costSafetyStatus),
      totalRequests: apiStats.totalRequests,
      averageResponseTime: apiStats.averageResponseTime,
      errorRate: apiStats.errorRate,
      cacheHitRatio: calculateOverallCacheHitRatio(cacheStats),
      currentCost: costSafetyStatus.currentCost,
      costUsagePercentage: costSafetyStatus.usagePercentage,
    },
    apiPerformance: {
      ...apiStats,
      suggestions: apiPerformanceMonitor.getOptimizationSuggestions(),
    },
    cachePerformance: {
      ...cacheStats,
      hitRatios: {
        api: apiCache.getHitRatio(),
        user: userCache.getHitRatio(),
        project: projectCache.getHitRatio(),
        config: configCache.getHitRatio(),
      },
      memoryUsage: {
        api: apiCache.getMemoryUsage(),
        user: userCache.getMemoryUsage(),
        project: projectCache.getMemoryUsage(),
        config: configCache.getMemoryUsage(),
      },
    },
    costSafety: costSafetyStatus,
    alerts: generateAlerts(apiStats, cacheStats, costSafetyStatus),
  }

  if (detailed) {
    response.detailed = {
      endpointStats: Object.fromEntries(apiPerformanceMonitor.getAllEndpointStats()),
      cacheKeys: {
        api: apiCache.keys().length,
        user: userCache.keys().length,
        project: projectCache.keys().length,
        config: configCache.keys().length,
      },
      performanceHistory: apiPerformanceMonitor.getPerformanceStats(timeRange * 6), // 6배 긴 기간
    }
  }

  return createSuccessResponse(response)
}

/**
 * 성능 리포트 생성
 */
async function generatePerformanceReport(timeRange: number) {
  const report = apiPerformanceMonitor.generatePerformanceReport(timeRange)
  const cacheStats = getAllCacheStats()
  const costSafetyStatus = enhancedCostSafety.getStatus()

  const fullReport = `
${report}

💾 캐시 성능:
- 전체 히트율: ${(calculateOverallCacheHitRatio(cacheStats) * 100).toFixed(1)}%
- API 캐시: ${(apiCache.getHitRatio() * 100).toFixed(1)}% (${apiCache.getStats().size}/${apiCache.getStats().maxSize})
- 사용자 캐시: ${(userCache.getHitRatio() * 100).toFixed(1)}% (${userCache.getStats().size}/${userCache.getStats().maxSize})
- 프로젝트 캐시: ${(projectCache.getHitRatio() * 100).toFixed(1)}% (${projectCache.getStats().size}/${projectCache.getStats().maxSize})

💰 비용 안전:
- 현재 비용: $${costSafetyStatus.currentCost.toFixed(2)}
- 예산 사용률: ${costSafetyStatus.usagePercentage.toFixed(1)}%
- 남은 예산: $${costSafetyStatus.remainingBudget.toFixed(2)}
- 비상 정지: ${costSafetyStatus.emergencyShutdown ? '활성화' : '비활성화'}

🔍 최적화 제안:
${apiPerformanceMonitor.getOptimizationSuggestions().map(s => `- ${s}`).join('\n')}
`

  return createSuccessResponse({
    report: fullReport,
    timestamp: new Date().toISOString(),
    timeRange,
  })
}

/**
 * 시스템 정리 실행
 */
async function performCleanup() {
  const results = {
    cacheCleanup: cleanupAllCaches(),
    metricsCleanup: apiPerformanceMonitor.cleanup(),
    timestamp: new Date().toISOString(),
  }

  logger.info('시스템 정리 실행 완료', {
    component: 'PerformanceAdminAPI',
    results,
  })

  return createSuccessResponse({
    message: '시스템 정리가 완료되었습니다.',
    ...results,
  })
}

/**
 * 시스템 리셋 실행
 */
async function resetSystems() {
  // 캐시 전체 삭제
  apiCache.clear()
  userCache.clear()
  projectCache.clear()
  configCache.clear()

  // 성능 모니터링 리셋
  apiPerformanceMonitor.cleanup(0) // 모든 메트릭 삭제

  logger.warn('시스템 전체 리셋 실행', {
    component: 'PerformanceAdminAPI',
    timestamp: new Date().toISOString(),
  })

  return createSuccessResponse({
    message: '시스템이 리셋되었습니다.',
    timestamp: new Date().toISOString(),
  })
}

/**
 * 비상 리셋 실행
 */
async function executeEmergencyReset() {
  // 모든 캐시 클리어
  apiCache.clear()
  userCache.clear()
  projectCache.clear()
  configCache.clear()

  // 비용 안전 시스템 리셋
  enhancedCostSafety.resetEmergencyShutdown()

  // 성능 메트릭 정리
  apiPerformanceMonitor.cleanup(0)

  logger.error('비상 리셋 실행', {
    component: 'PerformanceAdminAPI',
    timestamp: new Date().toISOString(),
    reason: 'emergency_reset_requested',
  })

  return createSuccessResponse({
    message: '비상 리셋이 완료되었습니다. 모든 시스템이 초기화되었습니다.',
    timestamp: new Date().toISOString(),
  })
}

/**
 * 캐시 워밍업 실행
 */
async function executeCacheWarmup(parameters?: any) {
  // TODO: 주요 데이터 사전 로딩 로직 구현
  logger.info('캐시 워밍업 실행', {
    component: 'PerformanceAdminAPI',
    parameters,
  })

  return createSuccessResponse({
    message: '캐시 워밍업이 시작되었습니다.',
    timestamp: new Date().toISOString(),
  })
}

/**
 * 쿼리 최적화 실행
 */
async function executeQueryOptimization() {
  // TODO: 자동 쿼리 최적화 로직 구현
  logger.info('쿼리 최적화 실행', {
    component: 'PerformanceAdminAPI',
  })

  return createSuccessResponse({
    message: '쿼리 최적화가 시작되었습니다.',
    timestamp: new Date().toISOString(),
  })
}

/**
 * 비용 안전 시스템 리셋
 */
async function resetCostSafety() {
  enhancedCostSafety.resetEmergencyShutdown()

  logger.warn('비용 안전 시스템 리셋', {
    component: 'PerformanceAdminAPI',
    timestamp: new Date().toISOString(),
  })

  return createSuccessResponse({
    message: '비용 안전 시스템이 리셋되었습니다.',
    newStatus: enhancedCostSafety.getStatus(),
    timestamp: new Date().toISOString(),
  })
}

/**
 * 시스템 건강도 계산
 */
function calculateSystemHealth(apiStats: any, cacheStats: any, costSafetyStatus: any): 'healthy' | 'warning' | 'critical' {
  if (costSafetyStatus.emergencyShutdown || apiStats.errorRate > 10) {
    return 'critical'
  }

  if (
    apiStats.averageResponseTime > 1000 ||
    apiStats.errorRate > 5 ||
    costSafetyStatus.usagePercentage > 80
  ) {
    return 'warning'
  }

  return 'healthy'
}

/**
 * 전체 캐시 히트율 계산
 */
function calculateOverallCacheHitRatio(cacheStats: any): number {
  const totalHits = cacheStats.api.hits + cacheStats.user.hits + cacheStats.project.hits + cacheStats.config.hits
  const totalMisses = cacheStats.api.misses + cacheStats.user.misses + cacheStats.project.misses + cacheStats.config.misses
  const total = totalHits + totalMisses

  return total > 0 ? totalHits / total : 0
}

/**
 * 알림 생성
 */
function generateAlerts(apiStats: any, cacheStats: any, costSafetyStatus: any): string[] {
  const alerts: string[] = []

  if (costSafetyStatus.emergencyShutdown) {
    alerts.push('🚨 비상 정지 모드가 활성화되었습니다!')
  }

  if (costSafetyStatus.usagePercentage > 90) {
    alerts.push('💰 일일 예산의 90% 이상 사용되었습니다!')
  }

  if (apiStats.errorRate > 10) {
    alerts.push('⚠️ API 에러율이 10%를 초과했습니다!')
  }

  if (apiStats.averageResponseTime > 2000) {
    alerts.push('🐌 평균 응답 시간이 2초를 초과했습니다!')
  }

  const overallCacheHitRatio = calculateOverallCacheHitRatio(cacheStats)
  if (overallCacheHitRatio < 0.3) {
    alerts.push('💾 캐시 히트율이 30% 미만입니다!')
  }

  return alerts
}