/**
 * Stability AI Video Generation API Client
 *
 * Stable Video Diffusion을 활용한 영상 생성 클라이언트
 * CLAUDE.md 준수: FSD shared/lib 레이어, 비용 안전 규칙, 타입 안전성
 */

import { z } from 'zod'
import {
  VideoGenerationRequestSchema,
  VideoGenerationResponseSchema,
  type VideoGenerationProvider as IVideoGenerationProvider,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type ProviderConfig,
  type UsageStats,
  VideoGenerationError,
  NetworkError,
  TimeoutError
} from './types'
import { StableVideoCostSafetyMiddleware } from './cost-safety-middleware'

/**
 * Stable Video API 설정
 */
const STABLE_VIDEO_CONFIG = {
  API_URL: process.env.STABLE_VIDEO_API_URL || 'https://api.stability.ai/v2alpha',
  GENERATE_ENDPOINT: '/generation/image-to-video',
  STATUS_ENDPOINT: '/generation',
  TIMEOUT: 120000, // 120초 타임아웃 (Stable Video는 더 오래 걸림)
  MAX_RETRIES: 3,
  POLLING_INTERVAL: 10000, // 10초마다 상태 체크
  MAX_POLLING_TIME: 1800000, // 최대 30분 대기
} as const

/**
 * Stable Video API 요청 스키마
 */
const StableVideoRequestSchema = z.object({
  image: z.string().url('유효한 이미지 URL이 필요합니다'),
  cfg_scale: z.number().min(0).max(10).default(2.5),
  motion_bucket_id: z.number().min(1).max(255).default(40),
  seed: z.number().int().min(0).max(4294967294).optional(),
  steps: z.number().min(10).max(50).default(25),
  fps: z.number().min(6).max(30).default(24),
  duration: z.number().min(1).max(25).default(4), // Stable Video는 최대 25프레임 (약 1초)
})

/**
 * Stable Video API 응답 스키마
 */
const StableVideoResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['in-progress', 'complete', 'failed']),
  video: z.string().url().optional(),
  image: z.string().url().optional(),
  seed: z.number().optional(),
  finish_reason: z.string().optional(),
  errors: z.array(z.string()).optional(),
})

/**
 * Generation Response 스키마
 */
const GenerationResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['in-progress', 'complete', 'failed']),
  created_at: z.string(),
  updated_at: z.string(),
})

/**
 * Stable Video 클라이언트 클래스
 */
export class StableVideoClient implements IVideoGenerationProvider {
  readonly name = 'stable-video' as const
  readonly supportedFeatures = {
    imageToVideo: true,
    textToVideo: false, // Stable Video는 이미지-투-비디오만 지원
    maxDuration: 4, // 약 1초 (25프레임)
    supportedQualities: ['medium', 'high'] as const,
    supportedStyles: ['realistic'] as const, // Stable Video는 주로 realistic
    supportedAspectRatios: ['16:9', '9:16', '1:1'] as const,
  }

  private apiKey: string
  private baseUrl: string
  private costSafety: StableVideoCostSafetyMiddleware

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey || process.env.STABILITY_API_KEY || ''
    this.baseUrl = config?.baseUrl || STABLE_VIDEO_CONFIG.API_URL

    if (!this.apiKey) {
      throw new VideoGenerationError(
        'STABILITY_API_KEY가 설정되지 않았습니다.',
        'MISSING_API_KEY',
        'stable-video'
      )
    }

    this.costSafety = StableVideoCostSafetyMiddleware.getInstance(
      StableVideoCostSafetyMiddleware,
      'stable-video'
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    // 입력 검증
    const validatedRequest = VideoGenerationRequestSchema.parse(request)

    // Stable Video는 이미지가 필수
    if (!validatedRequest.imageUrl) {
      throw new VideoGenerationError(
        'Stable Video는 이미지가 필수입니다. imageUrl을 제공해주세요.',
        'MISSING_IMAGE_URL',
        'stable-video'
      )
    }

    // 짧은 영상만 지원 경고
    if (validatedRequest.duration > 4) {
      console.warn('⚠️ Stable Video는 약 1초 길이의 영상만 생성합니다. duration 값은 무시됩니다.')
    }

    // 비용 추정
    const estimatedCost = this.estimateCost(validatedRequest)

    // 비용 안전 체크 (최우선)
    await this.costSafety.checkSafety(estimatedCost)

    // Stable Video 형식으로 변환
    const stableVideoRequest = this.convertToStableVideoFormat(validatedRequest)
    const validatedStableVideoRequest = StableVideoRequestSchema.parse(stableVideoRequest)

    let lastError: Error | null = null

    // 재시도 로직
    for (let attempt = 1; attempt <= STABLE_VIDEO_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), STABLE_VIDEO_CONFIG.TIMEOUT)

        const response = await fetch(`${this.baseUrl}${STABLE_VIDEO_CONFIG.GENERATE_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'VideoPlanet-StableVideoClient/1.0.0'
          },
          body: JSON.stringify(validatedStableVideoRequest),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new VideoGenerationError(
            `Stable Video API 오류 (${response.status}): ${errorText}`,
            `HTTP_${response.status}`,
            'stable-video',
            response.status >= 500
          )
        }

        const data = await response.json()
        const validatedResponse = StableVideoResponseSchema.parse(data)

        // 실제 비용 업데이트
        this.costSafety.updateActualCost(estimatedCost)

        // 통합 형식으로 변환하여 반환
        return this.convertToStandardFormat(validatedResponse, validatedRequest)

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // AbortError는 타임아웃으로 처리
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError('Stable Video API 요청 타임아웃', 'stable-video')
        }

        // 네트워크 오류는 별도 처리
        if (error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('ECONNRESET')
        )) {
          lastError = new NetworkError(`네트워크 오류: ${error.message}`, 'stable-video')
        }

        // 재시도 가능한 오류이고 마지막 시도가 아니면 재시도
        if (lastError instanceof VideoGenerationError && lastError.retryable &&
            attempt < STABLE_VIDEO_CONFIG.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 지수 백오프 (최대 10초)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        break
      }
    }

    // 모든 재시도 실패
    if (process.env.NODE_ENV !== 'test') {
      console.error('Stable Video API 호출 실패:', lastError)
    }

    throw new VideoGenerationError(
      lastError
        ? `영상 생성 실패 (${STABLE_VIDEO_CONFIG.MAX_RETRIES}회 재시도): ${lastError.message}`
        : '영상 생성 중 알 수 없는 오류가 발생했습니다.',
      'GENERATION_FAILED',
      'stable-video',
      false,
      { originalError: lastError }
    )
  }

  /**
   * 작업 상태 확인
   */
  async checkStatus(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${STABLE_VIDEO_CONFIG.STATUS_ENDPOINT}/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'VideoPlanet-StableVideoClient/1.0.0'
        }
      })

      if (!response.ok) {
        throw new VideoGenerationError(
          `상태 조회 실패: ${response.status}`,
          `HTTP_${response.status}`,
          'stable-video'
        )
      }

      const data = await response.json()
      const validatedResponse = GenerationResponseSchema.parse(data)

      // Generation Response를 Standard Format으로 변환
      return {
        id: validatedResponse.id,
        status: this.mapStableVideoStatus(validatedResponse.status),
        videoUrl: undefined,
        thumbnailUrl: undefined,
        duration: 4,
        quality: 'medium',
        style: 'realistic',
        aspectRatio: '16:9',
        fps: 24,
        seed: undefined,
        prompt: '',
        imageUrl: undefined,
        progress: validatedResponse.status === 'complete' ? 100 :
                 validatedResponse.status === 'failed' ? 0 : 50,
        estimatedCompletionTime: undefined,
        error: validatedResponse.status === 'failed' ? {
          code: 'GENERATION_FAILED',
          message: '영상 생성에 실패했습니다.'
        } : undefined,
        createdAt: new Date(validatedResponse.created_at),
        updatedAt: new Date(validatedResponse.updated_at),
        completedAt: validatedResponse.status === 'complete' ? new Date(validatedResponse.updated_at) : undefined,
        provider: 'stable-video',
        externalJobId: validatedResponse.id,
      }

    } catch (error) {
      throw new VideoGenerationError(
        `상태 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_CHECK_FAILED',
        'stable-video'
      )
    }
  }

  /**
   * 작업 취소 (Stable Video API는 취소 기능을 제공하지 않음)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Stable Video API는 취소 기능을 제공하지 않음
    console.warn('Stable Video API는 작업 취소를 지원하지 않습니다.')
    return false
  }

  /**
   * 사용량 통계 조회
   */
  getUsageStats(): UsageStats {
    return this.costSafety.getStats()
  }

  /**
   * 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Stability AI의 계정 잔액 확인 엔드포인트 사용
      const response = await fetch(`${this.baseUrl}/user/balance`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-StableVideoClient/1.0.0'
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 완료까지 대기 (폴링)
   */
  async waitForCompletion(jobId: string): Promise<VideoGenerationResponse> {
    const startTime = Date.now()

    while (Date.now() - startTime < STABLE_VIDEO_CONFIG.MAX_POLLING_TIME) {
      const status = await this.checkStatus(jobId)

      if (status.status === 'completed') {
        // 완료 시 실제 결과를 가져오기 위해 다시 호출
        return await this.fetchCompletedResult(jobId)
      }

      if (status.status === 'failed') {
        throw new VideoGenerationError(
          `영상 생성 실패: ${status.error?.message || '알 수 없는 오류'}`,
          status.error?.code || 'GENERATION_FAILED',
          'stable-video'
        )
      }

      // 다음 폴링까지 대기
      await new Promise(resolve => setTimeout(resolve, STABLE_VIDEO_CONFIG.POLLING_INTERVAL))
    }

    throw new TimeoutError('영상 생성 대기 시간 초과', 'stable-video')
  }

  /**
   * 완료된 결과 가져오기
   */
  private async fetchCompletedResult(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${STABLE_VIDEO_CONFIG.STATUS_ENDPOINT}/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'video/*',
          'User-Agent': 'VideoPlanet-StableVideoClient/1.0.0'
        }
      })

      if (!response.ok) {
        throw new VideoGenerationError(
          `결과 조회 실패: ${response.status}`,
          `HTTP_${response.status}`,
          'stable-video'
        )
      }

      // 비디오 데이터를 받아서 URL로 변환 (실제 구현에서는 스토리지에 업로드)
      const videoBlob = await response.blob()
      const videoUrl = URL.createObjectURL(videoBlob)

      return {
        id: jobId,
        status: 'completed',
        videoUrl: videoUrl,
        thumbnailUrl: undefined,
        duration: 4,
        quality: 'medium',
        style: 'realistic',
        aspectRatio: '16:9',
        fps: 24,
        seed: undefined,
        prompt: '',
        imageUrl: undefined,
        progress: 100,
        estimatedCompletionTime: undefined,
        error: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        provider: 'stable-video',
        externalJobId: jobId,
      }

    } catch (error) {
      throw new VideoGenerationError(
        `결과 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
        'RESULT_FETCH_FAILED',
        'stable-video'
      )
    }
  }

  /**
   * 비용 추정
   */
  private estimateCost(request: VideoGenerationRequest): number {
    // Stable Video Diffusion 기준 비용 (고정 비용)
    return 0.04 // $0.04 per generation
  }

  /**
   * 표준 요청을 Stable Video 형식으로 변환
   */
  private convertToStableVideoFormat(request: VideoGenerationRequest) {
    return {
      image: request.imageUrl!,
      cfg_scale: this.mapQualityToCfgScale(request.quality),
      motion_bucket_id: Math.round(request.motionLevel * 200 + 40), // 40-240 범위
      seed: request.seed,
      steps: request.quality === 'high' ? 40 : 25,
      fps: Math.min(request.fps, 30),
      duration: 25, // Stable Video는 25프레임 고정
    }
  }

  /**
   * Stable Video 응답을 표준 형식으로 변환
   */
  private convertToStandardFormat(
    stableVideoResponse: z.infer<typeof StableVideoResponseSchema>,
    originalRequest: VideoGenerationRequest
  ): VideoGenerationResponse {
    return {
      id: stableVideoResponse.id,
      status: this.mapStableVideoStatus(stableVideoResponse.status),
      videoUrl: stableVideoResponse.video,
      thumbnailUrl: stableVideoResponse.image,
      duration: 4, // 약 1초 (25프레임을 24fps로)
      quality: originalRequest.quality,
      style: originalRequest.style,
      aspectRatio: originalRequest.aspectRatio,
      fps: originalRequest.fps,
      seed: stableVideoResponse.seed,
      prompt: originalRequest.prompt,
      imageUrl: originalRequest.imageUrl,
      progress: stableVideoResponse.status === 'complete' ? 100 :
               stableVideoResponse.status === 'failed' ? 0 : 50,
      estimatedCompletionTime: undefined,
      error: stableVideoResponse.status === 'failed' ? {
        code: 'GENERATION_FAILED',
        message: stableVideoResponse.errors?.join(', ') || '알 수 없는 오류'
      } : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: stableVideoResponse.status === 'complete' ? new Date() : undefined,
      provider: 'stable-video',
      externalJobId: stableVideoResponse.id,
    }
  }

  /**
   * 품질에 따른 CFG Scale 매핑
   */
  private mapQualityToCfgScale(quality: string): number {
    switch (quality) {
      case 'low': return 1.8
      case 'medium': return 2.5
      case 'high': return 3.5
      case 'ultra': return 4.5
      default: return 2.5
    }
  }

  /**
   * 상태 매핑
   */
  private mapStableVideoStatus(status: string) {
    switch (status) {
      case 'in-progress': return 'processing'
      case 'complete': return 'completed'
      case 'failed': return 'failed'
      default: return 'pending'
    }
  }

  /**
   * 테스트용 메소드
   */
  resetSafetyLimits(): void {
    this.costSafety.reset()
  }
}

/**
 * 기본 Stable Video 클라이언트 인스턴스
 */
export const stableVideoClient = (() => {
  try {
    return new StableVideoClient()
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Stable Video 클라이언트 초기화 실패:', error)
    }
    return null
  }
})()

/**
 * 단순화된 API 함수들
 */
export const generateVideoWithStableVideo = (request: VideoGenerationRequest) => {
  if (!stableVideoClient) {
    throw new VideoGenerationError(
      'Stable Video 클라이언트가 초기화되지 않았습니다. STABILITY_API_KEY를 확인하세요.',
      'CLIENT_NOT_INITIALIZED',
      'stable-video'
    )
  }
  return stableVideoClient.generateVideo(request)
}

export const checkStableVideoStatus = (jobId: string) => {
  if (!stableVideoClient) {
    throw new VideoGenerationError(
      'Stable Video 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'stable-video'
    )
  }
  return stableVideoClient.checkStatus(jobId)
}

export const waitForStableVideoCompletion = (jobId: string) => {
  if (!stableVideoClient) {
    throw new VideoGenerationError(
      'Stable Video 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'stable-video'
    )
  }
  return stableVideoClient.waitForCompletion(jobId)
}