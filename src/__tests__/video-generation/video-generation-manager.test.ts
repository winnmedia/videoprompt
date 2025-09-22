/**
 * Video Generation Manager Tests
 *
 * 영상 생성 매니저의 TDD 테스트 케이스
 * CLAUDE.md 준수: TDD 원칙, Red-Green-Refactor, 비용 안전 규칙
 */

import { VideoGenerationManager } from '../../shared/lib/video-generation/video-generation-manager'
import {
  VideoGenerationError,
  CostSafetyError,
  QuotaExceededError,
  type VideoGenerationRequest,
  type VideoGenerationResponse
} from '../../shared/lib/video-generation/types'

// Mock fetch globally
global.fetch = jest.fn()

describe('VideoGenerationManager', () => {
  let manager: VideoGenerationManager
  const mockFetch = fetch as MockedFunction<typeof fetch>

  const validRequest: VideoGenerationRequest = {
    prompt: '아름다운 바다 풍경',
    imageUrl: 'https://example.com/image.jpg',
    duration: 5,
    quality: 'medium',
    style: 'realistic',
    aspectRatio: '16:9',
    fps: 24,
    motionLevel: 0.5
  }

  const mockSuccessResponse: VideoGenerationResponse = {
    id: 'test-job-123',
    status: 'completed',
    videoUrl: 'https://example.com/video.mp4',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    duration: 5,
    quality: 'medium',
    style: 'realistic',
    aspectRatio: '16:9',
    fps: 24,
    seed: 12345,
    prompt: '아름다운 바다 풍경',
    imageUrl: 'https://example.com/image.jpg',
    progress: 100,
    estimatedCompletionTime: 0,
    error: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
    provider: 'seedance',
    externalJobId: 'external-123',
    cost: 0.03
  }

  beforeEach(() => {
    // 각 테스트 전에 새로운 매니저 인스턴스 생성
    manager = new VideoGenerationManager({
      loadBalancingStrategy: 'cost-optimized',
      enableFailover: true,
      maxRetries: 2
    })

    // 비용 안전 제한 리셋 (테스트 간 독립성 보장)
    manager.resetAllSafetyLimits()

    // Mock fetch 리셋
    mockFetch.mockReset()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('초기화 및 설정', () => {
    it('기본 설정으로 매니저가 초기화되어야 한다', () => {
      const defaultManager = new VideoGenerationManager()
      const providerInfo = defaultManager.getProviderInfo()

      expect(providerInfo.length).toBeGreaterThan(0)
      expect(providerInfo.some(p => p.provider === 'seedance')).toBe(true)
      expect(providerInfo.some(p => p.provider === 'runway')).toBe(true)
      expect(providerInfo.some(p => p.provider === 'stable-video')).toBe(true)
    })

    it('커스텀 설정으로 매니저가 초기화되어야 한다', () => {
      const customManager = new VideoGenerationManager({
        loadBalancingStrategy: 'quality-first',
        enableFailover: false,
        maxRetries: 5
      })

      expect(customManager).toBeDefined()
    })

    it('제공업체를 활성화/비활성화할 수 있어야 한다', () => {
      manager.setProviderEnabled('runway', false)
      const providerInfo = manager.getProviderInfo()
      const runwayInfo = providerInfo.find(p => p.provider === 'runway')

      expect(runwayInfo?.enabled).toBe(false)
    })

    it('로드 밸런싱 전략을 변경할 수 있어야 한다', () => {
      manager.setLoadBalancingStrategy('speed-first')
      // 내부 상태는 private이므로 동작 확인은 실제 생성 호출로 테스트
      expect(manager).toBeDefined()
    })
  })

  describe('영상 생성 - 자동 제공업체 선택', () => {
    it('유효한 요청으로 영상을 생성할 수 있어야 한다', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          job_id: 'test-job-123',
          status: 'completed',
          video_url: 'https://example.com/video.mp4',
          thumbnail_url: 'https://example.com/thumbnail.jpg',
          duration: 5,
          progress: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          input_image_url: 'https://example.com/image.jpg',
          input_prompt: '아름다운 바다 풍경',
          cost: 0.03
        })
      } as Response)

      const result = await manager.generateVideo(validRequest)

      expect(result).toBeDefined()
      expect(result.status).toBe('completed')
      expect(result.videoUrl).toBe('https://example.com/video.mp4')
      expect(result.provider).toBe('seedance') // 비용 최적화 전략에서 seedance가 선택됨
    })

    it('이미지가 없는 요청은 textToVideo를 지원하는 제공업체를 선택해야 한다', async () => {
      const textOnlyRequest: VideoGenerationRequest = {
        ...validRequest,
        imageUrl: undefined
      }

      // Mock successful response for Runway (textToVideo 지원)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'runway-job-123',
          status: 'completed',
          video_url: 'https://example.com/runway-video.mp4',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      } as Response)

      const result = await manager.generateVideo(textOnlyRequest)

      expect(result).toBeDefined()
      expect(result.provider).toBe('runway') // Runway만 textToVideo 지원
    })

    it('긴 영상 요청은 긴 길이를 지원하는 제공업체를 선택해야 한다', async () => {
      const longVideoRequest: VideoGenerationRequest = {
        ...validRequest,
        duration: 25 // 25초 - Seedance만 지원
      }

      // Mock successful response for Seedance
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          job_id: 'seedance-long-123',
          status: 'completed',
          video_url: 'https://example.com/long-video.mp4',
          duration: 25,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      } as Response)

      const result = await manager.generateVideo(longVideoRequest)

      expect(result).toBeDefined()
      expect(result.provider).toBe('seedance') // Seedance가 30초까지 지원
    })

    it('사용 가능한 제공업체가 없으면 오류를 던져야 한다', async () => {
      // 모든 제공업체 비활성화
      manager.setProviderEnabled('runway', false)
      manager.setProviderEnabled('seedance', false)
      manager.setProviderEnabled('stable-video', false)

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow('사용 가능한 영상 생성 제공업체가 없습니다.')
    })
  })

  describe('특정 제공업체로 영상 생성', () => {
    it('Seedance로 영상을 생성할 수 있어야 한다', async () => {
      // Mock successful Seedance response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          job_id: 'seedance-123',
          status: 'completed',
          video_url: 'https://example.com/seedance-video.mp4',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } as Response)

      const result = await manager.generateVideoWithProvider('seedance', validRequest)

      expect(result).toBeDefined()
      expect(result.provider).toBe('seedance')
    })

    it('존재하지 않는 제공업체로 요청하면 오류를 던져야 한다', async () => {
      await expect(manager.generateVideoWithProvider('nonexistent' as any, validRequest))
        .rejects
        .toThrow('nonexistent 클라이언트가 초기화되지 않았습니다.')
    })
  })

  describe('비용 안전 규칙', () => {
    it('비용 한도 초과 시 CostSafetyError를 던져야 한다', async () => {
      // 비용 안전 오류를 시뮬레이션하는 Mock
      mockFetch.mockRejectedValueOnce(
        new CostSafetyError('일일 비용 한도 초과', 'seedance')
      )

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow(CostSafetyError)
    })

    it('할당량 초과 시 다른 제공업체로 fallover해야 한다', async () => {
      // 첫 번째 제공업체(Seedance)는 할당량 초과로 실패
      mockFetch
        .mockRejectedValueOnce(new QuotaExceededError('할당량 초과', 'seedance'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'runway-fallback-123',
            status: 'completed',
            video_url: 'https://example.com/fallback-video.mp4',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        } as Response)

      const result = await manager.generateVideo(validRequest)

      expect(result).toBeDefined()
      expect(result.provider).toBe('runway') // Fallback to Runway
    })

    it('모든 제공업체가 실패하면 적절한 오류 메시지를 제공해야 한다', async () => {
      // 모든 호출이 실패하도록 Mock
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow('모든 영상 생성 제공업체 실패')
    })
  })

  describe('작업 상태 관리', () => {
    it('작업 상태를 확인할 수 있어야 한다', async () => {
      // Mock status check response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          job_id: 'test-job-123',
          status: 'processing',
          progress: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } as Response)

      const status = await manager.checkStatus('seedance', 'test-job-123')

      expect(status).toBeDefined()
      expect(status.status).toBe('processing')
      expect(status.progress).toBe(50)
    })

    it('작업을 취소할 수 있어야 한다', async () => {
      // Mock cancel response
      mockFetch.mockResolvedValueOnce({
        ok: true
      } as Response)

      const cancelled = await manager.cancelJob('seedance', 'test-job-123')

      expect(cancelled).toBe(true)
    })

    it('존재하지 않는 작업 상태 확인 시 오류를 던져야 한다', async () => {
      await expect(manager.checkStatus('nonexistent' as any, 'job-123'))
        .rejects
        .toThrow('nonexistent 클라이언트가 초기화되지 않았습니다.')
    })
  })

  describe('사용량 통계 및 상태', () => {
    it('모든 제공업체의 사용량 통계를 조회할 수 있어야 한다', () => {
      const stats = manager.getAllUsageStats()

      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('runway')
      expect(stats).toHaveProperty('seedance')
      expect(stats).toHaveProperty('stable-video')
    })

    it('제공업체 상태를 확인할 수 있어야 한다', async () => {
      // Mock health check responses
      mockFetch
        .mockResolvedValueOnce({ ok: true } as Response) // runway
        .mockResolvedValueOnce({ ok: true } as Response) // seedance
        .mockResolvedValueOnce({ ok: false } as Response) // stable-video

      const healthStatus = await manager.getProviderHealthStatus()

      expect(healthStatus).toBeDefined()
      expect(healthStatus.runway).toBe(true)
      expect(healthStatus.seedance).toBe(true)
      expect(healthStatus['stable-video']).toBe(false)
    })

    it('제공업체 정보를 조회할 수 있어야 한다', () => {
      const providerInfo = manager.getProviderInfo()

      expect(providerInfo).toBeDefined()
      expect(providerInfo.length).toBeGreaterThan(0)
      expect(providerInfo[0]).toHaveProperty('provider')
      expect(providerInfo[0]).toHaveProperty('enabled')
      expect(providerInfo[0]).toHaveProperty('weight')
      expect(providerInfo[0]).toHaveProperty('features')
      expect(providerInfo[0]).toHaveProperty('isAvailable')
    })
  })

  describe('입력 검증', () => {
    it('잘못된 요청 형식은 검증 오류를 던져야 한다', async () => {
      const invalidRequest = {
        prompt: '', // 빈 프롬프트
        duration: -1, // 음수 길이
        quality: 'invalid' // 잘못된 품질
      } as any

      await expect(manager.generateVideo(invalidRequest))
        .rejects
        .toThrow()
    })

    it('지원하지 않는 화면 비율은 호환되는 제공업체가 없어야 한다', async () => {
      const unsupportedRequest: VideoGenerationRequest = {
        ...validRequest,
        aspectRatio: '21:9' as any // 지원하지 않는 비율
      }

      await expect(manager.generateVideo(unsupportedRequest))
        .rejects
        .toThrow('사용 가능한 영상 생성 제공업체가 없습니다.')
    })

    it('너무 긴 영상 요청은 적절히 처리되어야 한다', async () => {
      const tooLongRequest: VideoGenerationRequest = {
        ...validRequest,
        duration: 100 // 100초 - 모든 제공업체 한계 초과
      }

      await expect(manager.generateVideo(tooLongRequest))
        .rejects
        .toThrow('사용 가능한 영상 생성 제공업체가 없습니다.')
    })
  })

  describe('재시도 로직', () => {
    it('일시적 네트워크 오류는 재시도해야 한다', async () => {
      // 첫 번째 호출은 실패, 두 번째 호출은 성공
      mockFetch
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            job_id: 'retry-success-123',
            status: 'completed',
            video_url: 'https://example.com/retry-video.mp4',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        } as Response)

      const result = await manager.generateVideo(validRequest)

      expect(result).toBeDefined()
      expect(result.id).toBe('retry-success-123')
      expect(mockFetch).toHaveBeenCalledTimes(2) // 재시도 확인
    })

    it('영구적 오류는 재시도하지 않아야 한다', async () => {
      // 인증 오류 (재시도 불가)
      mockFetch.mockRejectedValue(
        new VideoGenerationError('Invalid API key', 'AUTH_ERROR', 'seedance', false)
      )

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow('Invalid API key')

      // 재시도 불가능한 오류이므로 1번만 호출되어야 함
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('에지 케이스', () => {
    it('빈 응답을 적절히 처리해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow()
    })

    it('잘못된 JSON 응답을 처리해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow()
    })

    it('HTTP 오류 상태를 적절히 처리해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      } as Response)

      await expect(manager.generateVideo(validRequest))
        .rejects
        .toThrow('API 오류 (500)')
    })
  })
})