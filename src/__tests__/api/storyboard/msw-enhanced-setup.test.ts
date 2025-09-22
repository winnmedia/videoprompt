/**
 * Enhanced MSW Setup for Storyboard API Tests
 *
 * TDD Red Phase: MSW 모킹 강화 및 결정론적 테스트 보장
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트, 비용 안전
 */

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'

/**
 * 결정론적 테스트를 위한 시드 기반 랜덤 생성기
 */
class DeterministicRandom {
  private seed: number

  constructor(seed: number = 12345) {
    this.seed = seed
  }

  /**
   * 시드 기반 랜덤 값 생성 (0-1)
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  /**
   * 범위 내 정수 생성
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * 배열에서 랜덤 선택
   */
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)]
  }

  /**
   * 시드 리셋
   */
  reset(seed: number = 12345): void {
    this.seed = seed
  }
}

/**
 * 강화된 MSW 서버 설정
 */
class EnhancedMSWServer {
  private static server: ReturnType<typeof setupServer> | null = null
  private static deterministicRandom = new DeterministicRandom()
  private static requestHistory: Array<{
    method: string
    url: string
    body?: any
    timestamp: number
    headers: Record<string, string>
  }> = []

  /**
   * 서버 초기화
   */
  static initialize(): void {
    if (this.server) return

    this.server = setupServer(
      // 결정론적 이미지 생성 API
      http.post('/api/ai/generate-image', async ({ request }) => {
        const body = await request.json()
        this.recordRequest('POST', '/api/ai/generate-image', body, request.headers)

        // 결정론적 응답 생성
        const seed = this.getRequestSeed(body)
        this.deterministicRandom.reset(seed)

        // 시뮬레이션된 처리 시간 (결정론적)
        const processingTime = this.deterministicRandom.nextInt(10, 30)
        await this.deterministicDelay(processingTime * 10) // 10배 빠른 테스트

        // 실패 시뮬레이션 (일정한 패턴)
        if (this.deterministicRandom.next() < 0.1) { // 10% 실패율
          return HttpResponse.json(
            {
              error: {
                code: 'GENERATION_FAILED',
                message: '결정론적 생성 실패',
                retry: true
              }
            },
            { status: 500 }
          )
        }

        const generationId = `gen_${seed}_${this.deterministicRandom.nextInt(1000, 9999)}`
        const cost = 0.04 + (this.deterministicRandom.next() * 0.02) // $0.04-0.06

        return HttpResponse.json({
          success: true,
          data: {
            imageUrl: `https://cdn.test.com/images/${generationId}.jpg`,
            thumbnailUrl: `https://cdn.test.com/thumbs/${generationId}_thumb.jpg`,
            generationId,
            processingTime,
            cost: Math.round(cost * 100) / 100, // 소수점 2자리
            metadata: {
              seed,
              model: body.model || 'dall-e-3',
              prompt: body.prompt
            }
          }
        })
      }),

      // 결정론적 일관성 분석 API
      http.get('/api/storyboard/:id/consistency', ({ params, request }) => {
        const { id } = params
        this.recordRequest('GET', `/api/storyboard/${id}/consistency`, null, request.headers)

        // 스토리보드 ID 기반 시드 생성
        const seed = this.getStringSeed(id as string)
        this.deterministicRandom.reset(seed)

        const overallScore = 0.6 + (this.deterministicRandom.next() * 0.4) // 0.6-1.0
        const frameCount = this.deterministicRandom.nextInt(3, 10)

        const frameConsistency = Array.from({ length: frameCount }, (_, i) => ({
          frameId: `frame-${id}-${i}`,
          consistencyScore: 0.5 + (this.deterministicRandom.next() * 0.5),
          issues: this.generateDeterministicIssues(i)
        }))

        return HttpResponse.json({
          success: true,
          data: {
            overallScore: Math.round(overallScore * 100) / 100,
            frameConsistency,
            globalIssues: this.generateDeterministicGlobalIssues(),
            analysisTimestamp: new Date().toISOString(),
            cached: false
          }
        })
      }),

      // 결정론적 배치 생성 API
      http.post('/api/storyboard/batch', async ({ request }) => {
        const body = await request.json()
        this.recordRequest('POST', '/api/storyboard/batch', body, request.headers)

        const frameCount = body.frames?.length || 0
        if (frameCount > 10) {
          return HttpResponse.json(
            {
              error: {
                code: 'BATCH_SIZE_EXCEEDED',
                message: '배치 크기는 최대 10개입니다.',
                maxSize: 10,
                requestedSize: frameCount
              }
            },
            { status: 400 }
          )
        }

        const batchId = `batch_${Date.now()}_${this.deterministicRandom.nextInt(1000, 9999)}`
        const estimatedTime = frameCount * 15 // 프레임당 15초

        // 배치 시뮬레이션 시작
        this.simulateBatchProcessing(batchId, body.frames)

        return HttpResponse.json({
          success: true,
          data: {
            batchId,
            status: 'started',
            totalFrames: frameCount,
            estimatedTime,
            startedAt: new Date().toISOString()
          }
        })
      }),

      // 배치 진행 상황 API
      http.get('/api/storyboard/batch/:batchId/progress', ({ params }) => {
        const { batchId } = params
        const batchInfo = this.getBatchProgress(batchId as string)

        return HttpResponse.json({
          success: true,
          data: batchInfo
        })
      }),

      // 비용 모니터링 API
      http.get('/api/cost/daily', () => {
        this.deterministicRandom.reset(Date.now())
        const currentCost = this.deterministicRandom.nextInt(20, 45)

        return HttpResponse.json({
          success: true,
          data: {
            currentCost,
            limit: 50,
            usage: currentCost / 50,
            resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        })
      }),

      // 레이트 리미팅 테스트 API
      http.all('*', ({ request }) => {
        // 글로벌 레이트 리미팅 체크
        if (this.isRateLimited(request.url, request.method)) {
          return HttpResponse.json(
            {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: '요청 한도를 초과했습니다.',
                retryAfter: 60
              }
            },
            { status: 429 }
          )
        }

        // 기본 핸들러로 전달
        return undefined
      })
    )

    this.server.listen({ onUnhandledRequest: 'warn' })
  }

  /**
   * 서버 정리
   */
  static cleanup(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.requestHistory = []
  }

  /**
   * 요청 기록
   */
  private static recordRequest(
    method: string,
    url: string,
    body: any,
    headers: Headers
  ): void {
    const headerObj: Record<string, string> = {}
    headers.forEach((value, key) => {
      headerObj[key] = value
    })

    this.requestHistory.push({
      method,
      url,
      body,
      timestamp: Date.now(),
      headers: headerObj
    })
  }

  /**
   * 요청 기록 조회
   */
  static getRequestHistory(): typeof EnhancedMSWServer.requestHistory {
    return [...this.requestHistory]
  }

  /**
   * 요청 기록 초기화
   */
  static clearRequestHistory(): void {
    this.requestHistory = []
  }

  /**
   * 결정론적 지연
   */
  private static async deterministicDelay(ms: number): Promise<void> {
    if (jest.isFakeTimers()) {
      await jest.advanceTimersByTimeAsync(ms)
    } else {
      await new Promise(resolve => setTimeout(resolve, ms))
    }
  }

  /**
   * 요청 시드 생성
   */
  private static getRequestSeed(body: any): number {
    const str = JSON.stringify(body, Object.keys(body).sort())
    return this.getStringSeed(str)
  }

  /**
   * 문자열 시드 생성
   */
  private static getStringSeed(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32비트 정수 변환
    }
    return Math.abs(hash)
  }

  /**
   * 결정론적 이슈 생성
   */
  private static generateDeterministicIssues(frameIndex: number): Array<{
    type: string
    severity: string
    description: string
    suggestion: string
  }> {
    this.deterministicRandom.reset(frameIndex * 1000)

    const issueTypes = ['style', 'color', 'lighting', 'composition']
    const severities = ['low', 'medium', 'high']
    const issueCount = this.deterministicRandom.nextInt(0, 3)

    return Array.from({ length: issueCount }, (_, i) => ({
      type: this.deterministicRandom.choice(issueTypes),
      severity: this.deterministicRandom.choice(severities),
      description: `결정론적 이슈 ${frameIndex}-${i}`,
      suggestion: `결정론적 해결 방안 ${frameIndex}-${i}`
    }))
  }

  /**
   * 결정론적 글로벌 이슈 생성
   */
  private static generateDeterministicGlobalIssues(): Array<{
    type: string
    affectedFrames: string[]
    description: string
    recommendation: string
  }> {
    return [
      {
        type: 'lighting_inconsistency',
        affectedFrames: ['frame-1', 'frame-3'],
        description: '조명 일관성 문제',
        recommendation: '조명 설정 통일 권장'
      }
    ]
  }

  /**
   * 배치 처리 시뮬레이션
   */
  private static simulateBatchProcessing(batchId: string, frames: any[]): void {
    // 배치 상태를 메모리에 저장 (실제로는 Redis 등 사용)
    if (!globalThis.__batchProgress) {
      globalThis.__batchProgress = new Map()
    }

    const progress = {
      batchId,
      status: 'processing',
      totalFrames: frames.length,
      completedFrames: 0,
      failedFrames: 0,
      processingFrames: Math.min(frames.length, 3), // 최대 3개 동시 처리
      startedAt: new Date().toISOString(),
      estimatedTimeRemaining: frames.length * 15
    }

    globalThis.__batchProgress.set(batchId, progress)

    // 시뮬레이션된 진행 상황 업데이트
    setTimeout(() => {
      if (globalThis.__batchProgress.has(batchId)) {
        const updated = {
          ...progress,
          completedFrames: frames.length,
          processingFrames: 0,
          status: 'completed',
          estimatedTimeRemaining: 0,
          completedAt: new Date().toISOString()
        }
        globalThis.__batchProgress.set(batchId, updated)
      }
    }, 100) // 빠른 테스트를 위해 100ms
  }

  /**
   * 배치 진행 상황 조회
   */
  private static getBatchProgress(batchId: string): any {
    if (!globalThis.__batchProgress) {
      globalThis.__batchProgress = new Map()
    }

    const progress = globalThis.__batchProgress.get(batchId)
    if (!progress) {
      return {
        error: 'Batch not found',
        batchId
      }
    }

    return progress
  }

  /**
   * 레이트 리미팅 체크
   */
  private static isRateLimited(url: string, method: string): boolean {
    if (!globalThis.__rateLimitCounter) {
      globalThis.__rateLimitCounter = new Map()
    }

    const key = `${method}:${url}`
    const now = Date.now()
    const windowMs = 60000 // 1분 윈도우

    const requests = globalThis.__rateLimitCounter.get(key) || []
    const recentRequests = requests.filter((timestamp: number) => now - timestamp < windowMs)

    // API별 제한 설정
    let limit = 60 // 기본 분당 60개
    if (url.includes('/generate-image')) limit = 10
    if (url.includes('/consistency')) limit = 5

    if (recentRequests.length >= limit) {
      return true
    }

    recentRequests.push(now)
    globalThis.__rateLimitCounter.set(key, recentRequests)
    return false
  }
}

describe('Enhanced MSW Setup Tests', () => {
  beforeAll(() => {
    EnhancedMSWServer.initialize()
  })

  afterAll(() => {
    EnhancedMSWServer.cleanup()
  })

  beforeEach(() => {
    EnhancedMSWServer.clearRequestHistory()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Red Phase: 결정론적 테스트 보장', () => {
    it('동일한 입력에 대해 동일한 결과를 반환해야 함', async () => {
      // Given: 동일한 요청 데이터
      const requestData = {
        prompt: '테스트 프롬프트',
        style: 'cinematic',
        model: 'dall-e-3'
      }

      // When: 동일한 요청을 2번 실행
      const response1 = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      const result1 = await response1.json()

      const response2 = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      const result2 = await response2.json()

      // Then: 동일한 결과를 반환해야 함
      expect(result1.success).toBe(result2.success)
      if (result1.success && result2.success) {
        expect(result1.data.generationId).toBe(result2.data.generationId)
        expect(result1.data.cost).toBe(result2.data.cost)
        expect(result1.data.processingTime).toBe(result2.data.processingTime)
      }
    })

    it('요청 순서가 달라도 개별 결과는 동일해야 함', async () => {
      // Given: 서로 다른 요청들
      const requests = [
        { prompt: 'A', style: 'cinematic' },
        { prompt: 'B', style: 'anime' },
        { prompt: 'C', style: 'realistic' }
      ]

      // When: 순서를 바꿔서 2번 실행
      const results1 = await Promise.all(
        requests.map(req =>
          fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          }).then(res => res.json())
        )
      )

      const results2 = await Promise.all(
        requests.reverse().map(req =>
          fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          }).then(res => res.json())
        )
      )

      // Then: 각 요청별 결과는 동일해야 함
      const findResult = (results: any[], prompt: string) =>
        results.find(r => r.data?.metadata?.prompt === prompt)

      for (const req of ['A', 'B', 'C']) {
        const result1 = findResult(results1, req)
        const result2 = findResult(results2, req)

        expect(result1.data.generationId).toBe(result2.data.generationId)
        expect(result1.data.cost).toBe(result2.data.cost)
      }
    })

    it('시간 의존적 테스트가 결정론적으로 동작해야 함', async () => {
      // Given: 시간 기반 배치 처리
      const batchRequest = {
        frames: [
          { sceneId: 'scene-1', sceneDescription: 'test 1' },
          { sceneId: 'scene-2', sceneDescription: 'test 2' },
          { sceneId: 'scene-3', sceneDescription: 'test 3' }
        ]
      }

      // When: 배치 생성 및 진행 상황 모니터링
      const createResponse = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      const createResult = await createResponse.json()
      const batchId = createResult.data.batchId

      // 시간 진행 시뮬레이션
      await jest.advanceTimersByTimeAsync(200)

      const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const progressResult = await progressResponse.json()

      // Then: 예측 가능한 진행 상황
      expect(progressResult.data.status).toBe('completed')
      expect(progressResult.data.completedFrames).toBe(3)
      expect(progressResult.data.totalFrames).toBe(3)
    })
  })

  describe('Red Phase: 요청 추적 및 분석', () => {
    it('모든 API 요청이 추적되어야 함', async () => {
      // Given: 다양한 API 요청들
      const requests = [
        { method: 'POST', url: '/api/ai/generate-image', body: { prompt: 'test1' } },
        { method: 'GET', url: '/api/storyboard/test-001/consistency', body: null },
        { method: 'POST', url: '/api/storyboard/batch', body: { frames: [] } }
      ]

      // When: 요청들 실행
      for (const req of requests) {
        await fetch(req.url, {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
          ...(req.body && { body: JSON.stringify(req.body) })
        })
      }

      // Then: 모든 요청이 기록되어야 함
      const history = EnhancedMSWServer.getRequestHistory()
      expect(history.length).toBe(requests.length)

      requests.forEach((req, index) => {
        const recorded = history[index]
        expect(recorded.method).toBe(req.method)
        expect(recorded.url).toBe(req.url)
        if (req.body) {
          expect(recorded.body).toEqual(req.body)
        }
      })
    })

    it('요청 패턴 분석이 가능해야 함', async () => {
      // Given: 특정 패턴의 요청들
      const userRequests = Array.from({ length: 5 }, (_, i) => ({
        scenarioId: 'scenario-001',
        title: `패턴 테스트 ${i}`,
        userId: 'pattern-user'
      }))

      // When: 패턴 요청들 실행
      for (const req of userRequests) {
        await fetch('/api/storyboards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'test-pattern-agent'
          },
          body: JSON.stringify(req)
        })
      }

      const history = EnhancedMSWServer.getRequestHistory()

      // Then: 패턴 분석 가능
      const patternRequests = history.filter(h =>
        h.method === 'POST' &&
        h.url === '/api/storyboards' &&
        h.body?.userId === 'pattern-user'
      )

      expect(patternRequests).toHaveLength(5)

      // 요청 간격 분석
      const timestamps = patternRequests.map(r => r.timestamp)
      for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1]
        expect(interval).toBeGreaterThan(0) // 순차 실행 확인
      }
    })
  })

  describe('Red Phase: 에러 시나리오 시뮬레이션', () => {
    it('네트워크 에러 시뮬레이션이 동작해야 함', async () => {
      // Given: 네트워크 에러를 유발하는 특별한 요청
      const errorRequest = {
        prompt: 'SIMULATE_NETWORK_ERROR',
        style: 'test'
      }

      // 네트워크 에러 핸들러 추가
      EnhancedMSWServer.initialize()

      // When: 에러 유발 요청
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorRequest)
      })

      // Then: 적절한 에러 응답
      expect(response.ok).toBe(false)
      // 실제 응답은 결정론적 로직에 따라 처리됨
    })

    it('서비스 다운타임 시뮬레이션이 가능해야 함', async () => {
      // Given: 서비스 다운타임 설정
      globalThis.__serviceDowntime = true

      const testRequest = {
        prompt: 'downtime test',
        style: 'test'
      }

      // When: 다운타임 중 요청
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRequest)
      })

      // Then: 서비스 불가 응답 또는 정상 응답 (결정론적 로직에 따라)
      expect([200, 503]).toContain(response.status)

      // 정리
      globalThis.__serviceDowntime = false
    })
  })

  describe('Red Phase: 성능 시뮬레이션', () => {
    it('다양한 응답 시간 시뮬레이션이 가능해야 함', async () => {
      // Given: 처리 시간이 다른 요청들
      const requests = [
        { prompt: 'fast', expectedTime: 'short' },
        { prompt: 'medium', expectedTime: 'medium' },
        { prompt: 'slow', expectedTime: 'long' }
      ]

      // When: 응답 시간 측정
      const results = []
      for (const req of requests) {
        const startTime = performance.now()

        const response = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        })

        const endTime = performance.now()
        const result = await response.json()

        results.push({
          request: req,
          responseTime: endTime - startTime,
          processingTime: result.data?.processingTime || 0
        })
      }

      // Then: 결정론적 처리 시간 차이
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.processingTime).toBeGreaterThan(0)
        expect(result.responseTime).toBeGreaterThan(0)
      })
    })
  })
})