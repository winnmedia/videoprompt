/**
 * Video Generation Cost Safety Middleware
 *
 * $300 사건 재발 방지를 위한 엄격한 비용 안전 미들웨어
 * CLAUDE.md 준수: 비용 안전 규칙, 절대 위반 금지
 */

import {
  CostSafetyError,
  QuotaExceededError,
  type VideoGenerationProvider as ProviderType,
  type CostSafetyLimits,
  type UsageStats
} from './types'

/**
 * 비용 안전 미들웨어 기본 클래스
 * 각 제공업체별로 상속하여 특화된 안전 규칙 적용
 */
export abstract class CostSafetyMiddleware {
  protected static instances = new Map<ProviderType, CostSafetyMiddleware>()

  protected lastCallTime = 0
  protected callCount = 0
  protected callTimes: number[] = []
  protected hourlyCallTimes: number[] = []
  protected dailyCost = 0
  protected monthlyCost = 0
  protected lastResetDate = new Date().toDateString()

  protected abstract readonly provider: ProviderType
  protected abstract readonly limits: CostSafetyLimits

  /**
   * 싱글톤 패턴으로 인스턴스 관리
   */
  static getInstance<T extends CostSafetyMiddleware>(
    this: new () => T,
    provider: ProviderType
  ): T {
    if (!CostSafetyMiddleware.instances.has(provider)) {
      CostSafetyMiddleware.instances.set(provider, new this())
    }
    return CostSafetyMiddleware.instances.get(provider) as T
  }

  /**
   * 비용 안전 검사 - 절대 위반 불가
   */
  async checkSafety(estimatedCost: number = 0): Promise<void> {
    const now = Date.now()

    // 날짜가 바뀌면 일일 통계 리셋
    this.resetDailyStatsIfNeeded()

    // 1. 최소 간격 검사 (절대 위반 불가)
    await this.checkMinInterval(now)

    // 2. 시간당 요청 한도 검사
    await this.checkHourlyLimit(now)

    // 3. 일일 비용 한도 검사
    await this.checkDailyCostLimit(estimatedCost)

    // 4. 월간 비용 한도 검사
    await this.checkMonthlyCostLimit(estimatedCost)

    // 모든 검사 통과 시 호출 기록
    this.recordCall(now, estimatedCost)
  }

  /**
   * 최소 간격 검사 - $300 사건 핵심 방지책
   */
  private async checkMinInterval(now: number): Promise<void> {
    const timeSinceLastCall = now - this.lastCallTime
    const requiredInterval = this.limits.minRequestInterval

    if (timeSinceLastCall < requiredInterval) {
      const waitTime = requiredInterval - timeSinceLastCall
      throw new CostSafetyError(
        `${this.provider} API 호출 간격이 너무 짧습니다. ${waitTime/1000}초 후 다시 시도해주세요.`,
        this.provider,
        {
          waitTime,
          requiredInterval,
          timeSinceLastCall,
          lastCallTime: this.lastCallTime
        }
      )
    }
  }

  /**
   * 시간당 요청 한도 검사
   */
  private async checkHourlyLimit(now: number): Promise<void> {
    // 1시간 이내 호출 기록 필터링
    const oneHourAgo = now - 3600000
    this.hourlyCallTimes = this.hourlyCallTimes.filter(time => time > oneHourAgo)

    if (this.hourlyCallTimes.length >= this.limits.maxRequestsPerHour) {
      throw new QuotaExceededError(
        `${this.provider} API 시간당 호출 한도(${this.limits.maxRequestsPerHour}회)를 초과했습니다. 1시간 후 다시 시도해주세요.`,
        this.provider,
        {
          currentCalls: this.hourlyCallTimes.length,
          maxCalls: this.limits.maxRequestsPerHour,
          resetTime: Math.min(...this.hourlyCallTimes) + 3600000
        }
      )
    }
  }

  /**
   * 일일 비용 한도 검사
   */
  private async checkDailyCostLimit(estimatedCost: number): Promise<void> {
    const projectedDailyCost = this.dailyCost + estimatedCost

    if (projectedDailyCost > this.limits.maxDailyCost) {
      throw new CostSafetyError(
        `${this.provider} API 일일 비용 한도($${this.limits.maxDailyCost})를 초과할 수 있습니다. 현재: $${this.dailyCost}, 예상: $${projectedDailyCost}`,
        this.provider,
        {
          currentCost: this.dailyCost,
          estimatedCost,
          projectedCost: projectedDailyCost,
          limit: this.limits.maxDailyCost
        }
      )
    }

    // 경고 임계값 체크
    if (projectedDailyCost > this.limits.alertThresholds.dailyCost) {
      console.warn(`⚠️ ${this.provider} 일일 비용 경고: $${projectedDailyCost}/$${this.limits.maxDailyCost}`)
    }
  }

  /**
   * 월간 비용 한도 검사
   */
  private async checkMonthlyCostLimit(estimatedCost: number): Promise<void> {
    const projectedMonthlyCost = this.monthlyCost + estimatedCost

    if (projectedMonthlyCost > this.limits.maxMonthlyCost) {
      throw new CostSafetyError(
        `${this.provider} API 월간 비용 한도($${this.limits.maxMonthlyCost})를 초과할 수 있습니다. 현재: $${this.monthlyCost}, 예상: $${projectedMonthlyCost}`,
        this.provider,
        {
          currentCost: this.monthlyCost,
          estimatedCost,
          projectedCost: projectedMonthlyCost,
          limit: this.limits.maxMonthlyCost
        }
      )
    }

    // 경고 임계값 체크
    if (projectedMonthlyCost > this.limits.alertThresholds.monthlyCost) {
      console.warn(`⚠️ ${this.provider} 월간 비용 경고: $${projectedMonthlyCost}/$${this.limits.maxMonthlyCost}`)
    }
  }

  /**
   * 호출 기록
   */
  private recordCall(now: number, actualCost: number): void {
    this.lastCallTime = now
    this.callCount++
    this.callTimes.push(now)
    this.hourlyCallTimes.push(now)
    this.dailyCost += actualCost
    this.monthlyCost += actualCost

    // 1분 이내 호출만 유지 (메모리 효율성)
    const oneMinuteAgo = now - 60000
    this.callTimes = this.callTimes.filter(time => time > oneMinuteAgo)
  }

  /**
   * 일일 통계 리셋 (날짜 변경 시)
   */
  private resetDailyStatsIfNeeded(): void {
    const today = new Date().toDateString()
    if (this.lastResetDate !== today) {
      this.dailyCost = 0
      this.lastResetDate = today

      // 월초인 경우 월간 통계도 리셋
      const now = new Date()
      if (now.getDate() === 1) {
        this.monthlyCost = 0
      }
    }
  }

  /**
   * 사용량 통계 조회
   */
  getStats(): UsageStats {
    const now = Date.now()
    return {
      totalCalls: this.callCount,
      lastCallTime: this.lastCallTime,
      recentCalls: this.callTimes.filter(time => now - time < 60000).length,
      hourlyRecentCalls: this.hourlyCallTimes.filter(time => now - time < 3600000).length,
      nextAvailableTime: this.lastCallTime + this.limits.minRequestInterval,
      timeUntilNextCall: Math.max(0, (this.lastCallTime + this.limits.minRequestInterval) - now),
      totalCost: this.monthlyCost,
      monthlyCost: this.monthlyCost
    }
  }

  /**
   * 통계 리셋 (테스트용)
   */
  reset(): void {
    this.lastCallTime = 0
    this.callCount = 0
    this.callTimes = []
    this.hourlyCallTimes = []
    this.dailyCost = 0
    this.monthlyCost = 0
    this.lastResetDate = new Date().toDateString()
  }

  /**
   * 실제 비용 업데이트 (API 응답 후 호출)
   */
  updateActualCost(actualCost: number): void {
    // 일반적으로 실제 비용은 예상 비용과 유사하므로 추가 업데이트만 수행
    this.dailyCost += actualCost
    this.monthlyCost += actualCost
  }
}

/**
 * Runway 전용 비용 안전 미들웨어
 */
export class RunwayCostSafetyMiddleware extends CostSafetyMiddleware {
  protected readonly provider: ProviderType = 'runway'
  protected readonly limits: CostSafetyLimits = {
    maxDailyCost: 50, // $50/일
    maxMonthlyCost: 500, // $500/월
    maxRequestsPerHour: 20, // 시간당 20회
    minRequestInterval: 15000, // 15초 간격 (영상 생성은 더 비싸므로 엄격)
    alertThresholds: {
      dailyCost: 40, // $40에서 경고
      monthlyCost: 400, // $400에서 경고
      requestRate: 15 // 시간당 15회에서 경고
    }
  }
}

/**
 * Seedance 전용 비용 안전 미들웨어
 */
export class SeedanceCostSafetyMiddleware extends CostSafetyMiddleware {
  protected readonly provider: ProviderType = 'seedance'
  protected readonly limits: CostSafetyLimits = {
    maxDailyCost: 30, // $30/일
    maxMonthlyCost: 300, // $300/월
    maxRequestsPerHour: 25, // 시간당 25회
    minRequestInterval: 12000, // 12초 간격
    alertThresholds: {
      dailyCost: 25, // $25에서 경고
      monthlyCost: 250, // $250에서 경고
      requestRate: 20 // 시간당 20회에서 경고
    }
  }
}

/**
 * StableVideo 전용 비용 안전 미들웨어
 */
export class StableVideoCostSafetyMiddleware extends CostSafetyMiddleware {
  protected readonly provider: ProviderType = 'stable-video'
  protected readonly limits: CostSafetyLimits = {
    maxDailyCost: 40, // $40/일
    maxMonthlyCost: 400, // $400/월
    maxRequestsPerHour: 30, // 시간당 30회
    minRequestInterval: 10000, // 10초 간격
    alertThresholds: {
      dailyCost: 30, // $30에서 경고
      monthlyCost: 320, // $320에서 경고
      requestRate: 25 // 시간당 25회에서 경고
    }
  }
}