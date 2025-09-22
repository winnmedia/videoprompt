/**
 * Storyboard Performance Tests
 *
 * TDD Red Phase: 성능 테스트 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, 성능 예산, 응답 시간, 메모리 사용량
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import type {
  BatchGenerationRequest,
  FrameGenerationRequest,
  StoryboardCreateInput
} from '../../../entities/storyboard'

/**
 * 성능 모니터링 시스템
 */
class PerformanceMonitor {
  private static metrics: {
    responseTime: number[]
    memoryUsage: number[]
    cpuUsage: number[]
    throughput: number[]
    concurrentUsers: number
  } = {
    responseTime: [],
    memoryUsage: [],
    cpuUsage: [],
    throughput: [],
    concurrentUsers: 0
  }

  /**
   * 응답 시간 측정
   */
  static measureResponseTime<T>(operation: () => Promise<T>): Promise<{ result: T; time: number }> {
    const startTime = performance.now()
    return operation().then(result => {
      const endTime = performance.now()
      const responseTime = endTime - startTime
      this.metrics.responseTime.push(responseTime)
      return { result, time: responseTime }
    })
  }

  /**
   * 메모리 사용량 모니터링
   */
  static monitorMemoryUsage(): number {
    // Node.js 환경에서의 메모리 사용량 시뮬레이션
    const memoryUsage = Math.random() * 100 + 50 // 50-150MB
    this.metrics.memoryUsage.push(memoryUsage)
    return memoryUsage
  }

  /**
   * CPU 사용량 모니터링
   */
  static monitorCpuUsage(): number {
    const cpuUsage = Math.random() * 100 // 0-100%
    this.metrics.cpuUsage.push(cpuUsage)
    return cpuUsage
  }

  /**
   * 처리량 계산
   */
  static calculateThroughput(operationCount: number, timeWindowMs: number): number {
    const throughput = (operationCount / timeWindowMs) * 1000 // operations per second
    this.metrics.throughput.push(throughput)
    return throughput
  }

  /**
   * 동시 사용자 수 증가
   */
  static incrementConcurrentUsers(): void {
    this.metrics.concurrentUsers++
  }

  /**
   * 동시 사용자 수 감소
   */
  static decrementConcurrentUsers(): void {
    this.metrics.concurrentUsers = Math.max(0, this.metrics.concurrentUsers - 1)
  }

  /**
   * 통계 계산
   */
  static getStatistics() {
    const responseTimeStats = this.calculateStats(this.metrics.responseTime)
    const memoryStats = this.calculateStats(this.metrics.memoryUsage)
    const cpuStats = this.calculateStats(this.metrics.cpuUsage)
    const throughputStats = this.calculateStats(this.metrics.throughput)

    return {
      responseTime: responseTimeStats,
      memoryUsage: memoryStats,
      cpuUsage: cpuStats,
      throughput: throughputStats,
      concurrentUsers: this.metrics.concurrentUsers
    }
  }

  /**
   * 기본 통계 계산
   */
  private static calculateStats(values: number[]) {
    if (values.length === 0) return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  /**
   * 메트릭 리셋
   */
  static reset(): void {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      cpuUsage: [],
      throughput: [],
      concurrentUsers: 0
    }
  }
}

describe('Storyboard Performance Tests', () => {
  beforeEach(() => {
    PerformanceMonitor.reset()
    storyboardTestUtils.resetApiLimiter()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: API 응답 시간 테스트', () => {
    it('스토리보드 생성 응답이 2초 이내여야 함', async () => {
      // Given: 성능 측정을 위한 스토리보드 생성 데이터
      const createData: StoryboardCreateInput = {
        scenarioId: 'scenario-perf-001',
        title: '성능 테스트 스토리보드',
        userId: 'user-perf-001'
      }

      // When: 응답 시간 측정하며 스토리보드 생성
      const { result, time } = await PerformanceMonitor.measureResponseTime(async () => {
        const response = await fetch('/api/storyboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData)
        })
        return response.json()
      })

      // Then: 2초 이내 응답 및 성공
      expect(time).toBeLessThan(2000) // 2초 이내
      expect(result.success).toBe(true)
    })

    it('프레임 생성 응답이 5초 이내여야 함', async () => {
      // Given: 프레임 생성 요청
      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-perf-001',
        sceneDescription: '성능 테스트 프레임',
        priority: 'normal'
      }

      // When: 응답 시간 측정하며 프레임 생성
      const { result, time } = await PerformanceMonitor.measureResponseTime(async () => {
        const response = await fetch('/api/storyboard/generate/frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(frameRequest)
        })
        return response.json()
      })

      // Then: 5초 이내 응답 (이미지 생성 시작까지만)
      expect(time).toBeLessThan(5000) // 5초 이내
      expect(result.success).toBe(true)
    })

    it('일관성 분석 응답이 3초 이내여야 함', async () => {
      // Given: 일관성 분석 요청
      const storyboardId = 'storyboard-test-001'

      // When: 응답 시간 측정하며 일관성 분석
      const { result, time } = await PerformanceMonitor.measureResponseTime(async () => {
        const response = await fetch(`/api/storyboard/${storyboardId}/consistency`)
        return response.json()
      })

      // Then: 3초 이내 응답
      expect(time).toBeLessThan(3000) // 3초 이내
      expect(result.success).toBe(true)
    })

    it('대용량 스토리보드 조회가 10초 이내여야 함', async () => {
      // Given: 100개 프레임을 가진 대용량 스토리보드 모킹
      const largeStoryboard = {
        metadata: {
          id: 'large-storyboard-001',
          scenarioId: 'scenario-001',
          title: '대용량 스토리보드',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'completed',
          userId: 'user-001',
          version: 1
        },
        frames: Array.from({ length: 100 }, (_, i) => ({
          metadata: {
            id: `frame-${i}`,
            sceneId: `scene-${i}`,
            order: i + 1,
            title: `프레임 ${i + 1}`,
            description: `대용량 테스트 프레임 ${i + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'completed',
            userId: 'user-001'
          },
          prompt: {
            basePrompt: `테스트 프롬프트 ${i + 1}`,
            enhancedPrompt: `향상된 테스트 프롬프트 ${i + 1}`,
            styleModifiers: [],
            technicalSpecs: []
          },
          config: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: 'hd'
          },
          consistencyRefs: [],
          attempts: []
        })),
        settings: {
          defaultConfig: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: 'hd'
          },
          globalConsistencyRefs: [],
          autoGeneration: false,
          qualityThreshold: 0.7,
          maxRetries: 3,
          batchSize: 5
        }
      }

      server.use(
        http.get('/api/storyboards/large-storyboard-001', () => {
          return HttpResponse.json({
            success: true,
            data: largeStoryboard
          })
        })
      )

      // When: 대용량 스토리보드 조회
      const { result, time } = await PerformanceMonitor.measureResponseTime(async () => {
        const response = await fetch('/api/storyboards/large-storyboard-001')
        return response.json()
      })

      // Then: 10초 이내 응답
      expect(time).toBeLessThan(10000) // 10초 이내
      expect(result.success).toBe(true)
      expect(result.data.frames).toHaveLength(100)
    })
  })

  describe('Red Phase: 배치 생성 성능 테스트', () => {
    it('10개 프레임 배치 생성이 30초 이내에 완료되어야 함', async () => {
      // Given: 10개 프레임 배치 요청
      const batchRequest: BatchGenerationRequest = {
        frames: Array.from({ length: 10 }, (_, i) => ({
          sceneId: `scene-batch-${i}`,
          sceneDescription: `배치 성능 테스트 프레임 ${i + 1}`,
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 3,
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      const startTime = performance.now()

      // When: 배치 생성 실행
      const batchResponse = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(batchResponse.ok).toBe(true)
      const batchResult = await batchResponse.json()
      const batchId = batchResult.data.batchId

      // 완료까지 대기 (최대 30초)
      let completed = false
      let attempts = 0
      const maxAttempts = 30

      while (!completed && attempts < maxAttempts) {
        await jest.advanceTimersByTimeAsync(1000) // 1초씩 진행

        const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
        const progress = await progressResponse.json()

        if (progress.data.status === 'completed') {
          completed = true
        }

        attempts++
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Then: 30초 이내 완료
      expect(totalTime).toBeLessThan(30000) // 30초 이내
      expect(completed).toBe(true)
    })

    it('동시 배치 처리 성능이 기준을 만족해야 함', async () => {
      // Given: 3개의 동시 배치 요청
      const concurrentBatches = Array.from({ length: 3 }, (_, batchIndex) => ({
        frames: Array.from({ length: 5 }, (_, frameIndex) => ({
          sceneId: `scene-concurrent-${batchIndex}-${frameIndex}`,
          sceneDescription: `동시 배치 ${batchIndex + 1} 프레임 ${frameIndex + 1}`,
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 2,
          delayBetweenRequests: 500,
          stopOnError: false
        }
      }))

      const startTime = performance.now()

      // When: 동시 배치 실행
      const batchPromises = concurrentBatches.map(async (batchRequest, index) => {
        PerformanceMonitor.incrementConcurrentUsers()

        try {
          const response = await fetch('/api/storyboard/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchRequest)
          })

          const result = await response.json()
          return { batchIndex: index, success: response.ok, data: result }
        } finally {
          PerformanceMonitor.decrementConcurrentUsers()
        }
      })

      const batchResults = await Promise.all(batchPromises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Then: 모든 배치가 성공하고 적절한 시간 내 완료
      expect(batchResults.every(result => result.success)).toBe(true)
      expect(totalTime).toBeLessThan(60000) // 1분 이내

      // 처리량 계산
      const totalOperations = concurrentBatches.length * 5 // 3배치 × 5프레임
      const throughput = PerformanceMonitor.calculateThroughput(totalOperations, totalTime)
      expect(throughput).toBeGreaterThan(0.1) // 최소 0.1 ops/sec
    })

    it('메모리 사용량이 한도를 초과하지 않아야 함', async () => {
      // Given: 메모리 집약적인 배치 요청
      const memoryIntensiveBatch: BatchGenerationRequest = {
        frames: Array.from({ length: 20 }, (_, i) => ({
          sceneId: `scene-memory-${i}`,
          sceneDescription: `메모리 테스트 프레임 ${i + 1}`,
          config: {
            model: 'dall-e-3',
            quality: '4k', // 고해상도로 메모리 사용량 증가
            aspectRatio: '16:9'
          },
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 5, // 높은 동시 처리
          delayBetweenRequests: 100, // 짧은 지연
          stopOnError: false
        }
      }

      // When: 메모리 사용량 모니터링하며 배치 실행
      const memoryUsageBeforeRequest = PerformanceMonitor.monitorMemoryUsage()

      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryIntensiveBatch)
      })

      expect(response.ok).toBe(true)

      // 배치 처리 중 메모리 모니터링
      for (let i = 0; i < 10; i++) {
        await jest.advanceTimersByTimeAsync(2000) // 2초씩 진행
        PerformanceMonitor.monitorMemoryUsage()
      }

      const stats = PerformanceMonitor.getStatistics()

      // Then: 메모리 사용량이 제한 내에 있어야 함
      expect(stats.memoryUsage.max).toBeLessThan(500) // 최대 500MB
      expect(stats.memoryUsage.avg).toBeLessThan(300) // 평균 300MB

      // 메모리 누수 확인 (사용량이 지속적으로 증가하지 않음)
      const memoryTrend = stats.memoryUsage.memoryUsage
      const firstHalf = memoryTrend.slice(0, Math.floor(memoryTrend.length / 2))
      const secondHalf = memoryTrend.slice(Math.floor(memoryTrend.length / 2))

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      // 메모리 사용량 증가가 50% 이내여야 함
      expect(secondHalfAvg / firstHalfAvg).toBeLessThan(1.5)
    })
  })

  describe('Red Phase: 동시 사용자 부하 테스트', () => {
    it('100명 동시 사용자 처리가 가능해야 함', async () => {
      // Given: 100명의 동시 사용자 시뮬레이션
      const concurrentUsers = 100
      const userRequests = Array.from({ length: concurrentUsers }, (_, i) => ({
        scenarioId: 'scenario-load-001',
        title: `부하 테스트 스토리보드 ${i + 1}`,
        userId: `user-load-${i + 1}`
      }))

      const startTime = performance.now()

      // When: 100개 동시 요청 실행
      const userPromises = userRequests.map(async (requestData, index) => {
        PerformanceMonitor.incrementConcurrentUsers()

        try {
          const response = await fetch('/api/storyboards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
          })

          const result = await response.json()
          const responseTime = performance.now() - startTime

          return {
            userIndex: index,
            success: response.ok,
            responseTime,
            status: response.status
          }
        } finally {
          PerformanceMonitor.decrementConcurrentUsers()
        }
      })

      const userResults = await Promise.all(userPromises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Then: 성능 기준 달성
      const successRate = userResults.filter(r => r.success).length / concurrentUsers
      const averageResponseTime = userResults.reduce((sum, r) => sum + r.responseTime, 0) / concurrentUsers
      const p95ResponseTime = userResults
        .map(r => r.responseTime)
        .sort((a, b) => a - b)[Math.floor(concurrentUsers * 0.95)]

      expect(successRate).toBeGreaterThan(0.95) // 95% 성공률
      expect(averageResponseTime).toBeLessThan(5000) // 평균 5초 이내
      expect(p95ResponseTime).toBeLessThan(10000) // 95백분위 10초 이내
      expect(totalTime).toBeLessThan(30000) // 전체 처리 30초 이내
    })

    it('피크 타임 트래픽 패턴을 처리할 수 있어야 함', async () => {
      // Given: 피크 타임 트래픽 패턴 (점진적 증가 후 감소)
      const trafficPattern = [
        { users: 10, duration: 5000 },  // 5초간 10명
        { users: 50, duration: 10000 }, // 10초간 50명
        { users: 100, duration: 15000 }, // 15초간 100명 (피크)
        { users: 50, duration: 10000 }, // 10초간 50명
        { users: 10, duration: 5000 }   // 5초간 10명
      ]

      const allResults: any[] = []

      // When: 트래픽 패턴에 따른 부하 테스트
      for (const phase of trafficPattern) {
        const phaseStartTime = performance.now()
        const phaseRequests = Array.from({ length: phase.users }, (_, i) => ({
          scenarioId: 'scenario-peak-001',
          title: `피크 테스트 ${phase.users}명 ${i + 1}`,
          userId: `user-peak-${phase.users}-${i + 1}`
        }))

        const phasePromises = phaseRequests.map(async (requestData) => {
          const response = await fetch('/api/storyboards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
          })

          return {
            success: response.ok,
            responseTime: performance.now() - phaseStartTime,
            status: response.status,
            users: phase.users
          }
        })

        const phaseResults = await Promise.all(phasePromises)
        allResults.push(...phaseResults)

        // 다음 단계까지 대기
        await jest.advanceTimersByTimeAsync(phase.duration)
      }

      // Then: 모든 단계에서 성능 기준 달성
      const peakResults = allResults.filter(r => r.users === 100) // 피크 시간 결과
      const peakSuccessRate = peakResults.filter(r => r.success).length / peakResults.length

      expect(peakSuccessRate).toBeGreaterThan(0.9) // 피크 시간에도 90% 성공률 유지

      // 응답 시간 분석
      const responseTimesByUsers = new Map<number, number[]>()
      allResults.forEach(result => {
        if (!responseTimesByUsers.has(result.users)) {
          responseTimesByUsers.set(result.users, [])
        }
        responseTimesByUsers.get(result.users)!.push(result.responseTime)
      })

      // 사용자 수 증가에 따른 응답 시간 증가가 선형적이어야 함
      const userCounts = Array.from(responseTimesByUsers.keys()).sort((a, b) => a - b)
      for (let i = 1; i < userCounts.length; i++) {
        const prevUserCount = userCounts[i - 1]
        const currUserCount = userCounts[i]

        const prevAvgTime = responseTimesByUsers.get(prevUserCount)!.reduce((a, b) => a + b, 0) / responseTimesByUsers.get(prevUserCount)!.length
        const currAvgTime = responseTimesByUsers.get(currUserCount)!.reduce((a, b) => a + b, 0) / responseTimesByUsers.get(currUserCount)!.length

        // 응답 시간 증가가 사용자 수 증가 비율의 2배를 넘지 않아야 함
        const userRatio = currUserCount / prevUserCount
        const timeRatio = currAvgTime / prevAvgTime

        expect(timeRatio).toBeLessThan(userRatio * 2)
      }
    })
  })

  describe('Red Phase: 리소스 사용량 최적화 테스트', () => {
    it('CPU 사용률이 80%를 초과하지 않아야 함', async () => {
      // Given: CPU 집약적인 작업 (일관성 분석)
      const cpuIntensiveRequests = Array.from({ length: 20 }, (_, i) =>
        `storyboard-cpu-test-${i}`
      )

      // When: CPU 사용률 모니터링하며 일관성 분석 실행
      const analysisPromises = cpuIntensiveRequests.map(async (storyboardId) => {
        const cpuBefore = PerformanceMonitor.monitorCpuUsage()

        const response = await fetch(`/api/storyboard/${storyboardId}/consistency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comprehensive',
            analysisDepth: 'detailed'
          })
        })

        const cpuAfter = PerformanceMonitor.monitorCpuUsage()

        return {
          success: response.ok,
          cpuUsage: cpuAfter
        }
      })

      const analysisResults = await Promise.all(analysisPromises)
      const stats = PerformanceMonitor.getStatistics()

      // Then: CPU 사용률 제한 내 유지
      expect(stats.cpuUsage.max).toBeLessThan(80) // 최대 80%
      expect(stats.cpuUsage.avg).toBeLessThan(60) // 평균 60%

      // 모든 요청이 성공해야 함
      const successRate = analysisResults.filter(r => r.success).length / analysisResults.length
      expect(successRate).toBeGreaterThan(0.95)
    })

    it('API 응답 크기가 제한을 초과하지 않아야 함', async () => {
      // Given: 대용량 응답을 유발하는 요청
      const largeDataRequest = {
        includeFullFrameData: true,
        includeGenerationHistory: true,
        includeAnalytics: true,
        includeConsistencyData: true
      }

      // When: 대용량 데이터 조회
      const response = await fetch('/api/storyboards/storyboard-test-001?detailed=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeDataRequest)
      })

      expect(response.ok).toBe(true)

      const contentLength = response.headers.get('content-length')
      const responseText = await response.text()
      const actualSize = new Blob([responseText]).size

      // Then: 응답 크기가 제한 내에 있어야 함
      expect(actualSize).toBeLessThan(10 * 1024 * 1024) // 10MB 미만

      // Content-Length 헤더가 정확해야 함
      if (contentLength) {
        expect(parseInt(contentLength)).toBe(actualSize)
      }

      // 압축이 적용되어야 함 (gzip)
      const contentEncoding = response.headers.get('content-encoding')
      expect(contentEncoding).toBe('gzip')
    })

    it('데이터베이스 쿼리 성능이 기준을 만족해야 함', async () => {
      // Given: 복잡한 쿼리를 유발하는 요청
      const complexQueryRequest = {
        filters: {
          createdAfter: '2024-01-01',
          status: ['completed', 'in_progress'],
          userId: 'user-test-001',
          tags: ['cinematic', 'anime']
        },
        sorting: {
          field: 'updatedAt',
          order: 'desc'
        },
        pagination: {
          page: 1,
          limit: 50
        },
        include: [
          'frames',
          'statistics',
          'consistencyRefs'
        ]
      }

      const startTime = performance.now()

      // When: 복잡한 쿼리 실행
      const response = await fetch('/api/storyboards/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexQueryRequest)
      })

      const endTime = performance.now()
      const queryTime = endTime - startTime

      // Then: 쿼리 성능 기준 달성
      expect(response.ok).toBe(true)
      expect(queryTime).toBeLessThan(3000) // 3초 이내

      const result = await response.json()
      expect(result.data).toBeInstanceOf(Array)
      expect(result.pagination).toBeDefined()

      // 결과 크기가 적절해야 함
      expect(result.data.length).toBeLessThanOrEqual(50)
    })
  })
})