/**
 * ByteDance Image Generation Client
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * ByteDance Doubao API를 통한 콘티 이미지 생성 클라이언트
 */

import logger from '../logger'

/**
 * ByteDance 이미지 생성 파라미터
 */
export interface ByteDanceImageParams {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  style?: 'cinematic' | 'artistic' | 'realistic' | 'cartoon' | 'anime' | 'sketch'
  quality?: 'standard' | 'high' | 'ultra'
  seed?: number
  steps?: number
  guidance_scale?: number
}

/**
 * ByteDance API 응답 형식
 */
interface ByteDanceImageResponse {
  request_id: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  progress?: number
  estimated_time?: number
  created_time: string
  updated_time: string
  result?: {
    images: Array<{
      url: string
      width: number
      height: number
      format: string
    }>
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * 표준화된 이미지 생성 작업
 */
export interface ImageGenerationJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  estimatedTime?: number
  resultUrls: string[]
  error?: string
  createdAt: string
  updatedAt: string
}

/**
 * 이미지 생성 에러
 */
export class ImageGenerationError extends Error {
  constructor(
    message: string,
    public code: string = 'IMAGE_GENERATION_ERROR',
    public status: number = 500,
    public provider: string = 'bytedance'
  ) {
    super(message)
    this.name = 'ImageGenerationError'
  }
}

/**
 * ByteDance 이미지 생성 클라이언트
 */
export class ByteDanceImageClient {
  private baseUrl: string
  private apiKey: string
  private lastRequestTime = 0
  private readonly minRequestInterval = 2000 // 2초 최소 간격

  constructor() {
    const apiKey = process.env.BYTEDANCE_API_KEY
    if (!apiKey) {
      throw new Error('BYTEDANCE_API_KEY 환경변수가 설정되지 않았습니다')
    }

    this.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3'
    this.apiKey = apiKey
  }

  /**
   * 이미지 생성 요청
   */
  async generateImage(params: ByteDanceImageParams): Promise<ImageGenerationJob> {
    this.validateParams(params)
    this.checkRateLimit()

    const requestPayload = this.buildRequestPayload(params)

    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<ByteDanceImageResponse>('/images/generate', 'POST', requestPayload)
      })

      if (!response.request_id) {
        throw new ImageGenerationError(
          'ByteDance API 응답이 올바르지 않습니다',
          'INVALID_RESPONSE',
          500
        )
      }

      return this.convertToStandardJob(response)
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        throw error
      }

      logger.error('ByteDance 이미지 생성 실패', {
        error: error instanceof Error ? error.message : error,
        params: requestPayload
      })

      throw new ImageGenerationError(
        'ByteDance 이미지 생성 중 오류가 발생했습니다',
        'GENERATION_FAILED',
        500
      )
    }
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(requestId: string): Promise<ImageGenerationJob> {
    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<ByteDanceImageResponse>(`/images/status/${requestId}`, 'GET')
      })

      if (!response.request_id) {
        throw new ImageGenerationError(
          'ByteDance 작업 상태 조회 실패',
          'JOB_NOT_FOUND',
          404
        )
      }

      return this.convertToStandardJob(response)
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        throw error
      }

      logger.error('ByteDance 상태 조회 실패', {
        error: error instanceof Error ? error.message : error,
        requestId
      })

      throw new ImageGenerationError(
        'ByteDance 작업 상태 조회 중 오류가 발생했습니다',
        'STATUS_CHECK_FAILED',
        500
      )
    }
  }

  /**
   * 배치 이미지 생성 (3개씩 병렬 처리)
   */
  async generateBatch(paramsList: ByteDanceImageParams[]): Promise<ImageGenerationJob[]> {
    const batchSize = 3
    const results: ImageGenerationJob[] = []

    // 3개씩 배치로 나누어 처리
    for (let i = 0; i < paramsList.length; i += batchSize) {
      const batch = paramsList.slice(i, i + batchSize)

      logger.info('ByteDance 배치 이미지 생성 시작', {
        component: 'ByteDanceImageClient',
        metadata: {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalBatches: Math.ceil(paramsList.length / batchSize)
        }
      })

      // 병렬 처리
      const batchPromises = batch.map(params => this.generateImage(params))
      const batchResults = await Promise.allSettled(batchPromises)

      // 결과 처리
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          logger.error('배치 이미지 생성 실패', {
            error: result.reason,
            batchIndex: i + index,
            params: batch[index]
          })

          // 실패한 작업도 결과에 포함 (에러 상태로)
          results.push({
            id: `failed-${Date.now()}-${index}`,
            status: 'failed',
            progress: 0,
            resultUrls: [],
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }
      })

      // 배치 간 지연 (rate limiting)
      if (i + batchSize < paramsList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  /**
   * 할당량 조회
   */
  async getQuota(): Promise<{ remaining: number; total: number; resetDate: string }> {
    try {
      const response = await this.makeRequest<{
        quota: {
          remaining: number
          total: number
          reset_date: string
        }
      }>('/user/quota', 'GET')

      return {
        remaining: response.quota.remaining,
        total: response.quota.total,
        resetDate: response.quota.reset_date
      }
    } catch (error) {
      logger.error('ByteDance 할당량 조회 실패', {
        error: error instanceof Error ? error.message : error
      })

      throw new ImageGenerationError(
        'ByteDance 할당량 조회 중 오류가 발생했습니다',
        'QUOTA_CHECK_FAILED',
        500
      )
    }
  }

  /**
   * HTTP 요청 실행
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'VideoPlanet-Planning/1.0'
    }

    const config: RequestInit = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        // JSON 파싱 실패시 원본 텍스트 사용
      }

      throw new ImageGenerationError(
        errorMessage,
        'HTTP_ERROR',
        response.status
      )
    }

    return response.json()
  }

  /**
   * 재시도 로직
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === maxRetries) {
          throw lastError
        }

        // 지수 백오프
        const delay = baseDelay * Math.pow(2, attempt)
        logger.warn(`ByteDance API 재시도 ${attempt + 1}/${maxRetries}`, {
          delay,
          error: lastError.message
        })

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  /**
   * Rate limiting 체크
   */
  private checkRateLimit(): void {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest
      throw new ImageGenerationError(
        `Rate limit: ${waitTime}ms 후 다시 시도해주세요`,
        'RATE_LIMIT_ERROR',
        429
      )
    }

    this.lastRequestTime = now
  }

  /**
   * 요청 파라미터 검증
   */
  private validateParams(params: ByteDanceImageParams): void {
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new ImageGenerationError(
        '프롬프트는 필수입니다',
        'MISSING_PROMPT',
        400
      )
    }

    if (params.prompt.length > 2000) {
      throw new ImageGenerationError(
        '프롬프트는 2000자를 초과할 수 없습니다',
        'PROMPT_TOO_LONG',
        400
      )
    }

    if (params.width && (params.width < 256 || params.width > 2048)) {
      throw new ImageGenerationError(
        '너비는 256-2048 픽셀 범위여야 합니다',
        'INVALID_WIDTH',
        400
      )
    }

    if (params.height && (params.height < 256 || params.height > 2048)) {
      throw new ImageGenerationError(
        '높이는 256-2048 픽셀 범위여야 합니다',
        'INVALID_HEIGHT',
        400
      )
    }
  }

  /**
   * 요청 페이로드 구성
   */
  private buildRequestPayload(params: ByteDanceImageParams) {
    return {
      prompt: params.prompt,
      negative_prompt: params.negative_prompt || '',
      width: params.width || 1024,
      height: params.height || 768,
      style: params.style || 'realistic',
      quality: params.quality || 'high',
      seed: params.seed,
      steps: params.steps || 20,
      guidance_scale: params.guidance_scale || 7.5,
      num_images: 1 // 단일 이미지 생성
    }
  }

  /**
   * ByteDance 응답을 표준 형식으로 변환
   */
  private convertToStandardJob(response: ByteDanceImageResponse): ImageGenerationJob {
    const status = this.convertStatus(response.status)
    const resultUrls = response.result?.images.map(img => img.url) || []

    return {
      id: response.request_id,
      status,
      progress: response.progress || this.getDefaultProgress(response.status),
      estimatedTime: response.estimated_time,
      resultUrls,
      error: response.error?.message,
      createdAt: response.created_time,
      updatedAt: response.updated_time
    }
  }

  /**
   * ByteDance 상태를 표준 상태로 변환
   */
  private convertStatus(bytedanceStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (bytedanceStatus) {
      case 'pending':
        return 'pending'
      case 'processing':
        return 'processing'
      case 'success':
        return 'completed'
      case 'failed':
        return 'failed'
      default:
        return 'pending'
    }
  }

  /**
   * 상태별 기본 진행률
   */
  private getDefaultProgress(status: string): number {
    switch (status) {
      case 'pending':
        return 0
      case 'processing':
        return 50
      case 'success':
        return 100
      case 'failed':
        return 0
      default:
        return 0
    }
  }
}

/**
 * 글로벌 ByteDance 클라이언트 인스턴스
 */
export const byteDanceImageClient = new ByteDanceImageClient()