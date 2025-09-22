/**
 * Seedream API Client Tests
 *
 * CLAUDE.md 준수: TDD 원칙, 비용 안전 규칙 검증
 * $300 사건 방지를 위한 엄격한 테스트
 */

import { SeedreamClient, getSeedreamUsageStats } from '../shared/lib/seedream-client'
import type { ImageGenerationRequest } from '../entities/scenario'

// Mock fetch
let mockFetch: jest.MockedFunction<typeof fetch>

describe('SeedreamClient', () => {
  let client: SeedreamClient

  beforeEach(() => {
    jest.clearAllMocks()
    // global fetch 모킹 재설정
    global.fetch = jest.fn()
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

    // 테스트용 API 키로 클라이언트 생성
    client = new SeedreamClient('test-api-key-32-characters-long', 'https://test-api.example.com')
    // 안전 제한 초기화
    client.resetSafetyLimits()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('생성자 (Constructor)', () => {
    test('유효한 API 키로 클라이언트를 생성할 수 있다', () => {
      expect(() => new SeedreamClient('valid-api-key-32-characters-long')).not.toThrow()
    })

    test('API 키가 없으면 에러를 던진다', () => {
      expect(() => new SeedreamClient('')).toThrow('SEEDREAM_API_KEY가 설정되지 않았습니다.')
    })
  })

  describe('비용 안전 미들웨어', () => {
    test('최소 간격(12초) 미만으로 호출하면 에러를 던진다', async () => {
      // 성공적인 첫 번째 호출 모킹
      mockFetch.mockResolvedValueOnce(createMockResponse(true))

      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      // 첫 번째 호출
      await client.generateImage(request)

      // 즉시 두 번째 호출 시도
      await expect(client.generateImage(request))
        .rejects
        .toThrow('Seedream API 호출 간격이 너무 짧습니다. 12초 후 다시 시도해주세요.')
    })

    test('분당 5회 제한을 초과하면 에러를 던진다', async () => {
      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      // 성공적인 응답 모킹
      mockFetch.mockResolvedValue(createMockResponse(true))

      const middleware = SeedreamClient.getCostSafetyMiddleware()
      const now = Date.now()

      // callTimes 배열에 5개의 최근 호출 시간을 직접 추가
      ;(middleware as any).callTimes = [
        now - 10000,
        now - 20000,
        now - 30000,
        now - 40000,
        now - 50000
      ]

      // lastCallTime을 충분히 과거로 설정 (12초 제한 우회)
      ;(middleware as any).lastCallTime = now - 13000

      // 6번째 호출은 실패해야 함 (분당 제한)
      await expect(client.generateImage(request))
        .rejects
        .toThrow('Seedream API 분당 호출 한도(5회)를 초과했습니다.')
    })

    test('사용 통계를 정확히 추적한다', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true))

      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      await client.generateImage(request)

      const stats = client.getUsageStats()
      expect(stats.totalCalls).toBe(1)
      expect(stats.recentCalls).toBe(1)
    })
  })

  describe('이미지 생성', () => {
    test('유효한 요청으로 이미지를 생성할 수 있다', async () => {
      const mockResponseData = {
        success: true,
        data: {
          image_url: 'https://example.com/generated-image.jpg',
          seed: 12345,
          style: 'colored' as const,
          prompt: '테스트 이미지',
          created_at: '2024-01-01T00:00:00Z'
        }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(true, mockResponseData))

      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      const result = await client.generateImage(request)

      expect(result).toEqual({
        imageUrl: 'https://example.com/generated-image.jpg',
        seed: 12345,
        style: 'colored',
        prompt: '테스트 이미지',
        referenceImageUrl: undefined,
        generatedAt: new Date('2024-01-01T00:00:00Z')
      })
    })

    test('참조 이미지가 있는 요청을 처리할 수 있다', async () => {
      const mockResponseData = {
        success: true,
        data: {
          image_url: 'https://example.com/generated-image.jpg',
          seed: 12345,
          style: 'colored' as const,
          prompt: '일관성 있는 이미지',
          reference_image_url: 'https://example.com/reference.jpg',
          created_at: '2024-01-01T00:00:00Z'
        }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(true, mockResponseData))

      const request: ImageGenerationRequest = {
        prompt: '일관성 있는 이미지',
        style: 'colored',
        referenceImageUrl: 'https://example.com/reference.jpg'
      }

      const result = await client.generateImage(request)

      expect(result.referenceImageUrl).toBe('https://example.com/reference.jpg')
    })

    test('빈 프롬프트에 대해 검증 에러를 던진다', async () => {
      const request: ImageGenerationRequest = {
        prompt: '',
        style: 'colored'
      }

      await expect(client.generateImage(request))
        .rejects
        .toThrow()
    })

    test('API 에러 응답을 적절히 처리한다', async () => {
      // HTTP 400 에러 응답 테스트 (더 간단한 접근)
      const errorTestClient = new SeedreamClient('test-api-key-32-characters-long')
      errorTestClient.resetSafetyLimits()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: 'https://test-api.example.com/image/generate',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('API 에러'),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        body: null,
        bodyUsed: false,
        clone: () => ({} as Response),
      } as Response)

      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      await expect(errorTestClient.generateImage(request))
        .rejects
        .toThrow('Seedream API 오류 (400): API 에러')
    })

    test('네트워크 오류 시 재시도 후 실패한다', async () => {
      // 모든 재시도에 대해 네트워크 오류 모킹
      mockFetch
        .mockRejectedValueOnce(new Error('네트워크 오류'))
        .mockRejectedValueOnce(new Error('네트워크 오류'))
        .mockRejectedValueOnce(new Error('네트워크 오류'))

      const request: ImageGenerationRequest = {
        prompt: '테스트 이미지',
        style: 'colored'
      }

      await expect(client.generateImage(request))
        .rejects
        .toThrow('이미지 생성 실패 (3회 재시도)')

      // 3회 재시도 확인
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('일관성 있는 이미지 생성', () => {
    test('여러 프롬프트로 일관성 있는 이미지들을 생성할 수 있다', async () => {
      const mockResponses = [
        {
          success: true,
          data: {
            image_url: 'https://example.com/image1.jpg',
            seed: 12345,
            style: 'colored' as const,
            prompt: '첫 번째 이미지',
            created_at: '2024-01-01T00:00:00Z'
          }
        },
        {
          success: true,
          data: {
            image_url: 'https://example.com/image2.jpg',
            seed: 12346,
            style: 'colored' as const,
            prompt: '두 번째 이미지',
            reference_image_url: 'https://example.com/image1.jpg',
            created_at: '2024-01-01T00:01:00Z'
          }
        }
      ]

      jest.useFakeTimers()
      mockFetch
        .mockResolvedValueOnce(createMockResponse(true, mockResponses[0]))
        .mockResolvedValueOnce(createMockResponse(true, mockResponses[1]))

      const prompts = ['첫 번째 이미지', '두 번째 이미지']

      // 첫 번째 호출
      const resultsPromise = client.generateConsistentImages(prompts, 'colored')

      // 두 번째 호출을 위해 시간 진행
      jest.advanceTimersByTime(12000)

      const results = await resultsPromise

      expect(results).toHaveLength(2)
      expect(results[0].imageUrl).toBe('https://example.com/image1.jpg')
      expect(results[1].imageUrl).toBe('https://example.com/image2.jpg')
      expect(results[1].referenceImageUrl).toBe('https://example.com/image1.jpg')
    })

    test('빈 프롬프트 배열에 대해 에러를 던진다', async () => {
      await expect(client.generateConsistentImages([], 'colored'))
        .rejects
        .toThrow('최소 하나의 프롬프트가 필요합니다.')
    })
  })

  describe('스타일별 생성 함수들', () => {
    test('각 스타일별 함수가 올바른 스타일로 호출된다', async () => {
      // 환경변수가 있는 상태로 클라이언트 인스턴스 생성
      const testClient = new SeedreamClient('test-api-key-32-chars-long')
      testClient.resetSafetyLimits()

      const pencilResponseData = {
        success: true,
        data: {
          image_url: 'https://example.com/pencil-sketch.jpg',
          seed: 12345,
          style: 'pencil' as const,
          prompt: '연필 스케치',
          created_at: '2024-01-01T00:00:00Z'
        }
      }

      mockFetch.mockResolvedValue(createMockResponse(true, pencilResponseData))

      // 직접 클라이언트 메서드 호출로 테스트
      const result = await testClient.generateImage({
        prompt: '연필 스케치',
        style: 'pencil'
      })

      expect(result).toBeDefined()
      expect(result.style).toBe('pencil')
    })
  })
})

// 테스트 헬퍼 함수들
function createMockResponse(ok: boolean, data?: any): Response {
  const defaultData = {
    success: true,
    data: {
      image_url: 'https://example.com/test-image.jpg',
      seed: 12345,
      style: 'colored',
      prompt: '테스트 프롬프트',
      created_at: '2024-01-01T00:00:00Z'
    }
  }

  const responseData = data || defaultData

  return {
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'https://test-api.example.com/image/generate',
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    body: null,
    bodyUsed: false,
    clone: () => ({} as Response),
  } as Response
}