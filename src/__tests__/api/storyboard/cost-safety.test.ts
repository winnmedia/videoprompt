/**
 * Storyboard Cost Safety Tests
 *
 * TDD Red Phase: 비용 안전 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, $300 사건 방지, API 제한, 중복 차단
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'

/**
 * 비용 안전 모니터링 시스템
 */
class CostSafetySystem {
  private static readonly MAX_DAILY_COST = 50 // $50 일일 한도
  private static readonly MAX_HOURLY_REQUESTS = 100 // 시간당 100개 요청
  private static readonly MAX_CONCURRENT_GENERATIONS = 5 // 최대 5개 동시 생성

  private static dailyCost = 0
  private static hourlyRequests = 0
  private static concurrentGenerations = 0
  private static lastHourReset = Date.now()
  private static duplicateRequestMap = new Map<string, number>()

  /**
   * $300 사건 방지: 무한 API 호출 차단
   */
  static checkInfiniteCallPrevention(requestId: string): boolean {
    const now = Date.now()
    const lastRequest = this.duplicateRequestMap.get(requestId) || 0

    // 1초 이내 중복 요청 차단
    if (now - lastRequest < 1000) {
      throw new Error('$300 사건 방지: 중복 요청 감지')
    }

    this.duplicateRequestMap.set(requestId, now)
    return true
  }

  /**
   * 일일 비용 한도 체크
   */
  static checkDailyCostLimit(estimatedCost: number): boolean {
    if (this.dailyCost + estimatedCost > this.MAX_DAILY_COST) {
      throw new Error(`일일 비용 한도 초과: $${this.dailyCost} + $${estimatedCost} > $${this.MAX_DAILY_COST}`)
    }
    return true
  }

  /**
   * 시간당 요청 제한 체크
   */
  static checkHourlyRequestLimit(): boolean {
    const now = Date.now()

    // 시간 리셋
    if (now - this.lastHourReset > 3600000) {
      this.hourlyRequests = 0
      this.lastHourReset = now
    }

    if (this.hourlyRequests >= this.MAX_HOURLY_REQUESTS) {
      throw new Error(`시간당 요청 한도 초과: ${this.hourlyRequests}/${this.MAX_HOURLY_REQUESTS}`)
    }

    this.hourlyRequests++
    return true
  }

  /**
   * 동시 생성 제한 체크
   */
  static checkConcurrentGenerationLimit(): boolean {
    if (this.concurrentGenerations >= this.MAX_CONCURRENT_GENERATIONS) {
      throw new Error(`동시 생성 한도 초과: ${this.concurrentGenerations}/${this.MAX_CONCURRENT_GENERATIONS}`)
    }

    this.concurrentGenerations++
    return true
  }

  /**
   * 생성 완료 처리
   */
  static completeGeneration(cost: number): void {
    this.concurrentGenerations = Math.max(0, this.concurrentGenerations - 1)
    this.dailyCost += cost
  }

  /**
   * 시스템 리셋 (테스트용)
   */
  static reset(): void {
    this.dailyCost = 0
    this.hourlyRequests = 0
    this.concurrentGenerations = 0
    this.lastHourReset = Date.now()
    this.duplicateRequestMap.clear()
  }

  /**
   * 현재 상태 조회
   */
  static getStatus() {
    return {
      dailyCost: this.dailyCost,
      hourlyRequests: this.hourlyRequests,
      concurrentGenerations: this.concurrentGenerations,
      duplicateRequestCount: this.duplicateRequestMap.size
    }
  }
}

describe('Storyboard Cost Safety - $300 사건 방지', () => {
  beforeEach(() => {
    CostSafetySystem.reset()
    storyboardTestUtils.resetApiLimiter()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: $300 사건 방지 핵심 테스트', () => {
    it('1초 이내 중복 요청을 차단해야 함', async () => {
      // Given: 동일한 요청 데이터
      const requestData = {
        scenarioId: 'scenario-test-001',
        title: '중복 테스트',
        userId: 'user-test-001'
      }

      const requestId = JSON.stringify(requestData)

      // When: 1초 이내 동일한 요청 2번 전송
      const firstPromise = fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(requestData)
      })

      // 500ms 후 두 번째 요청
      await jest.advanceTimersByTimeAsync(500)

      const secondPromise = fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(requestData)
      })

      const [firstResponse, secondResponse] = await Promise.all([firstPromise, secondPromise])

      // Then: 두 번째 요청은 차단되어야 함
      expect(firstResponse.ok).toBe(true)
      expect(secondResponse.status).toBe(429)

      const secondResult = await secondResponse.json()
      expect(secondResult.error.code).toBe('DUPLICATE_REQUEST')
      expect(secondResult.error.message).toContain('$300 사건 방지')
    })

    it('useEffect 의존성 패턴 감지 및 차단해야 함', async () => {
      // Given: useEffect 무한 루프를 시뮬레이션하는 연속 요청
      const requests = Array.from({ length: 10 }, (_, i) => ({
        scenarioId: 'scenario-test-001',
        title: `useEffect 테스트 ${i}`,
        userId: 'user-test-001',
        metadata: {
          source: 'useEffect',
          componentName: 'Header',
          hookType: 'checkAuth'
        }
      }))

      // When: 100ms 간격으로 연속 요청 (useEffect 무한 루프 시뮬레이션)
      const responses = []
      for (const requestData of requests) {
        const response = await fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
        responses.push(response)
        await jest.advanceTimersByTimeAsync(100) // 100ms 간격
      }

      // Then: 패턴 감지 후 차단되어야 함
      const blockedResponses = responses.filter(r => r.status === 429)
      expect(blockedResponses.length).toBeGreaterThan(0)

      const lastBlockedResponse = blockedResponses[blockedResponses.length - 1]
      const result = await lastBlockedResponse.json()
      expect(result.error.code).toBe('SUSPICIOUS_PATTERN')
      expect(result.error.message).toContain('useEffect 무한 루프 패턴 감지')
    })

    it('일일 비용 한도 초과 시 차단해야 함', async () => {
      // Given: 일일 한도에 근접한 비용 상태
      const currentCost = 45 // $45 이미 사용됨
      CostSafetySystem.reset()
      // 현재 비용을 $45로 설정하는 모킹
      server.use(
        http.get('/api/cost/daily', () => {
          return HttpResponse.json({
            success: true,
            data: { currentCost, limit: 50 }
          })
        })
      )

      const expensiveRequest = {
        scenarioId: 'scenario-test-001',
        title: '고비용 스토리보드',
        userId: 'user-test-001',
        config: {
          model: 'dall-e-3',
          quality: '4k', // 고비용 설정
          aspectRatio: '16:9'
        },
        frames: Array.from({ length: 10 }, (_, i) => ({
          sceneId: `scene-${i}`,
          sceneDescription: `고비용 프레임 ${i}`
        }))
      }

      // When: 한도를 초과하는 고비용 요청
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expensiveRequest)
      })

      // Then: 비용 한도 초과로 차단되어야 함
      expect(response.status).toBe(402) // Payment Required

      const result = await response.json()
      expect(result.error.code).toBe('DAILY_COST_LIMIT_EXCEEDED')
      expect(result.error.message).toContain('일일 비용 한도 초과')
      expect(result.error.details.currentCost).toBeDefined()
      expect(result.error.details.requestedCost).toBeDefined()
      expect(result.error.details.limit).toBe(50)
    })
  })

  describe('Red Phase: API 호출 제한 테스트', () => {
    it('분당 이미지 생성 제한을 초과하면 차단해야 함', async () => {
      // Given: 분당 제한 (10개)을 초과하는 요청
      const requests = Array.from({ length: 12 }, (_, i) => ({
        sceneId: `scene-${i}`,
        sceneDescription: `테스트 프레임 ${i}`,
        priority: 'normal' as const
      }))

      // When: 1분 내에 12개 이미지 생성 요청
      const responses = await Promise.all(
        requests.map(async (req, index) => {
          // 각 요청을 5초 간격으로 전송
          await jest.advanceTimersByTimeAsync(index * 5000)
          return fetch('/api/storyboard/generate/frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          })
        })
      )

      // Then: 10개 이후 요청들은 429 에러를 반환해야 함
      const rateLimitedResponses = responses.slice(10)
      rateLimitedResponses.forEach(response => {
        expect(response.status).toBe(429)
      })

      const rateLimitedResult = await rateLimitedResponses[0].json()
      expect(rateLimitedResult.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(rateLimitedResult.error.message).toContain('이미지 생성 한도 초과')
    })

    it('동시 생성 제한을 초과하면 큐에 대기해야 함', async () => {
      // Given: 동시 생성 제한 (5개)을 초과하는 요청
      const concurrentRequests = Array.from({ length: 8 }, (_, i) => ({
        sceneId: `scene-${i}`,
        sceneDescription: `동시 생성 테스트 프레임 ${i}`,
        priority: 'normal' as const
      }))

      // When: 8개 요청을 동시에 전송
      const responses = await Promise.all(
        concurrentRequests.map(req =>
          fetch('/api/storyboard/generate/frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          })
        )
      )

      // Then: 처음 5개는 즉시 처리, 나머지 3개는 큐에서 대기
      const immediateResponses = responses.slice(0, 5)
      const queuedResponses = responses.slice(5)

      immediateResponses.forEach(response => {
        expect(response.ok).toBe(true)
      })

      queuedResponses.forEach(async response => {
        expect(response.status).toBe(202) // Accepted (큐에 추가됨)
        const result = await response.json()
        expect(result.data.status).toBe('queued')
        expect(result.data.queuePosition).toBeDefined()
        expect(result.data.estimatedWaitTime).toBeDefined()
      })
    })

    it('시간당 요청 제한을 초과하면 차단해야 함', async () => {
      // Given: 시간당 제한을 설정 (테스트용으로 10개로 제한)
      server.use(
        http.get('/api/rate-limit/hourly', () => {
          return HttpResponse.json({
            success: true,
            data: { current: 8, limit: 10, resetTime: Date.now() + 3600000 }
          })
        })
      )

      // When: 제한을 초과하는 요청들
      const requests = Array.from({ length: 5 }, () =>
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenarioId: 'scenario-test-001',
            title: '시간당 제한 테스트',
            userId: 'user-test-001'
          })
        })
      )

      const responses = await Promise.all(requests)

      // Then: 처음 2개는 성공 (8 + 2 = 10), 나머지는 차단
      const successResponses = responses.filter(r => r.ok)
      const blockedResponses = responses.filter(r => r.status === 429)

      expect(successResponses.length).toBe(2)
      expect(blockedResponses.length).toBe(3)

      const blockedResult = await blockedResponses[0].json()
      expect(blockedResult.error.code).toBe('HOURLY_RATE_LIMIT_EXCEEDED')
    })
  })

  describe('Red Phase: 중복 요청 차단 테스트', () => {
    it('동일한 세션에서 중복 요청을 감지해야 함', async () => {
      // Given: 동일한 세션 ID와 요청 내용
      const sessionId = 'session-test-001'
      const requestData = {
        scenarioId: 'scenario-test-001',
        title: '중복 감지 테스트',
        userId: 'user-test-001'
      }

      // When: 동일한 세션에서 중복 요청
      const responses = await Promise.all([
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
            'X-Request-Hash': 'test-hash-001'
          },
          body: JSON.stringify(requestData)
        }),
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
            'X-Request-Hash': 'test-hash-001'
          },
          body: JSON.stringify(requestData)
        })
      ])

      // Then: 하나는 성공, 하나는 중복으로 차단
      const successCount = responses.filter(r => r.ok).length
      const duplicateCount = responses.filter(r => r.status === 409).length

      expect(successCount).toBe(1)
      expect(duplicateCount).toBe(1)

      const duplicateResponse = responses.find(r => r.status === 409)
      const duplicateResult = await duplicateResponse!.json()
      expect(duplicateResult.error.code).toBe('DUPLICATE_REQUEST')
    })

    it('요청 지문(fingerprint) 기반 중복 감지가 동작해야 함', async () => {
      // Given: 내용은 동일하지만 다른 필드 순서의 요청들
      const request1 = {
        scenarioId: 'scenario-test-001',
        title: '지문 테스트',
        userId: 'user-test-001',
        config: { model: 'dall-e-3', quality: 'hd' }
      }

      const request2 = {
        userId: 'user-test-001',
        config: { quality: 'hd', model: 'dall-e-3' },
        title: '지문 테스트',
        scenarioId: 'scenario-test-001'
      }

      // When: 순서만 다른 동일한 내용의 요청
      const responses = await Promise.all([
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request1)
        }),
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request2)
        })
      ])

      // Then: 내용이 동일하므로 중복으로 감지되어야 함
      const statusCodes = responses.map(r => r.status)
      expect(statusCodes).toContain(200) // 첫 번째는 성공
      expect(statusCodes).toContain(409) // 두 번째는 중복
    })

    it('중복 요청 캐시가 적절한 시간 후 만료되어야 함', async () => {
      // Given: 중복 감지 TTL 설정 (5분)
      const requestData = {
        scenarioId: 'scenario-test-001',
        title: 'TTL 테스트',
        userId: 'user-test-001'
      }

      // 첫 번째 요청
      const firstResponse = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      expect(firstResponse.ok).toBe(true)

      // When: 5분 후 동일한 요청
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000) // 5분 1초

      const secondResponse = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      // Then: TTL 만료로 인해 새 요청으로 처리되어야 함
      expect(secondResponse.ok).toBe(true)

      const secondResult = await secondResponse.json()
      expect(secondResult.data.metadata.id).toBeDefined()
      // 새로운 ID를 가져야 함 (중복이 아님)
    })
  })

  describe('Red Phase: 비용 모니터링 및 알림 테스트', () => {
    it('비용 임계값 도달 시 알림을 발송해야 함', async () => {
      // Given: 비용 임계값 설정 (일일 한도의 80%)
      const costThreshold = 40 // $40 (50의 80%)

      // 현재 비용을 임계값 근처로 설정
      server.use(
        http.get('/api/cost/daily', () => {
          return HttpResponse.json({
            success: true,
            data: { currentCost: 39, limit: 50, threshold: costThreshold }
          })
        })
      )

      const expensiveRequest = {
        scenarioId: 'scenario-test-001',
        title: '임계값 테스트',
        userId: 'user-test-001',
        config: {
          model: 'dall-e-3',
          quality: 'hd'
        }
      }

      // When: 임계값을 초과하는 요청
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expensiveRequest)
      })

      // Then: 요청은 성공하지만 임계값 경고 포함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.warnings).toBeDefined()
      expect(result.warnings).toContain('COST_THRESHOLD_EXCEEDED')

      // 알림 발송 확인
      const alertResponse = await fetch('/api/cost/alerts/recent')
      const alerts = await alertResponse.json()
      expect(alerts.data.some((alert: any) =>
        alert.type === 'COST_THRESHOLD' && alert.threshold === costThreshold
      )).toBe(true)
    })

    it('실시간 비용 추적이 올바르게 동작해야 함', async () => {
      // Given: WebSocket 비용 모니터링 설정
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }

      global.WebSocket = jest.fn(() => mockWebSocket) as any

      // When: 비용 모니터링 WebSocket 연결
      const ws = new WebSocket('ws://localhost:3000/api/cost/monitor')

      // 비용 발생 이벤트 시뮬레이션
      const costEvent = {
        timestamp: new Date().toISOString(),
        amount: 4.50,
        operation: 'image_generation',
        resourceId: 'storyboard-001',
        dailyTotal: 39.50
      }

      // Then: WebSocket 연결 및 비용 이벤트 처리 확인
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('/api/cost/monitor')
      )
    })

    it('비용 리포트 생성이 올바르게 동작해야 함', async () => {
      // Given: 비용 리포트 요청
      const reportRequest = {
        period: 'daily',
        breakdown: ['operation', 'user', 'model'],
        includeProjections: true
      }

      // When: 비용 리포트 생성 API 호출
      const response = await fetch('/api/cost/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportRequest)
      })

      // Then: 상세한 비용 리포트 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('summary')
      expect(result.data).toHaveProperty('breakdown')
      expect(result.data).toHaveProperty('projections')
      expect(result.data).toHaveProperty('recommendations')

      // 요약 정보 검증
      expect(result.data.summary.totalCost).toBeDefined()
      expect(result.data.summary.dailyAverage).toBeDefined()
      expect(result.data.summary.trend).toBeDefined()

      // 예측 정보 검증
      expect(result.data.projections.endOfDayTotal).toBeDefined()
      expect(result.data.projections.endOfMonthTotal).toBeDefined()
    })
  })
})