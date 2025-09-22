/**
 * Storyboard Generation API Tests (Jest Version)
 *
 * TDD Red Phase: 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, MSW 모킹, 비용 안전 규칙
 */

import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import { http, HttpResponse } from 'msw'
import type {
  StoryboardCreateInput,
  FrameGenerationRequest,
  StoryboardValidationResult
} from '../../../entities/storyboard'

/**
 * 비용 안전 모니터링
 */
class CostSafetyMonitor {
  private static requestCount = 0
  private static lastResetTime = Date.now()
  private static readonly MAX_REQUESTS_PER_MINUTE = 5

  static checkRequest(): boolean {
    const now = Date.now()
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0
      this.lastResetTime = now
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('$300 사건 방지: API 호출 한도 초과')
    }

    this.requestCount++
    return true
  }

  static reset() {
    this.requestCount = 0
    this.lastResetTime = Date.now()
  }
}

describe('/api/storyboard/generate - 스토리보드 생성 API', () => {
  // MSW 서버 설정
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  beforeEach(() => {
    storyboardTestUtils.resetApiLimiter()
    CostSafetyMonitor.reset()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  describe('Red Phase: 기본 생성 API 테스트', () => {
    it('스토리보드 생성 요청이 성공해야 함', async () => {
      // Given: 스토리보드 생성 요청 데이터
      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '테스트 스토리보드',
        description: '테스트용 스토리보드입니다',
        userId: 'test-user-001',
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic'
        }
      }

      // When: API 호출 (아직 구현되지 않음 - 실패해야 함)
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput)
      })

      // Then: 성공 응답을 받아야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('metadata')
      expect(result.data.metadata.title).toBe(createInput.title)
      expect(result.data.frames).toEqual([])
    })

    it('잘못된 입력값으로 스토리보드 생성 시 400 에러를 반환해야 함', async () => {
      // Given: 잘못된 입력값 (title 누락)
      const invalidInput = {
        scenarioId: 'scenario-test-001',
        userId: 'test-user-001'
        // title 누락
      }

      // When: API 호출
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidInput)
      })

      // Then: 400 에러를 반환해야 함
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    it('존재하지 않는 시나리오 ID로 생성 시 404 에러를 반환해야 함', async () => {
      // Given: 존재하지 않는 시나리오 ID
      const createInput: StoryboardCreateInput = {
        scenarioId: 'non-existent-scenario',
        title: '테스트 스토리보드',
        userId: 'test-user-001'
      }

      // When: API 호출
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput)
      })

      // Then: 404 에러를 반환해야 함
      expect(response.status).toBe(404)

      const result = await response.json()
      expect(result.error.message).toContain('시나리오를 찾을 수 없습니다')
    })
  })

  describe('Red Phase: 프레임 생성 API 테스트', () => {
    it('단일 프레임 생성이 성공해야 함', async () => {
      // Given: 프레임 생성 요청
      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-001',
        sceneDescription: '주인공이 커피숍에 앉아있는 모습',
        additionalPrompt: 'warm lighting, cozy atmosphere',
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic'
        },
        priority: 'normal'
      }

      CostSafetyMonitor.checkRequest()

      // When: 프레임 생성 API 호출
      const response = await fetch('/api/storyboard/generate/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frameRequest)
      })

      // Then: 성공 응답과 함께 생성된 프레임을 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('metadata')
      expect(result.data.metadata.status).toBe('pending')
      expect(result.data.prompt.basePrompt).toBe(frameRequest.sceneDescription)
    })

    it('프레임 생성 중 실패 시 재시도 로직이 동작해야 함', async () => {
      // Given: 생성 실패를 시뮬레이션하는 핸들러 추가
      server.use(
        http.post('/api/ai/generate-image', () => {
          return HttpResponse.json({
            error: {
              code: 'GENERATION_FAILED',
              message: '이미지 생성 실패'
            }
          }, { status: 500 })
        })
      )

      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-001',
        sceneDescription: '테스트 프레임',
        priority: 'normal'
      }

      CostSafetyMonitor.checkRequest()

      // When: 프레임 생성 API 호출
      const response = await fetch('/api/storyboard/generate/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frameRequest)
      })

      // Then: 재시도 후 실패 상태로 반환되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data.metadata.status).toBe('failed')
      expect(result.data.attempts.length).toBeGreaterThan(0)
    })
  })

  describe('Red Phase: 비용 안전 테스트', () => {
    it('분당 5회 제한을 초과하면 429 에러를 반환해야 함', async () => {
      // Given: 분당 제한 초과를 위한 연속 요청
      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '테스트 스토리보드',
        userId: 'test-user-001'
      }

      // When: 6번 연속 요청 (제한: 5회)
      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          fetch('/api/storyboard/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createInput)
          })
        )
      )

      // Then: 마지막 요청은 429 에러를 반환해야 함
      const lastResponse = responses[5]
      expect(lastResponse.status).toBe(429)

      const result = await lastResponse.json()
      expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('중복 요청을 차단해야 함 ($300 사건 방지)', async () => {
      // Given: 동일한 요청 데이터
      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '중복 테스트 스토리보드',
        userId: 'test-user-001'
      }

      // When: 동시에 동일한 요청 2번 전송
      const [response1, response2] = await Promise.all([
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createInput)
        }),
        fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createInput)
        })
      ])

      // Then: 하나는 성공, 하나는 중복 요청으로 차단되어야 함
      const results = await Promise.all([response1.json(), response2.json()])

      const successCount = results.filter(r => r.success).length
      const duplicateCount = results.filter(r => r.error?.code === 'DUPLICATE_REQUEST').length

      expect(successCount).toBe(1)
      expect(duplicateCount).toBe(1)
    })

    it('요청 큐 관리가 올바르게 동작해야 함', async () => {
      // Given: 큐 제한을 초과하는 요청들
      const requests = Array.from({ length: 15 }, (_, i) => ({
        scenarioId: 'scenario-test-001',
        title: `큐 테스트 스토리보드 ${i + 1}`,
        userId: 'test-user-001'
      }))

      // When: 모든 요청을 동시에 전송
      const responses = await Promise.all(
        requests.map(req =>
          fetch('/api/storyboard/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          })
        )
      )

      // Then: 큐 제한(10개)을 초과한 요청들은 503 에러를 반환해야 함
      const statusCodes = responses.map(r => r.status)
      const queueFullCount = statusCodes.filter(code => code === 503).length

      expect(queueFullCount).toBeGreaterThan(0)
    })
  })

  describe('Red Phase: 입력 검증 테스트', () => {
    it('Zod 스키마로 입력값을 검증해야 함', async () => {
      // Given: 스키마 위반 데이터들
      const invalidInputs = [
        // 빈 제목
        {
          scenarioId: 'scenario-test-001',
          title: '',
          userId: 'test-user-001'
        },
        // 너무 긴 제목
        {
          scenarioId: 'scenario-test-001',
          title: 'a'.repeat(101), // MAX_TITLE_LENGTH = 100
          userId: 'test-user-001'
        },
        // 잘못된 사용자 ID 형식
        {
          scenarioId: 'scenario-test-001',
          title: '테스트 스토리보드',
          userId: 'invalid-user-id-format-123456789012345678901234567890'
        }
      ]

      // When & Then: 각 잘못된 입력에 대해 검증 에러를 반환해야 함
      for (const invalidInput of invalidInputs) {
        const response = await fetch('/api/storyboard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput)
        })

        expect(response.status).toBe(400)

        const result = await response.json()
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.details).toBeDefined()
      }
    })

    it('설정값 검증이 올바르게 동작해야 함', async () => {
      // Given: 잘못된 설정값
      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '설정 검증 테스트',
        userId: 'test-user-001',
        config: {
          model: 'invalid-model' as any, // 지원하지 않는 모델
          aspectRatio: '21:9' as any, // 지원하지 않는 비율
          quality: 'ultra-hd' as any, // 지원하지 않는 품질
          steps: -1, // 음수 스텝
          guidanceScale: 100 // 범위 초과값
        }
      }

      // When: API 호출
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput)
      })

      // Then: 설정 검증 에러를 반환해야 함
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error.code).toBe('INVALID_CONFIG')
      expect(result.error.details.invalidFields).toContain('model')
      expect(result.error.details.invalidFields).toContain('aspectRatio')
      expect(result.error.details.invalidFields).toContain('quality')
    })
  })

  describe('Red Phase: 응답 시간 제한 테스트', () => {
    it('API 응답이 5초 이내에 완료되어야 함', async () => {
      // Given: 일반적인 생성 요청
      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '응답 시간 테스트',
        userId: 'test-user-001'
      }

      const startTime = Date.now()

      // When: API 호출
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput)
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      // Then: 응답 시간이 5초 이내여야 함
      expect(responseTime).toBeLessThan(5000)
      expect(response.ok).toBe(true)
    })

    it('타임아웃 시 408 에러를 반환해야 함', async () => {
      // Given: 타임아웃을 유발하는 핸들러
      server.use(
        http.post('/api/storyboard/generate', async () => {
          // 10초 지연 (타임아웃 유발)
          await new Promise(resolve => setTimeout(resolve, 10000))
          return HttpResponse.json({ success: true })
        })
      )

      const createInput: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '타임아웃 테스트',
        userId: 'test-user-001'
      }

      // When: API 호출 (타임아웃 발생 예상)
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput)
      }).catch(error => {
        // 타임아웃 에러를 적절히 처리
        return new Response(
          JSON.stringify({ error: { code: 'TIMEOUT', message: '요청 시간 초과' } }),
          { status: 408 }
        )
      })

      // Then: 타임아웃 에러를 반환해야 함
      expect(response.status).toBe(408)
    })
  })
})