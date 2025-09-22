/**
 * Enhanced Cost Safety System
 *
 * CLAUDE.md 준수: $300 사건 방지를 위한 고도화된 비용 안전 시스템
 * 다층 방어 시스템으로 API 비용 폭탄 방지
 */

import logger from '../logger'
import { apiCache } from './cache-manager'
import { apiPerformanceMonitor } from './api-performance-monitor'

// ===========================================
// 타입 정의
// ===========================================

interface CostSafetyConfig {
  dailyBudget: number // 일일 예산 (USD)
  hourlyLimit: number // 시간당 요청 제한
  minuteLimit: number // 분당 요청 제한
  userDailyLimit: number // 사용자별 일일 제한
  emergencyThreshold: number // 비상 정지 임계값
  aiProviderLimits: {
    gemini: { dailyRequests: number; costPerRequest: number }
    bytedance: { dailyRequests: number; costPerRequest: number }
    openai: { dailyRequests: number; costPerRequest: number }
  }
}

interface UsageStats {
  totalCost: number
  requestCount: number
  costByProvider: Record<string, number>
  requestsByProvider: Record<string, number>
  costByUser: Record<string, number>
  requestsByUser: Record<string, number>
  timestamp: number
}

interface CostSafetyResult {
  allowed: boolean
  reason?: string
  remainingBudget?: number
  currentCost?: number
  warningLevel?: 'low' | 'medium' | 'high' | 'critical'
  suggestedAction?: string
}

// ===========================================
// 고도화된 비용 안전 시스템
// ===========================================

export class EnhancedCostSafetySystem {
  private config: CostSafetyConfig
  private usageHistory: UsageStats[] = []
  private emergencyShutdown = false
  private warningsSent = new Set<string>()

  constructor(config: CostSafetyConfig) {
    this.config = config
    this.initializeMonitoring()
  }

  /**
   * API 호출 비용 안전 검사
   */
  async checkApiCall(
    endpoint: string,
    method: string,
    userId: string,
    provider: 'gemini' | 'bytedance' | 'openai' | 'internal' = 'internal'
  ): Promise<CostSafetyResult> {
    // 비상 정지 상태 체크
    if (this.emergencyShutdown) {
      return {
        allowed: false,
        reason: '비상 정지 모드가 활성화되었습니다. 관리자에게 문의하세요.',
        warningLevel: 'critical',
        suggestedAction: 'CONTACT_ADMIN',
      }
    }

    // 현재 사용량 통계 계산
    const currentStats = this.getCurrentUsageStats()

    // 1. 일일 예산 체크
    const budgetCheck = this.checkDailyBudget(currentStats, provider)
    if (!budgetCheck.allowed) return budgetCheck

    // 2. 사용자별 제한 체크
    const userCheck = this.checkUserLimits(currentStats, userId, provider)
    if (!userCheck.allowed) return userCheck

    // 3. 시간당/분당 제한 체크
    const rateCheck = this.checkRateLimits(endpoint, method)
    if (!rateCheck.allowed) return rateCheck

    // 4. AI 제공업체별 제한 체크
    const providerCheck = this.checkProviderLimits(currentStats, provider)
    if (!providerCheck.allowed) return providerCheck

    // 5. 이상 패턴 감지
    const anomalyCheck = this.detectAnomalousUsage(currentStats, userId, provider)
    if (!anomalyCheck.allowed) return anomalyCheck

    // 6. 캐시 활용 가능성 체크
    const cacheCheck = this.checkCacheOptimization(endpoint, method)

    return {
      allowed: true,
      remainingBudget: this.config.dailyBudget - currentStats.totalCost,
      currentCost: currentStats.totalCost,
      warningLevel: this.calculateWarningLevel(currentStats),
      suggestedAction: cacheCheck.suggestion,
    }
  }

  /**
   * API 호출 비용 기록
   */
  recordApiCost(
    endpoint: string,
    method: string,
    userId: string,
    provider: 'gemini' | 'bytedance' | 'openai' | 'internal',
    cost: number
  ): void {
    const now = Date.now()

    // 현재 시간대의 통계 업데이트
    let currentStats = this.usageHistory.find(
      stats => Math.floor(stats.timestamp / (60 * 60 * 1000)) === Math.floor(now / (60 * 60 * 1000))
    )

    if (!currentStats) {
      currentStats = {
        totalCost: 0,
        requestCount: 0,
        costByProvider: {},
        requestsByProvider: {},
        costByUser: {},
        requestsByUser: {},
        timestamp: now,
      }
      this.usageHistory.push(currentStats)
    }

    // 통계 업데이트
    currentStats.totalCost += cost
    currentStats.requestCount++
    currentStats.costByProvider[provider] = (currentStats.costByProvider[provider] || 0) + cost
    currentStats.requestsByProvider[provider] = (currentStats.requestsByProvider[provider] || 0) + 1
    currentStats.costByUser[userId] = (currentStats.costByUser[userId] || 0) + cost
    currentStats.requestsByUser[userId] = (currentStats.requestsByUser[userId] || 0) + 1

    // 로깅
    logger.info('API 비용 기록', {
      component: 'EnhancedCostSafety',
      endpoint,
      method,
      userId,
      provider,
      cost,
      totalDailyCost: this.getCurrentUsageStats().totalCost,
    })

    // 실시간 임계값 체크
    this.checkRealTimeThresholds()

    // 사용량 기록 정리 (24시간 이상된 데이터 삭제)
    this.cleanupOldUsageData()
  }

  /**
   * 일일 예산 체크
   */
  private checkDailyBudget(stats: UsageStats, provider: string): CostSafetyResult {
    const estimatedCost = this.config.aiProviderLimits[provider as keyof typeof this.config.aiProviderLimits]?.costPerRequest || 0.01
    const projectedCost = stats.totalCost + estimatedCost

    if (projectedCost > this.config.dailyBudget) {
      return {
        allowed: false,
        reason: `일일 예산 초과 예상 ($${projectedCost.toFixed(2)} > $${this.config.dailyBudget})`,
        currentCost: stats.totalCost,
        remainingBudget: this.config.dailyBudget - stats.totalCost,
        warningLevel: 'critical',
        suggestedAction: 'WAIT_NEXT_DAY',
      }
    }

    // 80% 이상 사용 시 경고
    if (projectedCost > this.config.dailyBudget * 0.8) {
      return {
        allowed: true,
        remainingBudget: this.config.dailyBudget - stats.totalCost,
        currentCost: stats.totalCost,
        warningLevel: 'high',
        suggestedAction: 'REDUCE_USAGE',
      }
    }

    return { allowed: true }
  }

  /**
   * 사용자별 제한 체크
   */
  private checkUserLimits(stats: UsageStats, userId: string, provider: string): CostSafetyResult {
    const userRequests = stats.requestsByUser[userId] || 0
    const estimatedRequests = userRequests + 1

    if (estimatedRequests > this.config.userDailyLimit) {
      return {
        allowed: false,
        reason: `사용자별 일일 제한 초과 (${estimatedRequests} > ${this.config.userDailyLimit})`,
        warningLevel: 'high',
        suggestedAction: 'WAIT_NEXT_DAY',
      }
    }

    return { allowed: true }
  }

  /**
   * 시간당/분당 제한 체크
   */
  private checkRateLimits(endpoint: string, method: string): CostSafetyResult {
    const now = Date.now()

    // 최근 1시간 요청 수 계산
    const hourlyRequests = this.usageHistory
      .filter(stats => now - stats.timestamp < 60 * 60 * 1000)
      .reduce((sum, stats) => sum + stats.requestCount, 0)

    if (hourlyRequests >= this.config.hourlyLimit) {
      return {
        allowed: false,
        reason: `시간당 요청 제한 초과 (${hourlyRequests} >= ${this.config.hourlyLimit})`,
        warningLevel: 'high',
        suggestedAction: 'WAIT_HOUR',
      }
    }

    // 최근 1분 요청 수 계산
    const minutelyRequests = this.usageHistory
      .filter(stats => now - stats.timestamp < 60 * 1000)
      .reduce((sum, stats) => sum + stats.requestCount, 0)

    if (minutelyRequests >= this.config.minuteLimit) {
      return {
        allowed: false,
        reason: `분당 요청 제한 초과 (${minutelyRequests} >= ${this.config.minuteLimit})`,
        warningLevel: 'medium',
        suggestedAction: 'WAIT_MINUTE',
      }
    }

    return { allowed: true }
  }

  /**
   * AI 제공업체별 제한 체크
   */
  private checkProviderLimits(stats: UsageStats, provider: string): CostSafetyResult {
    if (provider === 'internal') return { allowed: true }

    const providerConfig = this.config.aiProviderLimits[provider as keyof typeof this.config.aiProviderLimits]
    if (!providerConfig) return { allowed: true }

    const providerRequests = stats.requestsByProvider[provider] || 0

    if (providerRequests >= providerConfig.dailyRequests) {
      return {
        allowed: false,
        reason: `${provider} 일일 요청 제한 초과 (${providerRequests} >= ${providerConfig.dailyRequests})`,
        warningLevel: 'high',
        suggestedAction: 'USE_DIFFERENT_PROVIDER',
      }
    }

    return { allowed: true }
  }

  /**
   * 이상 사용 패턴 감지
   */
  private detectAnomalousUsage(stats: UsageStats, userId: string, provider: string): CostSafetyResult {
    // 사용자의 최근 요청 빈도 체크
    const userRequests = stats.requestsByUser[userId] || 0
    const averageUserRequests = Object.values(stats.requestsByUser).reduce((sum, req) => sum + req, 0) / Object.keys(stats.requestsByUser).length

    // 평균보다 10배 이상 많은 요청
    if (userRequests > averageUserRequests * 10 && userRequests > 100) {
      logger.warn('이상 사용 패턴 감지', {
        component: 'EnhancedCostSafety',
        userId,
        userRequests,
        averageUserRequests,
        provider,
      })

      return {
        allowed: false,
        reason: '이상 사용 패턴이 감지되었습니다. 잠시 후 다시 시도해주세요.',
        warningLevel: 'critical',
        suggestedAction: 'CONTACT_SUPPORT',
      }
    }

    return { allowed: true }
  }

  /**
   * 캐시 최적화 체크
   */
  private checkCacheOptimization(endpoint: string, method: string): { suggestion?: string } {
    if (method === 'GET') {
      const cacheKey = `${method}:${endpoint}`
      if (apiCache.has(cacheKey)) {
        return { suggestion: 'CACHE_HIT' }
      } else {
        return { suggestion: 'CACHE_MISS_CONSIDER_CACHING' }
      }
    }

    return {}
  }

  /**
   * 현재 사용량 통계 계산
   */
  private getCurrentUsageStats(): UsageStats {
    const now = Date.now()
    const todayStart = new Date().setHours(0, 0, 0, 0)

    // 오늘의 모든 통계 합산
    const todayStats = this.usageHistory.filter(
      stats => stats.timestamp >= todayStart
    )

    const aggregated: UsageStats = {
      totalCost: 0,
      requestCount: 0,
      costByProvider: {},
      requestsByProvider: {},
      costByUser: {},
      requestsByUser: {},
      timestamp: now,
    }

    todayStats.forEach(stats => {
      aggregated.totalCost += stats.totalCost
      aggregated.requestCount += stats.requestCount

      // Provider별 합산
      Object.entries(stats.costByProvider).forEach(([provider, cost]) => {
        aggregated.costByProvider[provider] = (aggregated.costByProvider[provider] || 0) + cost
      })

      Object.entries(stats.requestsByProvider).forEach(([provider, requests]) => {
        aggregated.requestsByProvider[provider] = (aggregated.requestsByProvider[provider] || 0) + requests
      })

      // User별 합산
      Object.entries(stats.costByUser).forEach(([user, cost]) => {
        aggregated.costByUser[user] = (aggregated.costByUser[user] || 0) + cost
      })

      Object.entries(stats.requestsByUser).forEach(([user, requests]) => {
        aggregated.requestsByUser[user] = (aggregated.requestsByUser[user] || 0) + requests
      })
    })

    return aggregated
  }

  /**
   * 경고 레벨 계산
   */
  private calculateWarningLevel(stats: UsageStats): 'low' | 'medium' | 'high' | 'critical' {
    const usagePercentage = (stats.totalCost / this.config.dailyBudget) * 100

    if (usagePercentage >= 90) return 'critical'
    if (usagePercentage >= 75) return 'high'
    if (usagePercentage >= 50) return 'medium'
    return 'low'
  }

  /**
   * 실시간 임계값 체크
   */
  private checkRealTimeThresholds(): void {
    const stats = this.getCurrentUsageStats()
    const usagePercentage = (stats.totalCost / this.config.dailyBudget) * 100

    // 비상 정지 (95% 이상)
    if (usagePercentage >= 95 && !this.emergencyShutdown) {
      this.emergencyShutdown = true
      logger.error('비상 정지 모드 활성화', {
        component: 'EnhancedCostSafety',
        currentCost: stats.totalCost,
        dailyBudget: this.config.dailyBudget,
        usagePercentage,
      })
    }

    // 경고 발송 (중복 방지)
    const warningKey = `${Math.floor(usagePercentage / 10) * 10}%` // 10% 단위로 그룹화

    if (usagePercentage >= 80 && !this.warningsSent.has(warningKey)) {
      this.warningsSent.add(warningKey)

      logger.warn('일일 예산 사용량 경고', {
        component: 'EnhancedCostSafety',
        currentCost: stats.totalCost,
        dailyBudget: this.config.dailyBudget,
        usagePercentage: Math.round(usagePercentage),
        remainingBudget: this.config.dailyBudget - stats.totalCost,
      })
    }
  }

  /**
   * 오래된 사용량 데이터 정리
   */
  private cleanupOldUsageData(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24시간 전
    this.usageHistory = this.usageHistory.filter(stats => stats.timestamp > cutoffTime)
  }

  /**
   * 모니터링 초기화
   */
  private initializeMonitoring(): void {
    // 매시간 경고 상태 리셋
    setInterval(() => {
      this.warningsSent.clear()
    }, 60 * 60 * 1000)

    // 매일 자정 비상 정지 해제 (수동 확인 후)
    setInterval(() => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        if (this.emergencyShutdown) {
          logger.info('일일 예산 리셋 - 비상 정지 모드 검토 필요', {
            component: 'EnhancedCostSafety',
            previousDayCost: this.getCurrentUsageStats().totalCost,
          })
        }
      }
    }, 60 * 1000)
  }

  /**
   * 비상 정지 수동 해제
   */
  resetEmergencyShutdown(): void {
    this.emergencyShutdown = false
    this.warningsSent.clear()

    logger.info('비상 정지 모드 수동 해제', {
      component: 'EnhancedCostSafety',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * 비용 안전 상태 조회
   */
  getStatus() {
    const stats = this.getCurrentUsageStats()

    return {
      emergencyShutdown: this.emergencyShutdown,
      currentCost: stats.totalCost,
      dailyBudget: this.config.dailyBudget,
      usagePercentage: (stats.totalCost / this.config.dailyBudget) * 100,
      remainingBudget: this.config.dailyBudget - stats.totalCost,
      warningLevel: this.calculateWarningLevel(stats),
      requestCount: stats.requestCount,
      costByProvider: stats.costByProvider,
      requestsByProvider: stats.requestsByProvider,
    }
  }
}

// ===========================================
// 전역 인스턴스 및 설정
// ===========================================

const defaultConfig: CostSafetyConfig = {
  dailyBudget: 50, // $50 일일 예산
  hourlyLimit: 1000, // 시간당 1000회
  minuteLimit: 100, // 분당 100회
  userDailyLimit: 200, // 사용자별 일일 200회
  emergencyThreshold: 45, // $45에서 비상 정지
  aiProviderLimits: {
    gemini: { dailyRequests: 1000, costPerRequest: 0.01 },
    bytedance: { dailyRequests: 500, costPerRequest: 0.05 },
    openai: { dailyRequests: 200, costPerRequest: 0.10 },
  },
}

export const enhancedCostSafety = new EnhancedCostSafetySystem(defaultConfig)