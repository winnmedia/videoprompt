import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceAlertsSystem } from '../performance-alerts'
import type { PerformanceMetrics, PerformanceBudget } from '@/entities/performance'

// Mock data
const mockPerformanceMetrics: PerformanceMetrics = {
  sessionId: 'test-session-123',
  userId: 'user-123',
  timestamp: Date.now(),
  pathname: '/test-page',
  userAgent: 'test-agent',
  coreWebVitals: [
    {
      name: 'LCP',
      value: 3000, // 성능 예산 2500ms를 초과
      rating: 'needs-improvement',
      delta: 0,
      navigationType: 'navigate',
      id: 'v3-1',
      timestamp: Date.now(),
      pathname: '/test-page',
      userAgent: 'test-agent'
    },
    {
      name: 'INP',
      value: 300, // 성능 예산 200ms를 초과
      rating: 'needs-improvement',
      delta: 0,
      navigationType: 'navigate',
      id: 'v3-2',
      timestamp: Date.now(),
      pathname: '/test-page',
      userAgent: 'test-agent'
    }
  ],
  apiMetrics: [
    {
      url: '/api/test',
      method: 'GET',
      statusCode: 200,
      responseTime: 2000, // 성능 예산 1000ms를 초과
      timestamp: Date.now(),
      requestSize: 100,
      responseSize: 500
    }
  ],
  deviceInfo: {
    type: 'desktop',
    memory: 8,
    cores: 4
  }
}

const mockPerformanceBudget: PerformanceBudget = {
  lcp: 2500,
  inp: 200,
  cls: 0.1,
  apiResponseTime: 1000,
  bundleSize: 1048576,
  enableAlerts: true
}

describe('PerformanceAlertsSystem', () => {
  let alertsSystem: PerformanceAlertsSystem
  let mockWebhookHandler: vi.Mock
  let mockSlackHandler: vi.Mock
  let mockEmailHandler: vi.Mock

  beforeEach(() => {
    // Mock handlers - 모든 핸들러는 Promise를 반환해야 함
    mockWebhookHandler = vi.fn().mockResolvedValue(undefined)
    mockSlackHandler = vi.fn().mockResolvedValue(undefined)
    mockEmailHandler = vi.fn().mockResolvedValue(undefined)

    alertsSystem = new PerformanceAlertsSystem({
      budget: mockPerformanceBudget,
      handlers: {
        webhook: mockWebhookHandler,
        slack: mockSlackHandler,
        email: mockEmailHandler
      },
      thresholds: {
        criticalViolationCount: 5, // 5개 이상일 때 critical
        warningViolationCount: 1, // 1개 이상일 때 warning
        cooldownPeriod: 300000, // 5분
        consecutiveViolationLimit: 3 // 3회 연속 위반 시 critical
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkBudgetViolations', () => {
    it('should detect Core Web Vitals budget violations', () => {
      const result = alertsSystem.checkBudgetViolations(mockPerformanceMetrics)

      expect(result.violated).toBe(true)
      expect(result.violations).toHaveLength(3) // LCP, INP, API 모두 위반
      expect(result.violations[0]).toContain('LCP')
      expect(result.violations[0]).toContain('3000')
      expect(result.violations[1]).toContain('INP')
      expect(result.violations[2]).toContain('/api/test')
    })

    it('should not detect violations when metrics are within budget', () => {
      const goodMetrics: PerformanceMetrics = {
        ...mockPerformanceMetrics,
        coreWebVitals: [{
          name: 'LCP',
          value: 2000, // 예산 내
          rating: 'good',
          delta: 0,
          navigationType: 'navigate',
          id: 'v3-1',
          timestamp: Date.now(),
          pathname: '/test-page',
          userAgent: 'test-agent'
        }],
        apiMetrics: [{
          url: '/api/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 500, // 예산 내
          timestamp: Date.now(),
          requestSize: 100,
          responseSize: 500
        }]
      }

      const result = alertsSystem.checkBudgetViolations(goodMetrics)

      expect(result.violated).toBe(false)
      expect(result.violations).toHaveLength(0)
    })
  })

  describe('processMetrics', () => {
    it('should trigger warning alert for first violation', async () => {
      await alertsSystem.processMetrics(mockPerformanceMetrics)

      expect(mockWebhookHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          violations: expect.arrayContaining([
            expect.stringContaining('LCP'),
            expect.stringContaining('INP'),
            expect.stringContaining('/api/test')
          ])
        })
      )
    })

    it('should trigger critical alert after consecutive violations', async () => {
      // 연속 3회 위반 - 다른 pathname으로 쿨다운 회피
      const pathnames = ['/page1', '/page2', '/page3']

      for (let i = 0; i < 3; i++) {
        await alertsSystem.processMetrics({
          ...mockPerformanceMetrics,
          pathname: pathnames[i]
        })
      }

      expect(mockWebhookHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          level: 'critical',
          consecutiveViolations: 3
        })
      )
    })

    it('should respect cooldown period', async () => {
      // 첫 번째 알림
      await alertsSystem.processMetrics(mockPerformanceMetrics)
      expect(mockWebhookHandler).toHaveBeenCalledTimes(1)

      // 쿨다운 기간 내 두 번째 메트릭 (같은 유형)
      await alertsSystem.processMetrics(mockPerformanceMetrics)
      expect(mockWebhookHandler).toHaveBeenCalledTimes(1) // 여전히 1번만

      // 시간 경과 시뮬레이션
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 400000) // 6분 후

      await alertsSystem.processMetrics(mockPerformanceMetrics)
      expect(mockWebhookHandler).toHaveBeenCalledTimes(2) // 새로운 알림
    })
  })

  describe('alert handlers', () => {
    it('should call all enabled handlers', async () => {
      await alertsSystem.processMetrics(mockPerformanceMetrics)

      expect(mockWebhookHandler).toHaveBeenCalled()
      expect(mockSlackHandler).toHaveBeenCalled()
      expect(mockEmailHandler).toHaveBeenCalled()
    })

    it('should handle handler failures gracefully', async () => {
      mockWebhookHandler.mockRejectedValue(new Error('Webhook failed'))

      await expect(alertsSystem.processMetrics(mockPerformanceMetrics)).resolves.not.toThrow()

      // 다른 핸들러는 여전히 호출되어야 함
      expect(mockSlackHandler).toHaveBeenCalled()
      expect(mockEmailHandler).toHaveBeenCalled()
    })
  })

  describe('performance analytics', () => {
    it('should track violation statistics', async () => {
      // 다른 페이지에서 위반 처리 (쿨다운 회피)
      const secondMetrics = {
        ...mockPerformanceMetrics,
        pathname: '/another-page'
      }

      await alertsSystem.processMetrics(mockPerformanceMetrics)
      await alertsSystem.processMetrics(secondMetrics)

      const stats = alertsSystem.getViolationStats()

      expect(stats.totalViolations).toBe(6) // 2 * 3 violations
      expect(stats.violationsByMetric.LCP).toBe(2)
      expect(stats.violationsByMetric.INP).toBe(2)
      expect(stats.violationsByMetric.API).toBe(2)
      expect(stats.consecutiveViolations).toBe(2)
    })

    it('should generate optimization suggestions', async () => {
      await alertsSystem.processMetrics(mockPerformanceMetrics)

      const suggestions = alertsSystem.generateOptimizationSuggestions()

      // 부분 문자열 매칭으로 변경
      expect(suggestions.some(s => s.includes('LCP optimization'))).toBe(true)
      expect(suggestions.some(s => s.includes('INP optimization'))).toBe(true)
      expect(suggestions.some(s => s.includes('API performance'))).toBe(true)
    })
  })
})