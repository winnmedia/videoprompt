/**
 * Runway ML API Client
 *
 * Runway Gen-3 Alpha 모델을 위한 영상 생성 클라이언트
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
import { RunwayCostSafetyMiddleware } from './cost-safety-middleware'

/**
 * Runway API 설정
 */
const RUNWAY_CONFIG = {
  API_URL: process.env.RUNWAY_API_URL || 'https://api.runwayml.com/v1',
  GENERATE_ENDPOINT: '/video/generate',
  STATUS_ENDPOINT: '/video/status',
  CANCEL_ENDPOINT: '/video/cancel',
  TIMEOUT: 45000, // 45초 타임아웃 (영상 생성은 더 오래 걸림)
  MAX_RETRIES: 3,
  POLLING_INTERVAL: 5000, // 5초마다 상태 체크
  MAX_POLLING_TIME: 600000, // 최대 10분 대기
} as const

/**
 * Runway API 요청 스키마
 */
const RunwayRequestSchema = z.object({
  prompt: z.string().min(1),
  image: z.string().url().optional(),
  duration: z.number().min(1).max(10).default(5), // Runway는 최대 10초
  resolution: z.enum(['1280x768', '768x1280', '1024x1024']).default('1280x768'),
  motion_intensity: z.number().min(0).max(1).default(0.5),
  seed: z.number().int().min(0).optional(),
  model: z.literal('gen3a').default('gen3a'),
  watermark: z.boolean().default(false),
})

/**
 * Runway API 응답 스키마
 */
const RunwayResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  duration: z.number().optional(),
  progress: z.number().min(0).max(100).default(0),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  estimated_time_remaining: z.number().optional(),
  queue_position: z.number().optional(),
})

/**
 * Runway ML 클라이언트 클래스
 */
export class RunwayClient implements IVideoGenerationProvider {
  readonly name = 'runway' as const
  readonly supportedFeatures = {
    imageToVideo: true,
    textToVideo: true,
    maxDuration: 10,
    supportedQualities: ['medium', 'high'] as const,
    supportedStyles: ['realistic', 'cinematic'] as const,
    supportedAspectRatios: ['16:9', '9:16', '1:1'] as const,
  }

  private apiKey: string
  private baseUrl: string
  private costSafety: RunwayCostSafetyMiddleware

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey || process.env.RUNWAY_API_KEY || ''
    this.baseUrl = config?.baseUrl || RUNWAY_CONFIG.API_URL

    if (!this.apiKey) {
      throw new VideoGenerationError(
        'RUNWAY_API_KEY가 설정되지 않았습니다.',
        'MISSING_API_KEY',
        'runway'
      )
    }

    this.costSafety = RunwayCostSafetyMiddleware.getInstance(
      RunwayCostSafetyMiddleware,
      'runway'
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    // 입력 검증
    const validatedRequest = VideoGenerationRequestSchema.parse(request)

    // 비용 추정 (대략적)
    const estimatedCost = this.estimateCost(validatedRequest)

    // 비용 안전 체크 (최우선)
    await this.costSafety.checkSafety(estimatedCost)

    // Runway 형식으로 변환
    const runwayRequest = this.convertToRunwayFormat(validatedRequest)
    const validatedRunwayRequest = RunwayRequestSchema.parse(runwayRequest)

    let lastError: Error | null = null

    // 재시도 로직
    for (let attempt = 1; attempt <= RUNWAY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), RUNWAY_CONFIG.TIMEOUT)

        const response = await fetch(`${this.baseUrl}${RUNWAY_CONFIG.GENERATE_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'VideoPlanet-RunwayClient/1.0.0'
          },
          body: JSON.stringify(validatedRunwayRequest),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new VideoGenerationError(
            `Runway API 오류 (${response.status}): ${errorText}`,
            `HTTP_${response.status}`,
            'runway',
            response.status >= 500 // 서버 오류는 재시도 가능
          )
        }

        const data = await response.json()
        const validatedResponse = RunwayResponseSchema.parse(data)

        // 실제 비용 업데이트
        this.costSafety.updateActualCost(estimatedCost)

        // 통합 형식으로 변환하여 반환
        return this.convertToStandardFormat(validatedResponse, validatedRequest)

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // AbortError는 타임아웃으로 처리
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError('Runway API 요청 타임아웃', 'runway')
        }

        // 네트워크 오류는 별도 처리
        if (error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('ECONNRESET')
        )) {
          lastError = new NetworkError(`네트워크 오류: ${error.message}`, 'runway')
        }

        // 재시도 가능한 오류이고 마지막 시도가 아니면 재시도
        if (lastError instanceof VideoGenerationError && lastError.retryable &&
            attempt < RUNWAY_CONFIG.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 지수 백오프
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // 재시도 불가능하거나 마지막 시도면 즉시 종료
        break
      }
    }

    // 모든 재시도 실패
    if (process.env.NODE_ENV !== 'test') {
      console.error('Runway API 호출 실패:', lastError)
    }

    throw new VideoGenerationError(
      lastError
        ? `영상 생성 실패 (${RUNWAY_CONFIG.MAX_RETRIES}회 재시도): ${lastError.message}`
        : '영상 생성 중 알 수 없는 오류가 발생했습니다.',
      'GENERATION_FAILED',
      'runway',
      false,
      { originalError: lastError }
    )
  }

  /**
   * 작업 상태 확인
   */
  async checkStatus(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${RUNWAY_CONFIG.STATUS_ENDPOINT}/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-RunwayClient/1.0.0'
        }
      })

      if (!response.ok) {
        throw new VideoGenerationError(
          `상태 조회 실패: ${response.status}`,
          `HTTP_${response.status}`,
          'runway'
        )
      }

      const data = await response.json()
      const validatedResponse = RunwayResponseSchema.parse(data)

      return this.convertToStandardFormat(validatedResponse, {
        prompt: '', // 상태 조회 시에는 원본 요청 정보가 없음
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
        'runway'
      )
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${RUNWAY_CONFIG.CANCEL_ENDPOINT}/${jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-RunwayClient/1.0.0'
        }
      })

      return response.ok
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Runway 작업 취소 실패:', error)
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
      // 간단한 API 엔드포인트 호출로 상태 확인
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'VideoPlanet-RunwayClient/1.0.0'
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

    while (Date.now() - startTime < RUNWAY_CONFIG.MAX_POLLING_TIME) {
      const status = await this.checkStatus(jobId)

      if (status.status === 'completed') {
        return status
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new VideoGenerationError(
          `영상 생성 실패: ${status.error?.message || '알 수 없는 오류'}`,
          status.error?.code || 'GENERATION_FAILED',
          'runway'
        )
      }

      // 다음 폴링까지 대기
      await new Promise(resolve => setTimeout(resolve, RUNWAY_CONFIG.POLLING_INTERVAL))
    }

    throw new TimeoutError('영상 생성 대기 시간 초과', 'runway')
  }

  /**
   * 비용 추정
   */
  private estimateCost(request: VideoGenerationRequest): number {
    // Runway Gen-3 Alpha 기준 대략적 비용 계산
    // 실제 비용은 해상도, 길이, 복잡도에 따라 달라짐
    const baseCost = 0.05 // $0.05 기본 비용
    const durationMultiplier = request.duration / 5 // 5초 기준
    const qualityMultiplier = request.quality === 'high' ? 1.5 : 1.0

    return baseCost * durationMultiplier * qualityMultiplier
  }

  /**
   * 표준 요청을 Runway 형식으로 변환
   */
  private convertToRunwayFormat(request: VideoGenerationRequest) {
    return {
      prompt: request.prompt,
      image: request.imageUrl,
      duration: Math.min(request.duration, 10), // Runway 최대 10초
      resolution: this.getRunwayResolution(request.aspectRatio),
      motion_intensity: request.motionLevel,
      seed: request.seed,
      model: 'gen3a' as const,
      watermark: false,
    }
  }

  /**
   * Runway 응답을 표준 형식으로 변환
   */
  private convertToStandardFormat(
    runwayResponse: z.infer<typeof RunwayResponseSchema>,
    originalRequest: VideoGenerationRequest
  ): VideoGenerationResponse {
    return {
      id: runwayResponse.id,
      status: this.mapRunwayStatus(runwayResponse.status),
      videoUrl: runwayResponse.video_url,
      thumbnailUrl: runwayResponse.thumbnail_url,
      duration: runwayResponse.duration,
      quality: originalRequest.quality,
      style: originalRequest.style,
      aspectRatio: originalRequest.aspectRatio,
      fps: originalRequest.fps,
      seed: originalRequest.seed,
      prompt: originalRequest.prompt,
      imageUrl: originalRequest.imageUrl,
      progress: runwayResponse.progress,
      estimatedCompletionTime: runwayResponse.estimated_time_remaining,
      error: runwayResponse.error,
      createdAt: new Date(runwayResponse.created_at),
      updatedAt: new Date(runwayResponse.updated_at),
      completedAt: runwayResponse.completed_at ? new Date(runwayResponse.completed_at) : undefined,
      provider: 'runway',
      externalJobId: runwayResponse.id,
    }
  }

  /**
   * 해상도 매핑
   */
  private getRunwayResolution(aspectRatio: string): '1280x768' | '768x1280' | '1024x1024' {
    switch (aspectRatio) {
      case '16:9': return '1280x768'
      case '9:16': return '768x1280'
      case '1:1': return '1024x1024'
      case '4:3': return '1280x768' // 가장 근사치
      default: return '1280x768'
    }
  }

  /**
   * 상태 매핑
   */
  private mapRunwayStatus(status: string) {
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
 * 기본 Runway 클라이언트 인스턴스
 */
export const runwayClient = (() => {
  try {
    return new RunwayClient()
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Runway 클라이언트 초기화 실패:', error)
    }
    return null
  }
})()

/**
 * 단순화된 API 함수들
 */
export const generateVideoWithRunway = (request: VideoGenerationRequest) => {
  if (!runwayClient) {
    throw new VideoGenerationError(
      'Runway 클라이언트가 초기화되지 않았습니다. RUNWAY_API_KEY를 확인하세요.',
      'CLIENT_NOT_INITIALIZED',
      'runway'
    )
  }
  return runwayClient.generateVideo(request)
}

export const checkRunwayStatus = (jobId: string) => {
  if (!runwayClient) {
    throw new VideoGenerationError(
      'Runway 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'runway'
    )
  }
  return runwayClient.checkStatus(jobId)
}

export const waitForRunwayCompletion = (jobId: string) => {
  if (!runwayClient) {
    throw new VideoGenerationError(
      'Runway 클라이언트가 초기화되지 않았습니다.',
      'CLIENT_NOT_INITIALIZED',
      'runway'
    )
  }
  return runwayClient.waitForCompletion(jobId)
}