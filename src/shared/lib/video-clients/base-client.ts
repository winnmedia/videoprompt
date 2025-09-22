/**
 * Base Video Generation Client
 *
 * CLAUDE.md 준수: shared/lib 공통 기술 구현
 * 모든 영상 생성 클라이언트의 베이스 클래스
 */

import logger from '../logger'
import { apiRetry } from '../api-retry'

/**
 * 영상 생성 API 에러
 */
export class VideoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'VideoApiError'
  }
}

/**
 * 재시도 전략
 */
export interface RetryStrategy {
  readonly maxAttempts: number
  readonly baseDelay: number
  readonly maxDelay: number
  readonly factor: number
}

/**
 * API 응답 인터페이스
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: unknown
  }
}

/**
 * 영상 생성 파라미터 (API 특화)
 */
export interface VideoApiParams {
  prompt: string
  imageUrl?: string
  duration?: number
  width?: number
  height?: number
  aspectRatio?: string
  seed?: number
  webhookUrl?: string
}

/**
 * 영상 작업 응답
 */
export interface VideoApiJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  estimatedTime?: number
  resultUrl?: string
  thumbnailUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

/**
 * 기본 영상 생성 클라이언트 추상 클래스
 */
export abstract class BaseVideoClient {
  protected readonly baseUrl: string
  protected readonly apiKey: string
  protected readonly providerName: string
  protected readonly timeout: number

  constructor(
    baseUrl: string,
    apiKey: string,
    providerName: string,
    timeout: number = 60000
  ) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.providerName = providerName
    this.timeout = timeout
  }

  /**
   * 영상 생성 요청 (추상 메서드)
   */
  abstract generateVideo(params: VideoApiParams): Promise<VideoApiJob>

  /**
   * 작업 상태 조회 (추상 메서드)
   */
  abstract getJobStatus(jobId: string): Promise<VideoApiJob>

  /**
   * 작업 취소 (추상 메서드)
   */
  abstract cancelJob(jobId: string): Promise<void>

  /**
   * 재시도와 함께 API 호출
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy = this.getDefaultRetryStrategy()
  ): Promise<T> {
    return apiRetry.execute(operation, {
      maxAttempts: strategy.maxAttempts,
      delay: strategy.baseDelay,
      maxDelay: strategy.maxDelay,
      factor: strategy.factor,
      onRetry: (attempt, error) => {
        logger.warn(`${this.providerName} API 재시도 ${attempt}/${strategy.maxAttempts}`, {
          error: error.message,
          provider: this.providerName
        })
      }
    })
  }

  /**
   * HTTP 요청 헬퍼
   */
  protected async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'VideoPlanet/1.0',
      ...headers
    }

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(this.timeout)
    }

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body)
    }

    try {
      logger.debug(`${this.providerName} API 요청`, {
        url,
        method,
        body: method !== 'GET' ? body : undefined
      })

      const response = await fetch(url, requestInit)
      const responseData = await response.json()

      if (!response.ok) {
        const error = new VideoApiError(
          responseData.error?.message || `HTTP ${response.status}`,
          response.status,
          responseData.error?.code || 'UNKNOWN_ERROR',
          this.providerName,
          this.isRetryableError(response.status)
        )

        logger.error(`${this.providerName} API 오류`, {
          status: response.status,
          error: responseData,
          provider: this.providerName
        })

        throw error
      }

      logger.debug(`${this.providerName} API 응답`, {
        status: response.status,
        data: responseData
      })

      return {
        success: true,
        data: responseData
      }
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      // 네트워크 오류 등
      const apiError = new VideoApiError(
        error instanceof Error ? error.message : '알 수 없는 오류',
        0,
        'NETWORK_ERROR',
        this.providerName,
        true // 네트워크 오류는 재시도 가능
      )

      logger.error(`${this.providerName} 네트워크 오류`, {
        error: error instanceof Error ? error.message : error,
        provider: this.providerName
      })

      throw apiError
    }
  }

  /**
   * 파라미터 검증
   */
  protected validateParams(params: VideoApiParams): void {
    if (!params.prompt?.trim()) {
      throw new VideoApiError(
        '프롬프트는 필수입니다',
        400,
        'INVALID_PARAMS',
        this.providerName
      )
    }

    if (params.prompt.length > 1000) {
      throw new VideoApiError(
        '프롬프트가 너무 깁니다 (최대 1000자)',
        400,
        'PROMPT_TOO_LONG',
        this.providerName
      )
    }

    if (params.duration && (params.duration <= 0 || params.duration > 30)) {
      throw new VideoApiError(
        '영상 길이는 1-30초 사이여야 합니다',
        400,
        'INVALID_DURATION',
        this.providerName
      )
    }

    if (params.width && params.height) {
      if (params.width < 256 || params.height < 256 ||
          params.width > 2048 || params.height > 2048) {
        throw new VideoApiError(
          '해상도는 256x256 ~ 2048x2048 사이여야 합니다',
          400,
          'INVALID_RESOLUTION',
          this.providerName
        )
      }
    }
  }

  /**
   * 웹훅 URL 생성
   */
  protected createWebhookUrl(jobId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/video/webhook?provider=${this.providerName}&jobId=${jobId}`
  }

  /**
   * 기본 재시도 전략
   */
  private getDefaultRetryStrategy(): RetryStrategy {
    return {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      factor: 2
    }
  }

  /**
   * 재시도 가능한 오류인지 확인
   */
  private isRetryableError(status: number): boolean {
    // 4xx 클라이언트 오류는 대부분 재시도 불가
    // 5xx 서버 오류와 429 (Rate Limit)는 재시도 가능
    return status >= 500 || status === 429 || status === 408
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 각 클라이언트에서 구현된 헬스체크 엔드포인트 호출
      await this.makeRequest('/health', 'GET')
      return true
    } catch (error) {
      logger.warn(`${this.providerName} 헬스체크 실패`, {
        error: error instanceof Error ? error.message : error
      })
      return false
    }
  }

  /**
   * 요청 제한 체크
   */
  protected checkRateLimit(): void {
    // 각 클라이언트에서 구체적으로 구현
    // 여기서는 기본적인 로컬 레이트 제한만 체크
    const now = Date.now()
    const lastRequest = this.getLastRequestTime()
    const minInterval = this.getMinRequestInterval()

    if (lastRequest && (now - lastRequest) < minInterval) {
      throw new VideoApiError(
        `요청 간격이 너무 짧습니다. ${minInterval}ms 대기 후 시도하세요`,
        429,
        'RATE_LIMIT_EXCEEDED',
        this.providerName,
        true
      )
    }

    this.setLastRequestTime(now)
  }

  /**
   * 마지막 요청 시간 관리 (메모리 기반, 실제로는 Redis 등 사용 권장)
   */
  private static lastRequestTimes: Map<string, number> = new Map()

  private getLastRequestTime(): number | undefined {
    return BaseVideoClient.lastRequestTimes.get(this.providerName)
  }

  private setLastRequestTime(time: number): void {
    BaseVideoClient.lastRequestTimes.set(this.providerName, time)
  }

  /**
   * 최소 요청 간격 (기본 1초)
   */
  protected getMinRequestInterval(): number {
    return 1000
  }
}