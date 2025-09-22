/**
 * Storyboard Integration Tests
 *
 * TDD Red Phase: ByteDance-Seedream API 통합 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, MSW 모킹, 전체 워크플로우 테스트
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import type {
  Storyboard,
  StoryboardCreateInput,
  FrameGenerationRequest,
  BatchGenerationRequest,
  GenerationResult
} from '../../../entities/storyboard'

/**
 * ByteDance Seedream API 응답 타입
 */
interface SeedreamGenerationResponse {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_url?: string
  error_message?: string
  processing_time?: number
  cost?: number
}

/**
 * 통합 테스트 헬퍼
 */
class IntegrationTestHelper {
  /**
   * 완전한 스토리보드 워크플로우 실행
   */
  static async executeCompleteWorkflow(
    storyboardData: StoryboardCreateInput,
    frameRequests: FrameGenerationRequest[]
  ) {
    // 1. 스토리보드 생성
    const createResponse = await fetch('/api/storyboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storyboardData)
    })

    if (!createResponse.ok) {
      throw new Error(`Storyboard creation failed: ${createResponse.status}`)
    }

    const createResult = await createResponse.json()
    const storyboardId = createResult.data.metadata.id

    // 2. 프레임 배치 생성
    const batchRequest: BatchGenerationRequest = {
      frames: frameRequests,
      batchSettings: {
        maxConcurrent: 2,
        delayBetweenRequests: 1000,
        stopOnError: false
      }
    }

    const batchResponse = await fetch(`/api/storyboards/${storyboardId}/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchRequest)
    })

    if (!batchResponse.ok) {
      throw new Error(`Batch generation failed: ${batchResponse.status}`)
    }

    const batchResult = await batchResponse.json()
    const batchId = batchResult.data.batchId

    // 3. 진행 상황 모니터링
    let completed = false
    let attempts = 0
    const maxAttempts = 30

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const progressResponse = await fetch(`/api/storyboard/batch/${batchId}/progress`)
      const progress = await progressResponse.json()

      if (progress.data.status === 'completed' || progress.data.status === 'failed') {
        completed = true
      }

      attempts++
    }

    // 4. 최종 결과 조회
    const finalResponse = await fetch(`/api/storyboards/${storyboardId}`)
    const finalResult = await finalResponse.json()

    return {
      storyboard: finalResult.data,
      batchId,
      attempts
    }
  }
}

describe('Storyboard Integration Tests - ByteDance-Seedream API', () => {
  beforeEach(() => {
    storyboardTestUtils.resetApiLimiter()
    storyboardTestUtils.clearMockStoryboards()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: ByteDance Seedream API 통합', () => {
    it('ByteDance Seedream API로 이미지 생성이 성공해야 함', async () => {
      // Given: Seedream API 모킹
      server.use(
        http.post('https://api.bytedance.com/seedream/v1/generate', async ({ request }) => {
          const body = await request.json()

          // API 키 검증
          const authHeader = request.headers.get('Authorization')
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return HttpResponse.json(
              { error: 'Invalid API key' },
              { status: 401 }
            )
          }

          return HttpResponse.json({
            task_id: `task_${Date.now()}`,
            status: 'pending',
            estimated_time: 15
          })
        }),

        http.get('https://api.bytedance.com/seedream/v1/task/:taskId', ({ params }) => {
          const { taskId } = params

          return HttpResponse.json({
            task_id: taskId,
            status: 'completed',
            image_url: `https://cdn.bytedance.com/generated/${taskId}.jpg`,
            processing_time: 12,
            cost: 0.045
          })
        })
      )

      const generationRequest = {
        prompt: '아름다운 산 풍경, 일몰, 시네마틱 라이팅',
        style: 'cinematic',
        width: 1920,
        height: 1080,
        quality: 'high',
        steps: 20,
        guidance_scale: 7.5
      }

      // When: Seedream API를 통한 이미지 생성
      const response = await fetch('/api/integrations/seedream/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generationRequest)
      })

      // Then: 생성 성공 및 올바른 응답 형식
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('taskId')
      expect(result.data).toHaveProperty('status', 'pending')
      expect(result.data).toHaveProperty('estimatedTime')
    })

    it('Seedream API 응답을 내부 형식으로 변환해야 함', async () => {
      // Given: Seedream API 응답 형식
      const seedreamResponse: SeedreamGenerationResponse = {
        task_id: 'task_12345',
        status: 'completed',
        image_url: 'https://cdn.bytedance.com/generated/task_12345.jpg',
        processing_time: 15,
        cost: 0.048
      }

      server.use(
        http.get('/api/integrations/seedream/task/:taskId', () => {
          return HttpResponse.json(seedreamResponse)
        })
      )

      // When: Seedream 응답을 내부 형식으로 변환
      const response = await fetch('/api/integrations/seedream/task/task_12345')

      // Then: 내부 GenerationResult 형식으로 변환되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('imageUrl', seedreamResponse.image_url)
      expect(result.data).toHaveProperty('generationId', seedreamResponse.task_id)
      expect(result.data).toHaveProperty('processingTime', seedreamResponse.processing_time)
      expect(result.data).toHaveProperty('cost', seedreamResponse.cost)
      expect(result.data).toHaveProperty('generatedAt')
      expect(result.data).toHaveProperty('model', 'seedream')
    })

    it('Seedream API 오류를 적절히 처리해야 함', async () => {
      // Given: API 오류 시뮬레이션
      server.use(
        http.post('https://api.bytedance.com/seedream/v1/generate', () => {
          return HttpResponse.json(
            {
              error_code: 'QUOTA_EXCEEDED',
              error_message: 'Daily quota exceeded',
              retry_after: 3600
            },
            { status: 429 }
          )
        })
      )

      const generationRequest = {
        prompt: '테스트 프롬프트',
        style: 'realistic'
      }

      // When: 오류가 발생하는 API 호출
      const response = await fetch('/api/integrations/seedream/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generationRequest)
      })

      // Then: 적절한 오류 처리 및 재시도 정보 제공
      expect(response.status).toBe(429)

      const result = await response.json()
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
      expect(result.error.details.originalError).toBe('QUOTA_EXCEEDED')
      expect(result.error.details.retryAfter).toBe(3600)
    })
  })

  describe('Red Phase: 전체 이미지 생성 워크플로우', () => {
    it('스토리보드 생성부터 이미지 완성까지 전체 워크플로우가 성공해야 함', async () => {
      // Given: 완전한 워크플로우 데이터
      const storyboardData: StoryboardCreateInput = {
        scenarioId: 'scenario-integration-001',
        title: '통합 테스트 스토리보드',
        description: '전체 워크플로우 테스트',
        userId: 'user-integration-001',
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic'
        }
      }

      const frameRequests: FrameGenerationRequest[] = [
        {
          sceneId: 'scene-001',
          sceneDescription: '주인공이 커피숍에 앉아있는 모습',
          additionalPrompt: 'warm lighting, cozy atmosphere',
          priority: 'high'
        },
        {
          sceneId: 'scene-002',
          sceneDescription: '창밖으로 보이는 비오는 거리',
          additionalPrompt: 'dramatic lighting, urban setting',
          priority: 'normal'
        },
        {
          sceneId: 'scene-003',
          sceneDescription: '주인공의 회상 장면',
          additionalPrompt: 'soft focus, nostalgic mood',
          priority: 'normal'
        }
      ]

      // When: 전체 워크플로우 실행
      const result = await IntegrationTestHelper.executeCompleteWorkflow(
        storyboardData,
        frameRequests
      )

      // Then: 모든 단계가 성공적으로 완료되어야 함
      expect(result.storyboard).toBeDefined()
      expect(result.storyboard.metadata.title).toBe(storyboardData.title)
      expect(result.storyboard.frames).toHaveLength(3)

      // 모든 프레임이 완료 상태여야 함
      result.storyboard.frames.forEach((frame: any) => {
        expect(frame.metadata.status).toBe('completed')
        expect(frame.result).toBeDefined()
        expect(frame.result.imageUrl).toBeDefined()
      })

      // 통계 정보 확인
      expect(result.storyboard.statistics.completedFrames).toBe(3)
      expect(result.storyboard.statistics.totalCost).toBeGreaterThan(0)
    })

    it('일관성 참조를 포함한 워크플로우가 올바르게 동작해야 함', async () => {
      // Given: 일관성 참조가 포함된 데이터
      const consistencyRef = {
        id: 'char-ref-001',
        type: 'character' as const,
        name: '주인공',
        description: '20대 여성, 긴 검은 머리, 캐주얼한 복장',
        keyFeatures: ['long black hair', 'casual clothing', 'young woman'],
        weight: 0.8,
        isActive: true
      }

      const storyboardData: StoryboardCreateInput = {
        scenarioId: 'scenario-consistency-001',
        title: '일관성 테스트 스토리보드',
        userId: 'user-test-001',
        consistencyRefs: [consistencyRef]
      }

      const frameRequests: FrameGenerationRequest[] = [
        {
          sceneId: 'scene-001',
          sceneDescription: '주인공이 웃고 있는 모습',
          consistencyRefs: ['char-ref-001'],
          priority: 'normal'
        },
        {
          sceneId: 'scene-002',
          sceneDescription: '주인공이 걷고 있는 모습',
          consistencyRefs: ['char-ref-001'],
          priority: 'normal'
        }
      ]

      // When: 일관성 참조 포함 워크플로우 실행
      const result = await IntegrationTestHelper.executeCompleteWorkflow(
        storyboardData,
        frameRequests
      )

      // Then: 일관성 참조가 올바르게 적용되어야 함
      expect(result.storyboard.settings.globalConsistencyRefs).toHaveLength(1)
      expect(result.storyboard.settings.globalConsistencyRefs[0].name).toBe('주인공')

      // 각 프레임에 일관성 참조가 적용되어야 함
      result.storyboard.frames.forEach((frame: any) => {
        expect(frame.consistencyRefs).toHaveLength(1)
        expect(frame.consistencyRefs[0].id).toBe('char-ref-001')

        // 프롬프트에 일관성 키워드가 포함되어야 함
        const enhancedPrompt = frame.prompt.enhancedPrompt.toLowerCase()
        expect(enhancedPrompt).toContain('long black hair')
        expect(enhancedPrompt).toContain('young woman')
      })
    })

    it('오류 복구 워크플로우가 올바르게 동작해야 함', async () => {
      // Given: 일부 실패를 시뮬레이션하는 핸들러
      let failCount = 0
      server.use(
        http.post('/api/ai/generate-image', async ({ request }) => {
          const body = await request.json()

          // 첫 번째 요청은 실패, 재시도는 성공
          if (body.prompt.includes('scene-002') && failCount === 0) {
            failCount++
            return HttpResponse.json(
              {
                error: {
                  code: 'TEMPORARY_FAILURE',
                  message: '일시적 생성 실패'
                }
              },
              { status: 500 }
            )
          }

          return HttpResponse.json({
            success: true,
            data: {
              imageUrl: `https://example.com/generated/${Date.now()}.jpg`,
              processingTime: 15,
              cost: 0.04
            }
          })
        })
      )

      const storyboardData: StoryboardCreateInput = {
        scenarioId: 'scenario-recovery-001',
        title: '오류 복구 테스트',
        userId: 'user-test-001'
      }

      const frameRequests: FrameGenerationRequest[] = [
        {
          sceneId: 'scene-001',
          sceneDescription: '정상 처리될 프레임',
          priority: 'normal'
        },
        {
          sceneId: 'scene-002',
          sceneDescription: '실패 후 재시도할 프레임',
          priority: 'normal'
        }
      ]

      // When: 오류 복구 워크플로우 실행
      const result = await IntegrationTestHelper.executeCompleteWorkflow(
        storyboardData,
        frameRequests
      )

      // Then: 재시도를 통해 모든 프레임이 성공해야 함
      expect(result.storyboard.frames).toHaveLength(2)

      const failedFrame = result.storyboard.frames.find(
        (frame: any) => frame.metadata.sceneId === 'scene-002'
      )
      expect(failedFrame.metadata.status).toBe('completed')
      expect(failedFrame.attempts.length).toBeGreaterThan(1) // 재시도 기록
      expect(failedFrame.result).toBeDefined()
    })
  })

  describe('Red Phase: 외부 서비스 연동 테스트', () => {
    it('AWS S3 이미지 업로드 연동이 올바르게 동작해야 함', async () => {
      // Given: S3 업로드 모킹
      server.use(
        http.post('https://test-bucket.s3.amazonaws.com/', () => {
          return HttpResponse.json({}, { status: 204 })
        })
      )

      const uploadRequest = {
        imageUrl: 'https://example.com/temp-image.jpg',
        folder: 'storyboards/storyboard-test-001',
        fileName: 'frame-001.jpg',
        metadata: {
          storyboardId: 'storyboard-test-001',
          frameId: 'frame-test-001',
          generatedAt: new Date().toISOString()
        }
      }

      // When: S3 업로드 API 호출
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadRequest)
      })

      // Then: 업로드 성공 및 CDN URL 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('cdnUrl')
      expect(result.data).toHaveProperty('s3Key')
      expect(result.data).toHaveProperty('metadata')
      expect(result.data.cdnUrl).toContain('cloudfront.net')
    })

    it('Webhooks 알림이 올바르게 전송되어야 함', async () => {
      // Given: Webhook 엔드포인트 모킹
      const webhookCalls: any[] = []
      server.use(
        http.post('https://client-webhook.example.com/storyboard-complete', async ({ request }) => {
          const body = await request.json()
          webhookCalls.push(body)
          return HttpResponse.json({ received: true })
        })
      )

      const webhookConfig = {
        storyboardId: 'storyboard-test-001',
        webhookUrl: 'https://client-webhook.example.com/storyboard-complete',
        events: ['batch_completed', 'frame_failed', 'storyboard_completed']
      }

      // When: Webhook 설정 및 이벤트 트리거
      const configResponse = await fetch('/api/webhooks/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookConfig)
      })

      expect(configResponse.ok).toBe(true)

      // 배치 완료 이벤트 시뮬레이션
      const eventResponse = await fetch('/api/webhooks/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'batch_completed',
          storyboardId: 'storyboard-test-001',
          data: {
            batchId: 'batch-001',
            completedFrames: 3,
            totalFrames: 3,
            totalCost: 0.12
          }
        })
      })

      expect(eventResponse.ok).toBe(true)

      // Then: Webhook이 올바르게 호출되어야 함
      await new Promise(resolve => setTimeout(resolve, 1000)) // 비동기 처리 대기

      expect(webhookCalls).toHaveLength(1)
      expect(webhookCalls[0]).toHaveProperty('event', 'batch_completed')
      expect(webhookCalls[0]).toHaveProperty('storyboardId', 'storyboard-test-001')
      expect(webhookCalls[0].data).toHaveProperty('completedFrames', 3)
    })

    it('Analytics 데이터 수집이 올바르게 동작해야 함', async () => {
      // Given: Analytics 이벤트 수집 설정
      const analyticsEvents: any[] = []
      server.use(
        http.post('/api/analytics/events', async ({ request }) => {
          const body = await request.json()
          analyticsEvents.push(body)
          return HttpResponse.json({ recorded: true })
        })
      )

      // When: 스토리보드 생성 및 분석 이벤트 생성
      const storyboardData: StoryboardCreateInput = {
        scenarioId: 'scenario-analytics-001',
        title: 'Analytics 테스트',
        userId: 'user-analytics-001'
      }

      const createResponse = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyboardData)
      })

      expect(createResponse.ok).toBe(true)

      // Then: Analytics 이벤트가 수집되어야 함
      await new Promise(resolve => setTimeout(resolve, 500)) // 비동기 처리 대기

      const creationEvent = analyticsEvents.find(event =>
        event.eventType === 'storyboard_created'
      )

      expect(creationEvent).toBeDefined()
      expect(creationEvent).toHaveProperty('userId', 'user-analytics-001')
      expect(creationEvent).toHaveProperty('metadata')
      expect(creationEvent.metadata).toHaveProperty('scenarioId', 'scenario-analytics-001')
      expect(creationEvent.metadata).toHaveProperty('timestamp')
    })
  })

  describe('Red Phase: 에러 시나리오 및 복구', () => {
    it('네트워크 타임아웃 시 적절한 복구가 동작해야 함', async () => {
      // Given: 타임아웃을 시뮬레이션하는 핸들러
      server.use(
        http.post('/api/ai/generate-image', async () => {
          // 30초 지연 (타임아웃 유발)
          await new Promise(resolve => setTimeout(resolve, 30000))
          return HttpResponse.json({ success: true })
        })
      )

      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-timeout-001',
        sceneDescription: '타임아웃 테스트 프레임',
        priority: 'normal'
      }

      // When: 타임아웃이 발생하는 프레임 생성
      const response = await fetch('/api/storyboard/generate/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frameRequest)
      })

      // Then: 타임아웃 처리 및 재시도 큐 등록
      if (response.status === 408) {
        const result = await response.json()
        expect(result.error.code).toBe('REQUEST_TIMEOUT')
        expect(result.error.recovery).toHaveProperty('retryId')
        expect(result.error.recovery).toHaveProperty('estimatedRetryTime')
      } else {
        // 또는 자동으로 재시도 큐에 등록됨
        expect(response.ok).toBe(true)
        const result = await response.json()
        expect(result.data.metadata.status).toBe('queued')
      }
    })

    it('서비스 점검 시 graceful degradation이 동작해야 함', async () => {
      // Given: 서비스 점검 상태 시뮬레이션
      server.use(
        http.post('/api/ai/generate-image', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'SERVICE_MAINTENANCE',
                message: '서비스 점검 중입니다',
                maintenanceWindow: {
                  start: new Date().toISOString(),
                  end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                }
              }
            },
            { status: 503 }
          )
        })
      )

      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-maintenance-001',
        sceneDescription: '점검 중 테스트 프레임',
        priority: 'normal'
      }

      // When: 점검 중 프레임 생성 시도
      const response = await fetch('/api/storyboard/generate/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frameRequest)
      })

      // Then: 점검 정보와 함께 큐 등록 안내
      expect(response.status).toBe(503)

      const result = await response.json()
      expect(result.error.code).toBe('SERVICE_MAINTENANCE')
      expect(result.error.alternatives).toContain('queue_for_later')
      expect(result.error.maintenanceWindow).toBeDefined()
      expect(result.error.estimatedAvailability).toBeDefined()
    })
  })
})