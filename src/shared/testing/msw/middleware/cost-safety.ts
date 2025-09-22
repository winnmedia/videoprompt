/**
 * 비용 안전 미들웨어
 *
 * CLAUDE.md 준수: $300 사건 방지, API 호출 모니터링, 비용 안전
 * 테스트에서 실제 API 호출을 완전 차단하고 모니터링
 */

interface ApiCallLimit {
  maxCallsPerTest: number
  cooldownMs: number
}

interface ApiCallRecord {
  endpoint: string
  timestamp: number
  testName?: string
  callCount: number
}

interface CostSafetyStatus {
  totalCalls: number
  blockedCalls: number
  lastReset: number
  activeLimits: Record<string, ApiCallLimit>
  callHistory: ApiCallRecord[]
}

/**
 * 비용 안전 미들웨어 클래스
 */
class CostSafetyMiddleware {
  private static instance: CostSafetyMiddleware | null = null
  private callHistory: ApiCallRecord[] = []
  private endpointCounters = new Map<string, number>()
  private lastCallTimes = new Map<string, number>()
  private blockedCallCount = 0
  private startTime = Date.now()

  // $300 사건 방지를 위한 엄격한 기본 제한
  private readonly DEFAULT_LIMITS: Record<string, ApiCallLimit> = {
    '/api/auth/me': { maxCallsPerTest: 1, cooldownMs: 60000 }, // 가장 위험한 API
    '/api/auth/refresh': { maxCallsPerTest: 3, cooldownMs: 30000 },
    '/api/ai/generate-story': { maxCallsPerTest: 2, cooldownMs: 10000 },
    '/api/ai/generate-image': { maxCallsPerTest: 1, cooldownMs: 15000 },
    'default': { maxCallsPerTest: 10, cooldownMs: 1000 }
  }

  private customLimits: Record<string, ApiCallLimit> = {}

  private constructor() {}

  static getInstance(): CostSafetyMiddleware {
    if (!this.instance) {
      this.instance = new CostSafetyMiddleware()
    }
    return this.instance
  }

  /**
   * API 호출 안전성 체크
   */
  checkApiCall(
    endpoint: string,
    customLimits?: Record<string, ApiCallLimit>
  ): {
    allowed: boolean
    reason?: string
    retryAfter?: number
  } {
    const now = Date.now()
    const normalizedEndpoint = this.normalizeEndpoint(endpoint)

    // 커스텀 제한이 있으면 적용
    if (customLimits && customLimits[normalizedEndpoint]) {
      this.customLimits[normalizedEndpoint] = customLimits[normalizedEndpoint]
    }

    const limits = this.getEffectiveLimits(normalizedEndpoint)
    const currentCount = this.endpointCounters.get(normalizedEndpoint) || 0
    const lastCallTime = this.lastCallTimes.get(normalizedEndpoint) || 0

    // 호출 횟수 제한 체크
    if (currentCount >= limits.maxCallsPerTest) {
      this.blockedCallCount++
      return {
        allowed: false,
        reason: `API 호출 한도 초과: ${currentCount}/${limits.maxCallsPerTest} (${normalizedEndpoint})`,
        retryAfter: Math.ceil(limits.cooldownMs / 1000)
      }
    }

    // 쿨다운 시간 체크
    const timeSinceLastCall = now - lastCallTime
    if (timeSinceLastCall < limits.cooldownMs) {
      this.blockedCallCount++
      const remainingCooldown = limits.cooldownMs - timeSinceLastCall
      return {
        allowed: false,
        reason: `쿨다운 시간 미준수: ${Math.ceil(remainingCooldown / 1000)}초 대기 필요`,
        retryAfter: Math.ceil(remainingCooldown / 1000)
      }
    }

    // $300 사건 방지를 위한 특별 체크
    if (this.isHighRiskEndpoint(normalizedEndpoint)) {
      const riskCheck = this.checkHighRiskPattern(normalizedEndpoint)
      if (!riskCheck.allowed) {
        this.blockedCallCount++
        return riskCheck
      }
    }

    // 호출 허용 - 카운터 업데이트
    this.endpointCounters.set(normalizedEndpoint, currentCount + 1)
    this.lastCallTimes.set(normalizedEndpoint, now)

    // 호출 기록 추가
    this.callHistory.push({
      endpoint: normalizedEndpoint,
      timestamp: now,
      testName: this.getCurrentTestName(),
      callCount: currentCount + 1
    })

    return { allowed: true }
  }

  /**
   * 엔드포인트 정규화
   */
  private normalizeEndpoint(endpoint: string): string {
    // 동적 파라미터를 제거하여 패턴 매칭
    return endpoint.replace(/\/\d+/g, '/:id')
                  .replace(/\/[a-f0-9\-]{36}/g, '/:uuid')
                  .replace(/\/[a-z0-9\-_]{10,}/g, '/:token')
  }

  /**
   * 효과적인 제한 값 조회
   */
  private getEffectiveLimits(endpoint: string): ApiCallLimit {
    if (this.customLimits[endpoint]) {
      return this.customLimits[endpoint]
    }
    if (this.DEFAULT_LIMITS[endpoint]) {
      return this.DEFAULT_LIMITS[endpoint]
    }
    return this.DEFAULT_LIMITS.default
  }

  /**
   * 고위험 엔드포인트 체크
   */
  private isHighRiskEndpoint(endpoint: string): boolean {
    const highRiskPatterns = [
      '/api/auth/me',
      '/api/auth/refresh',
      '/api/ai/',
      '/api/generate'
    ]
    return highRiskPatterns.some(pattern => endpoint.includes(pattern))
  }

  /**
   * 고위험 패턴 체크 ($300 사건 방지)
   */
  private checkHighRiskPattern(endpoint: string): {
    allowed: boolean
    reason?: string
    retryAfter?: number
  } {
    const now = Date.now()
    const recentCalls = this.callHistory.filter(
      call => call.endpoint === endpoint && (now - call.timestamp) < 60000 // 1분 내
    )

    // /api/auth/me 특별 보호
    if (endpoint.includes('/api/auth/me')) {
      if (recentCalls.length > 0) {
        return {
          allowed: false,
          reason: '🚨 $300 패턴 감지: /api/auth/me는 테스트당 1회만 허용',
          retryAfter: 60
        }
      }
    }

    // AI API 특별 보호
    if (endpoint.includes('/api/ai/')) {
      const aiCallsInLast5Min = this.callHistory.filter(
        call => call.endpoint.includes('/api/ai/') && (now - call.timestamp) < 300000 // 5분 내
      )

      if (aiCallsInLast5Min.length >= 5) {
        return {
          allowed: false,
          reason: '🚨 AI API 호출 과다: 5분 내 5회 제한',
          retryAfter: 300
        }
      }
    }

    // 전체 API 호출 빈도 체크
    const totalRecentCalls = this.callHistory.filter(
      call => (now - call.timestamp) < 60000 // 1분 내
    )

    if (totalRecentCalls.length > 50) {
      return {
        allowed: false,
        reason: '🚨 API 호출 폭주 감지: 1분 내 50회 제한',
        retryAfter: 60
      }
    }

    return { allowed: true }
  }

  /**
   * 현재 테스트 이름 추출
   */
  private getCurrentTestName(): string {
    // Jest 환경에서 현재 테스트 이름 추출
    if (typeof expect !== 'undefined' && (expect as any).getState) {
      const state = (expect as any).getState()
      return state.currentTestName || 'unknown-test'
    }
    return 'unknown-test'
  }

  /**
   * 호출 기록 조회
   */
  getCallHistory(): ApiCallRecord[] {
    return [...this.callHistory]
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): CostSafetyStatus {
    return {
      totalCalls: this.callHistory.length,
      blockedCalls: this.blockedCallCount,
      lastReset: this.startTime,
      activeLimits: { ...this.DEFAULT_LIMITS, ...this.customLimits },
      callHistory: [...this.callHistory]
    }
  }

  /**
   * 통계 조회
   */
  getStatistics(): {
    endpointCounts: Record<string, number>
    averageCallInterval: number
    mostCalledEndpoint: string
    riskScore: number
  } {
    const endpointCounts: Record<string, number> = {}
    let totalInterval = 0
    let intervalCount = 0

    this.callHistory.forEach((call, index) => {
      endpointCounts[call.endpoint] = (endpointCounts[call.endpoint] || 0) + 1

      if (index > 0) {
        totalInterval += call.timestamp - this.callHistory[index - 1].timestamp
        intervalCount++
      }
    })

    const mostCalledEndpoint = Object.entries(endpointCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'

    // 위험 점수 계산 (0-100)
    const riskScore = Math.min(100, (
      (this.blockedCallCount * 10) +
      (this.callHistory.length * 0.5) +
      (this.getHighRiskCallCount() * 20)
    ))

    return {
      endpointCounts,
      averageCallInterval: intervalCount > 0 ? totalInterval / intervalCount : 0,
      mostCalledEndpoint,
      riskScore
    }
  }

  /**
   * 고위험 호출 수 계산
   */
  private getHighRiskCallCount(): number {
    return this.callHistory.filter(call =>
      this.isHighRiskEndpoint(call.endpoint)
    ).length
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.callHistory = []
    this.endpointCounters.clear()
    this.lastCallTimes.clear()
    this.blockedCallCount = 0
    this.customLimits = {}
    this.startTime = Date.now()
  }

  /**
   * 커스텀 제한 설정
   */
  setCustomLimits(limits: Record<string, ApiCallLimit>): void {
    this.customLimits = { ...this.customLimits, ...limits }
  }

  /**
   * 비상 정지 (모든 API 호출 차단)
   */
  emergencyStop(): void {
    this.customLimits = Object.keys(this.DEFAULT_LIMITS).reduce((acc, key) => {
      acc[key] = { maxCallsPerTest: 0, cooldownMs: 999999 }
      return acc
    }, {} as Record<string, ApiCallLimit>)
  }

  /**
   * 위험 알림 생성
   */
  generateRiskAlert(): string | null {
    const stats = this.getStatistics()

    if (stats.riskScore > 80) {
      return `🚨 HIGH RISK: 위험 점수 ${stats.riskScore}/100, 즉시 테스트 중단 권장`
    }

    if (stats.riskScore > 60) {
      return `⚠️ MEDIUM RISK: 위험 점수 ${stats.riskScore}/100, API 사용량 검토 필요`
    }

    if (this.blockedCallCount > 5) {
      return `⚠️ 차단된 호출 과다: ${this.blockedCallCount}회, 테스트 로직 검토 필요`
    }

    return null
  }
}

/**
 * 싱글톤 인스턴스 내보내기
 */
export const costSafetyMiddleware = CostSafetyMiddleware.getInstance()

/**
 * 테스트 유틸리티 함수들
 */
export const costSafetyUtils = {
  // 안전한 테스트 래퍼
  wrapTest: <T extends (...args: any[]) => any>(
    testFn: T,
    customLimits?: Record<string, ApiCallLimit>
  ): T => {
    return ((...args: any[]) => {
      costSafetyMiddleware.reset()
      if (customLimits) {
        costSafetyMiddleware.setCustomLimits(customLimits)
      }

      try {
        const result = testFn(...args)

        // Promise인 경우 처리
        if (result && typeof result.then === 'function') {
          return result.finally(() => {
            const alert = costSafetyMiddleware.generateRiskAlert()
            if (alert) {
              console.warn(alert)
            }
          })
        }

        const alert = costSafetyMiddleware.generateRiskAlert()
        if (alert) {
          console.warn(alert)
        }

        return result
      } catch (error) {
        const alert = costSafetyMiddleware.generateRiskAlert()
        if (alert) {
          console.warn(alert)
        }
        throw error
      }
    }) as T
  },

  // 안전 체크 함수
  checkSafety: () => {
    const status = costSafetyMiddleware.getStatus()
    const stats = costSafetyMiddleware.getStatistics()

    if (stats.riskScore > 50) {
      throw new Error(`테스트 안전성 검사 실패: 위험 점수 ${stats.riskScore}/100`)
    }

    return {
      safe: true,
      status,
      stats
    }
  },

  // 비용 추정
  estimateCost: () => {
    const history = costSafetyMiddleware.getCallHistory()
    const aiCalls = history.filter(call => call.endpoint.includes('/api/ai/'))

    // 추정 비용 (테스트용)
    const estimatedCost = aiCalls.length * 0.05 // AI 호출당 $0.05
    const maxSafeCost = 1.00 // 테스트당 최대 $1

    return {
      estimatedCost,
      maxSafeCost,
      safe: estimatedCost <= maxSafeCost,
      aiCallCount: aiCalls.length
    }
  }
}