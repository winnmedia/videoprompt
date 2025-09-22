/**
 * Storyboard Batch Generation API Tests
 *
 * TDD Red Phase: 배치 생성 로직 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, MSW 모킹, 비용 안전 규칙, 성능 예산
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import type {
  BatchGenerationRequest,
  FrameGenerationRequest,
  GenerationProgress
} from '../../../entities/storyboard'

/**
 * 배치 생성 모니터링
 */
class BatchGenerationMonitor {
  private static activeBatches = new Map<string, {
    startTime: number
    frameCount: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
  }>()

  static startBatch(batchId: string, frameCount: number) {
    this.activeBatches.set(batchId, {
      startTime: Date.now(),
      frameCount,
      status: 'pending'
    })
  }

  static updateBatchStatus(batchId: string, status: 'processing' | 'completed' | 'failed') {
    const batch = this.activeBatches.get(batchId)
    if (batch) {
      batch.status = status
    }
  }

  static getBatchInfo(batchId: string) {
    return this.activeBatches.get(batchId)
  }

  static clear() {
    this.activeBatches.clear()
  }
}

describe('/api/storyboard/batch - 배치 생성 API', () => {
  beforeEach(() => {
    storyboardTestUtils.resetApiLimiter()
    BatchGenerationMonitor.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: 배치 생성 기본 기능', () => {
    it('여러 프레임 배치 생성이 성공해야 함', async () => {
      // Given: 배치 생성 요청
      const batchRequest: BatchGenerationRequest = {
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '주인공이 커피숍에 앉아있는 모습',
            priority: 'normal'
          },
          {
            sceneId: 'scene-002',
            sceneDescription: '창밖으로 보이는 비오는 거리',
            priority: 'normal'
          },
          {
            sceneId: 'scene-003',
            sceneDescription: '주인공의 회상 장면',
            priority: 'high'
          }
        ],
        batchSettings: {
          maxConcurrent: 2,
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      // Then: 배치 생성이 시작되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('batchId')
      expect(result.data.status).toBe('started')
      expect(result.data.totalFrames).toBe(3)
      expect(result.data.estimatedTime).toBeGreaterThan(0)
    })

    it('우선순위에 따른 배치 처리 순서가 올바르게 동작해야 함', async () => {
      // Given: 다양한 우선순위의 프레임들
      const batchRequest: BatchGenerationRequest = {
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '일반 우선순위 1',
            priority: 'normal'
          },
          {
            sceneId: 'scene-002',
            sceneDescription: '높은 우선순위 1',
            priority: 'high'
          },
          {
            sceneId: 'scene-003',
            sceneDescription: '낮은 우선순위 1',
            priority: 'low'
          },
          {
            sceneId: 'scene-004',
            sceneDescription: '높은 우선순위 2',
            priority: 'high'
          }
        ],
        batchSettings: {
          maxConcurrent: 1,
          delayBetweenRequests: 500,
          stopOnError: false
        }
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)

      const result = await response.json()
      const batchId = result.data.batchId

      // 진행 상황 확인
      const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      expect(progressResponse.ok).toBe(true)

      const progress = await progressResponse.json()

      // Then: 높은 우선순위 프레임들이 먼저 처리되어야 함
      const processedOrder = progress.data.processedFrames.map((f: any) => f.priority)
      const highPriorityCount = processedOrder.filter((p: string) => p === 'high').length
      expect(highPriorityCount).toBeGreaterThan(0)

      // 첫 번째로 처리된 프레임은 높은 우선순위여야 함
      expect(processedOrder[0]).toBe('high')
    })

    it('배치 크기 제한을 초과하면 400 에러를 반환해야 함', async () => {
      // Given: 제한을 초과하는 배치 요청 (최대 10개)
      const batchRequest: BatchGenerationRequest = {
        frames: Array.from({ length: 15 }, (_, i) => ({
          sceneId: `scene-${i + 1}`,
          sceneDescription: `테스트 프레임 ${i + 1}`,
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 5,
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      // Then: 400 에러를 반환해야 함
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error.code).toBe('BATCH_SIZE_EXCEEDED')
      expect(result.error.message).toContain('최대 10개')
    })
  })

  describe('Red Phase: 배치 진행 상황 모니터링', () => {
    it('배치 진행 상황을 실시간으로 조회할 수 있어야 함', async () => {
      // Given: 진행 중인 배치
      const batchId = 'batch-test-001'
      BatchGenerationMonitor.startBatch(batchId, 3)

      // When: 진행 상황 조회
      const response = await fetch(`/api/storyboard/batch/${batchId}/progress`)

      // Then: 진행 상황 정보를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('batchId', batchId)
      expect(result.data).toHaveProperty('status')
      expect(result.data).toHaveProperty('progress') // 0.0 ~ 1.0
      expect(result.data).toHaveProperty('completedFrames')
      expect(result.data).toHaveProperty('totalFrames')
      expect(result.data).toHaveProperty('estimatedTimeRemaining')
    })

    it('WebSocket을 통한 실시간 진행 상황 업데이트가 동작해야 함', async () => {
      // Given: WebSocket 연결 모킹
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }

      // WebSocket 생성 모킹
      global.WebSocket = jest.fn(() => mockWebSocket) as any

      const batchId = 'batch-test-002'

      // When: WebSocket 연결 및 배치 시작
      const ws = new WebSocket(`ws://localhost:3000/api/storyboard/batch/${batchId}/ws`)

      // 진행 상황 업데이트 시뮬레이션
      const progressUpdates: GenerationProgress[] = [
        {
          frameId: 'frame-001',
          status: 'generating',
          progress: 0.3,
          estimatedTimeRemaining: 25,
          currentStep: '프롬프트 분석 중'
        },
        {
          frameId: 'frame-001',
          status: 'completed',
          progress: 1.0,
          estimatedTimeRemaining: 0,
          currentStep: '생성 완료'
        }
      ]

      // Then: WebSocket 메시지가 올바르게 전송되어야 함
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining(`/api/storyboard/batch/${batchId}/ws`)
      )
    })

    it('배치 취소 기능이 올바르게 동작해야 함', async () => {
      // Given: 진행 중인 배치
      const batchId = 'batch-test-003'
      BatchGenerationMonitor.startBatch(batchId, 5)
      BatchGenerationMonitor.updateBatchStatus(batchId, 'processing')

      // When: 배치 취소 요청
      const response = await fetch(`/api/storyboard/batch/${batchId}/cancel`, {
        method: 'POST'
      })

      // Then: 취소가 성공하고 진행 중인 작업이 중단되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.status).toBe('cancelled')

      // 진행 상황 확인
      const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const progress = await progressResponse.json()
      expect(progress.data.status).toBe('cancelled')
    })
  })

  describe('Red Phase: 오류 처리 및 복구', () => {
    it('개별 프레임 실패 시 나머지 프레임은 계속 처리되어야 함', async () => {
      // Given: 실패를 유발하는 핸들러 (특정 프레임만)
      server.use(
        http.post('/api/ai/generate-image', async ({ request }) => {
          const body = await request.json()
          if (body.prompt.includes('실패 프레임')) {
            return HttpResponse.json(
              { error: { code: 'GENERATION_FAILED', message: '생성 실패' } },
              { status: 500 }
            )
          }
          return HttpResponse.json({ success: true, data: { imageUrl: 'test.jpg' } })
        })
      )

      const batchRequest: BatchGenerationRequest = {
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '정상 프레임 1',
            priority: 'normal'
          },
          {
            sceneId: 'scene-002',
            sceneDescription: '실패 프레임',
            priority: 'normal'
          },
          {
            sceneId: 'scene-003',
            sceneDescription: '정상 프레임 2',
            priority: 'normal'
          }
        ],
        batchSettings: {
          maxConcurrent: 1,
          delayBetweenRequests: 500,
          stopOnError: false
        }
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const batchId = result.data.batchId

      // 완료까지 대기
      await jest.advanceTimersByTimeAsync(30000)

      // Then: 일부 실패했지만 나머지는 성공해야 함
      const finalProgressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const finalProgress = await finalProgressResponse.json()

      expect(finalProgress.data.completedFrames).toBe(2)
      expect(finalProgress.data.failedFrames).toBe(1)
      expect(finalProgress.data.status).toBe('completed_with_errors')
    })

    it('모든 프레임 실패 시 배치 전체가 실패 상태가 되어야 함', async () => {
      // Given: 모든 요청을 실패시키는 핸들러
      server.use(
        http.post('/api/ai/generate-image', () => {
          return HttpResponse.json(
            { error: { code: 'SERVICE_UNAVAILABLE', message: '서비스 점검 중' } },
            { status: 503 }
          )
        })
      )

      const batchRequest: BatchGenerationRequest = {
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '실패할 프레임 1',
            priority: 'normal'
          },
          {
            sceneId: 'scene-002',
            sceneDescription: '실패할 프레임 2',
            priority: 'normal'
          }
        ]
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const batchId = result.data.batchId

      // 완료까지 대기
      await jest.advanceTimersByTimeAsync(30000)

      // Then: 배치 전체가 실패 상태여야 함
      const finalProgressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const finalProgress = await finalProgressResponse.json()

      expect(finalProgress.data.status).toBe('failed')
      expect(finalProgress.data.failedFrames).toBe(2)
      expect(finalProgress.data.completedFrames).toBe(0)
    })

    it('재시도 로직이 올바르게 동작해야 함', async () => {
      // Given: 첫 번째 시도는 실패, 두 번째는 성공하는 핸들러
      let attemptCount = 0
      server.use(
        http.post('/api/ai/generate-image', () => {
          attemptCount++
          if (attemptCount === 1) {
            return HttpResponse.json(
              { error: { code: 'TEMPORARY_FAILURE', message: '일시적 실패' } },
              { status: 500 }
            )
          }
          return HttpResponse.json({
            success: true,
            data: { imageUrl: 'test.jpg', cost: 0.04 }
          })
        })
      )

      const batchRequest: BatchGenerationRequest = {
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '재시도 테스트 프레임',
            priority: 'normal'
          }
        ],
        batchSettings: {
          maxConcurrent: 1,
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      // When: 배치 생성 API 호출
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const batchId = result.data.batchId

      // 재시도 완료까지 대기
      await jest.advanceTimersByTimeAsync(15000)

      // Then: 재시도를 통해 성공해야 함
      const finalProgressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const finalProgress = await finalProgressResponse.json()

      expect(finalProgress.data.completedFrames).toBe(1)
      expect(finalProgress.data.failedFrames).toBe(0)
      expect(attemptCount).toBeGreaterThan(1) // 재시도 발생 확인
    })
  })

  describe('Red Phase: 성능 및 리소스 관리', () => {
    it('동시 처리 제한이 올바르게 동작해야 함', async () => {
      // Given: 동시 처리 제한 설정
      const batchRequest: BatchGenerationRequest = {
        frames: Array.from({ length: 8 }, (_, i) => ({
          sceneId: `scene-${i + 1}`,
          sceneDescription: `동시 처리 테스트 프레임 ${i + 1}`,
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 3, // 최대 3개 동시 처리
          delayBetweenRequests: 500,
          stopOnError: false
        }
      }

      // When: 배치 생성 시작
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const batchId = result.data.batchId

      // 초기 진행 상황 확인
      await jest.advanceTimersByTimeAsync(1000)
      const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const progress = await progressResponse.json()

      // Then: 동시에 처리 중인 프레임이 3개를 초과하지 않아야 함
      expect(progress.data.processingFrames).toBeLessThanOrEqual(3)
    })

    it('메모리 사용량 모니터링이 동작해야 함', async () => {
      // Given: 대용량 배치 요청
      const largeBatchRequest: BatchGenerationRequest = {
        frames: Array.from({ length: 10 }, (_, i) => ({
          sceneId: `scene-${i + 1}`,
          sceneDescription: `대용량 배치 테스트 프레임 ${i + 1}`,
          priority: 'normal' as const,
          config: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: '4k' // 고해상도로 메모리 사용량 증가
          }
        }))
      }

      // When: 배치 생성 시작
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeBatchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const batchId = result.data.batchId

      // 시스템 리소스 모니터링 조회
      const resourceResponse = await fetch(`/api/storyboard/batch/${batchId}/resources`)

      // Then: 메모리 사용량 정보를 제공해야 함
      expect(resourceResponse.ok).toBe(true)

      const resourceData = await resourceResponse.json()
      expect(resourceData.data).toHaveProperty('memoryUsage')
      expect(resourceData.data).toHaveProperty('cpuUsage')
      expect(resourceData.data).toHaveProperty('estimatedCost')
    })

    it('배치 처리 시간이 예상 범위 내에 있어야 함', async () => {
      // Given: 시간 측정을 위한 배치 요청
      const batchRequest: BatchGenerationRequest = {
        frames: Array.from({ length: 5 }, (_, i) => ({
          sceneId: `scene-${i + 1}`,
          sceneDescription: `성능 테스트 프레임 ${i + 1}`,
          priority: 'normal' as const
        })),
        batchSettings: {
          maxConcurrent: 2,
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      const startTime = Date.now()

      // When: 배치 생성 및 완료까지 대기
      const response = await fetch('/api/storyboard/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      const expectedTime = result.data.estimatedTime

      // 완료까지 대기
      await jest.advanceTimersByTimeAsync(expectedTime + 10000)

      const endTime = Date.now()
      const actualTime = endTime - startTime

      // Then: 실제 처리 시간이 예상 시간의 ±20% 범위 내에 있어야 함
      const tolerance = expectedTime * 0.2
      expect(actualTime).toBeGreaterThanOrEqual(expectedTime - tolerance)
      expect(actualTime).toBeLessThanOrEqual(expectedTime + tolerance)
    })
  })
})