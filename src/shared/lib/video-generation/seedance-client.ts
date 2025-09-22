/**
 * ByteDance Seedance Video Generation API Client
 *
 * Seedance를 활용한 이미지-투-비디오 생성 클라이언트
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
import { SeedanceCostSafetyMiddleware } from './cost-safety-middleware'

/**
 * Seedance API 설정
 */
const SEEDANCE_CONFIG = {
  API_URL: process.env.SEEDANCE_API_URL || 'https://api.seedance.bytedance.com/v2',
  GENERATE_ENDPOINT: '/video/i2v/generate',
  STATUS_ENDPOINT: '/video/status',
  CANCEL_ENDPOINT: '/video/cancel',
  TIMEOUT: 60000, // 60초 타임아웃
  MAX_RETRIES: 3,
  POLLING_INTERVAL: 3000, // 3초마다 상태 체크
  MAX_POLLING_TIME: 900000, // 최대 15분 대기
} as const

/**
 * Seedance API 요청 스키마
 */
const SeedanceRequestSchema = z.object({
  image_url: z.string().url('유효한 이미지 URL이 필요합니다'),
  prompt: z.string().min(1),
  duration: z.number().min(1).max(30).default(5), // Seedance는 최대 30초
  motion_strength: z.number().min(0).max(1).default(0.5),
  camera_motion: z.enum(['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'dolly_in', 'dolly_out']).default('static'),
  style: z.enum(['realistic', 'cinematic', 'artistic', 'animated']).default('realistic'),
  resolution: z.enum(['1024x576', '576x1024', '768x768']).default('1024x576'),
  fps: z.number().min(12).max(30).default(24),
  seed: z.number().int().min(0).optional(),
  negative_prompt: z.string().optional(),
  model: z.literal('seedance-v2').default('seedance-v2'),
})

/**
 * Seedance API 응답 스키마
 */
const SeedanceResponseSchema = z.object({
  job_id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  preview_url: z.string().url().optional(),
  duration: z.number().optional(),
  progress: z.number().min(0).max(100).default(0),
  queue_position: z.number().optional(),
  estimated_time: z.number().optional(), // 예상 완료 시간 (초)
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  input_image_url: z.string().url().optional(),
  input_prompt: z.string().optional(),
  cost: z.number().optional(),
})

/**
 * Seedance 클라이언트 클래스
 */
export class SeedanceClient implements IVideoGenerationProvider {
  readonly name = 'seedance' as const
  readonly supportedFeatures = {
    imageToVideo: true,
    textToVideo: false, // Seedance는 주로 이미지-투-비디오
    maxDuration: 30,
    supportedQualities: ['medium', 'high'] as const,
    supportedStyles: ['realistic', 'cinematic', 'artistic'] as const,
    supportedAspectRatios: ['16:9', '9:16', '1:1'] as const,
  }

  private apiKey: string
  private baseUrl: string
  private costSafety: SeedanceCostSafetyMiddleware

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey || process.env.SEEDANCE_API_KEY || ''
    this.baseUrl = config?.baseUrl || SEEDANCE_CONFIG.API_URL

    if (!this.apiKey) {
      throw new VideoGenerationError(
        'SEEDANCE_API_KEY가 설정되지 않았습니다.',
        'MISSING_API_KEY',
        'seedance'
      )
    }

    this.costSafety = SeedanceCostSafetyMiddleware.getInstance(
      SeedanceCostSafetyMiddleware,
      'seedance'
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    // 입력 검증
    const validatedRequest = VideoGenerationRequestSchema.parse(request)

    // Seedance는 이미지가 필수
    if (!validatedRequest.imageUrl) {
      throw new VideoGenerationError(
        'Seedance는 이미지가 필수입니다. imageUrl을 제공해주세요.',
        'MISSING_IMAGE_URL',
        'seedance'
      )
    }

    // 비용 추정
    const estimatedCost = this.estimateCost(validatedRequest)

    // 비용 안전 체크 (최우선)
    await this.costSafety.checkSafety(estimatedCost)

    // Seedance 형식으로 변환
    const seedanceRequest = this.convertToSeedanceFormat(validatedRequest)
    const validatedSeedanceRequest = SeedanceRequestSchema.parse(seedanceRequest)

    let lastError: Error | null = null

    // 재시도 로직
    for (let attempt = 1; attempt <= SEEDANCE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), SEEDANCE_CONFIG.TIMEOUT)

        const response = await fetch(`${this.baseUrl}${SEEDANCE_CONFIG.GENERATE_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'VideoPlanet-SeedanceClient/1.0.0'
          },
          body: JSON.stringify(validatedSeedanceRequest),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new VideoGenerationError(
            `Seedance API 오류 (${response.status}): ${errorText}`,
            `HTTP_${response.status}`,
            'seedance',
            response.status >= 500
          )
        }

        const data = await response.json()
        const validatedResponse = SeedanceResponseSchema.parse(data)

        // 실제 비용 업데이트
        this.costSafety.updateActualCost(estimatedCost)

        // 통합 형식으로 변환하여 반환
        return this.convertToStandardFormat(validatedResponse, validatedRequest)

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // AbortError는 타임아웃으로 처리
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError('Seedance API 요청 타임아웃', 'seedance')
        }

        // 네트워크 오류는 별도 처리
        if (error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('ECONNRESET')
        )) {
          lastError = new NetworkError(`네트워크 오류: ${error.message}`, 'seedance')
        }

        // 재시도 가능한 오류이고 마지막 시도가 아니면 재시도
        if (lastError instanceof VideoGenerationError && lastError.retryable &&
            attempt < SEEDANCE_CONFIG.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        break
      }
    }

    // 모든 재시도 실패
    if (process.env.NODE_ENV !== 'test') {
      console.error('Seedance API 호출 실패:', lastError)
    }

    throw new VideoGenerationError(
      lastError
        ? `영상 생성 실패 (${SEEDANCE_CONFIG.MAX_RETRIES}회 재시도): ${lastError.message}`
        : '영상 생성 중 알 수 없는 오류가 발생했습니다.',
      'GENERATION_FAILED',
      'seedance',
      false,
      { originalError: lastError }
    )
  }

  /**
   * 작업 상태 확인
   */
  async checkStatus(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${SEEDANCE_CONFIG.STATUS_ENDPOINT}/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-SeedanceClient/1.0.0'
        }
      })

      if (!response.ok) {
        throw new VideoGenerationError(
          `상태 조회 실패: ${response.status}`,
          `HTTP_${response.status}`,
          'seedance'
        )
      }

      const data = await response.json()
      const validatedResponse = SeedanceResponseSchema.parse(data)

      return this.convertToStandardFormat(validatedResponse, {
        prompt: validatedResponse.input_prompt || '',
        imageUrl: validatedResponse.input_image_url,
        duration: 5,
        quality: 'medium',
        style: 'realistic',
        aspectRatio: '16:9',
        fps: 24,
        motionLevel: 0.5
      })

    } catch (error) {
      throw new VideoGenerationError(
        `상태 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_CHECK_FAILED',
        'seedance'
      )
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${SEEDANCE_CONFIG.CANCEL_ENDPOINT}/${jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-SeedanceClient/1.0.0'
        }
      })

      return response.ok
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Seedance 작업 취소 실패:', error)
      }
      return false
    }
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
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-SeedanceClient/1.0.0'
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

    while (Date.now() - startTime < SEEDANCE_CONFIG.MAX_POLLING_TIME) {
      const status = await this.checkStatus(jobId)

      if (status.status === 'completed') {
        return status
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new VideoGenerationError(
          `영상 생성 실패: ${status.error?.message || '알 수 없는 오류'}`,
          status.error?.code || 'GENERATION_FAILED',
          'seedance'
        )
      }

      // 다음 폴링까지 대기
      await new Promise(resolve => setTimeout(resolve, SEEDANCE_CONFIG.POLLING_INTERVAL))
    }

    throw new TimeoutError('영상 생성 대기 시간 초과', 'seedance')
  }

  /**
   * 비용 추정
   */
  private estimateCost(request: VideoGenerationRequest): number {
    // Seedance 기준 대략적 비용 계산
    const baseCost = 0.03 // $0.03 기본 비용
    const durationMultiplier = request.duration / 5 // 5초 기준
    const qualityMultiplier = request.quality === 'high' ? 1.3 : 1.0
    const motionMultiplier = 1 + (request.motionLevel * 0.5) // 모션이 많을수록 비싸짐

    return baseCost * durationMultiplier * qualityMultiplier * motionMultiplier
  }

  /**
   * 표준 요청을 Seedance 형식으로 변환
   */
  private convertToSeedanceFormat(request: VideoGenerationRequest) {
    return {
      image_url: request.imageUrl!,
      prompt: request.prompt,
      duration: Math.min(request.duration, 30), // Seedance 최대 30초
      motion_strength: request.motionLevel,
      camera_motion: this.getCameraMotion(request.motionLevel),
      style: this.mapStyleToSeedance(request.style),
      resolution: this.getSeedanceResolution(request.aspectRatio),
      fps: Math.min(request.fps, 30), // Seedance 최대 30fps
      seed: request.seed,
      negative_prompt: request.negativePrompt,
      model: 'seedance-v2' as const,
    }
  }

  /**
   * Seedance 응답을 표준 형식으로 변환
   */
  private convertToStandardFormat(
    seedanceResponse: z.infer<typeof SeedanceResponseSchema>,
    originalRequest: VideoGenerationRequest
  ): VideoGenerationResponse {
    return {
      id: seedanceResponse.job_id,
      status: this.mapSeedanceStatus(seedanceResponse.status),
      videoUrl: seedanceResponse.video_url,
      thumbnailUrl: seedanceResponse.thumbnail_url,
      duration: seedanceResponse.duration,
      quality: originalRequest.quality,
      style: originalRequest.style,
      aspectRatio: originalRequest.aspectRatio,
      fps: originalRequest.fps,
      seed: originalRequest.seed,
      prompt: originalRequest.prompt,
      imageUrl: originalRequest.imageUrl,
      progress: seedanceResponse.progress,
      estimatedCompletionTime: seedanceResponse.estimated_time,
      error: seedanceResponse.error,
      createdAt: new Date(seedanceResponse.created_at),
      updatedAt: new Date(seedanceResponse.updated_at),
      completedAt: seedanceResponse.completed_at ? new Date(seedanceResponse.completed_at) : undefined,
      provider: 'seedance',
      externalJobId: seedanceResponse.job_id,
      cost: seedanceResponse.cost,
    }
  }

  /**
   * 모션 레벨에 따른 카메라 움직임 결정
   */
  private getCameraMotion(motionLevel: number): 'static' | 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'dolly_in' | 'dolly_out' {
    if (motionLevel < 0.2) return 'static'
    if (motionLevel < 0.4) return 'zoom_in'
    if (motionLevel < 0.6) return 'pan_right'
    if (motionLevel < 0.8) return 'dolly_in'
    return 'zoom_out'
  }

  /**
   * 스타일 매핑
   */
  private mapStyleToSeedance(style: string): 'realistic' | 'cinematic' | 'artistic' | 'animated' {
    switch (style) {
      case 'realistic': return 'realistic'
      case 'cinematic': return 'cinematic'
      case 'animation': return 'animated'
      case 'artistic': return 'artistic'
      case 'sketch': return 'animated'
      default: return 'realistic'
    }
  }

  /**
   * 해상도 매핑
   */
  private getSeedanceResolution(aspectRatio: string): '1024x576' | '576x1024' | '768x768' {
    switch (aspectRatio) {
      case '16:9': return '1024x576'
      case '9:16': return '576x1024'
      case '1:1': return '768x768'
      case '4:3': return '1024x576' // 가장 근사치
      default: return '1024x576'
    }
  }

  /**
   * 상태 매핑
   */
  private mapSeedanceStatus(status: string) {
    switch (status) {
      case 'queued': return 'pending'
      case 'processing': return 'processing'
      case 'completed': return 'completed'
      case 'failed': return 'failed'
      case 'cancelled': return 'cancelled'
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
 * 기본 Seedance 클라이언트 인스턴스
 */
export const seedanceClient = (() => {
  try {
    return new SeedanceClient()
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Seedance 클라이언트 초기화 실패:', error)
    }
    return null
  }
})()

/**
 * 단순화된 API 함수들
 */
export const generateVideoWithSeedance = (request: VideoGenerationRequest) => {
  if (!seedanceClient) {
    throw new VideoGenerationError(
      'Seedance 클라이언트가 초기화되지 않았습니다. SEEDANCE_API_KEY를 확인하세요.',
      'CLIENT_NOT_INITIALIZED',
      'seedance'
    )
  }
  return seedanceClient.generateVideo(request)
}

export const checkSeedanceStatus = (jobId: string) => {
  if (!seedanceClient) {
    throw new VideoGenerationError(
      'Seedance 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'seedance'
    )
  }
  return seedanceClient.checkStatus(jobId)
}

export const waitForSeedanceCompletion = (jobId: string) => {
  if (!seedanceClient) {
    throw new VideoGenerationError(
      'Seedance 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'seedance'
    )
  }
  return seedanceClient.waitForCompletion(jobId)
}