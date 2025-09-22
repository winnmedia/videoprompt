/**
 * Seedance (ByteDance) Video Generation Client
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * ByteDance Seedance API를 통한 영상 생성 클라이언트
 */

import { BaseVideoClient, VideoApiParams, VideoApiJob, VideoApiError } from './base-client'
import logger from '../logger'

/**
 * Seedance API 전용 파라미터
 */
interface SeedanceApiParams extends VideoApiParams {
  model?: 'seedance-v1' | 'seedance-v2'
  style?: 'cinematic' | 'artistic' | 'realistic' | 'cartoon'
  camera_control?: {
    type: 'static' | 'pan' | 'zoom' | 'orbit'
    speed?: 'slow' | 'medium' | 'fast'
  }
}

/**
 * Seedance API 응답 형식
 */
interface SeedanceJobResponse {
  job_id: string
  status: 'waiting' | 'processing' | 'success' | 'failed'
  progress?: number
  estimated_time?: number
  created_time: string
  updated_time: string
  result?: {
    video_url: string
    thumbnail_url?: string
    duration: number
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * Seedance 클라이언트
 */
export class SeedanceClient extends BaseVideoClient {
  constructor() {
    const apiKey = process.env.SEEDANCE_API_KEY
    if (!apiKey) {
      throw new Error('SEEDANCE_API_KEY 환경변수가 설정되지 않았습니다')
    }

    super(
      'https://api.seedance.bytedance.com/v1',
      apiKey,
      'seedance',
      180000 // 3분 타임아웃
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(params: VideoApiParams): Promise<VideoApiJob> {
    this.validateParams(params)
    this.checkRateLimit()

    const seedanceParams = this.convertToSeedanceParams(params)

    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<SeedanceJobResponse>('/video/generate', 'POST', {
          prompt: seedanceParams.prompt,
          image_url: seedanceParams.imageUrl,
          duration: seedanceParams.duration || 5,
          resolution: this.convertResolution(seedanceParams.width, seedanceParams.height),
          model: seedanceParams.model || 'seedance-v2',
          style: seedanceParams.style || 'realistic',
          seed: seedanceParams.seed,
          callback_url: seedanceParams.webhookUrl
        })
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Seedance API 응답이 올바르지 않습니다',
          500,
          'INVALID_RESPONSE',
          'seedance'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Seedance 영상 생성 실패', {
        error: error instanceof Error ? error.message : error,
        params: seedanceParams
      })

      throw new VideoApiError(
        'Seedance 영상 생성 중 오류가 발생했습니다',
        500,
        'GENERATION_FAILED',
        'seedance'
      )
    }
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<VideoApiJob> {
    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<SeedanceJobResponse>(`/video/status/${jobId}`, 'GET')
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Seedance 작업 상태 조회 실패',
          404,
          'JOB_NOT_FOUND',
          'seedance'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Seedance 상태 조회 실패', {
        error: error instanceof Error ? error.message : error,
        jobId
      })

      throw new VideoApiError(
        'Seedance 작업 상태 조회 중 오류가 발생했습니다',
        500,
        'STATUS_CHECK_FAILED',
        'seedance'
      )
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      await this.withRetry(async () => {
        return this.makeRequest(`/video/cancel/${jobId}`, 'POST')
      })

      logger.info('Seedance 작업 취소됨', { jobId })
    } catch (error) {
      logger.error('Seedance 작업 취소 실패', {
        error: error instanceof Error ? error.message : error,
        jobId
      })

      throw new VideoApiError(
        'Seedance 작업 취소 중 오류가 발생했습니다',
        500,
        'CANCEL_FAILED',
        'seedance'
      )
    }
  }

  /**
   * 사용자 할당량 조회
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

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Seedance 할당량 조회 실패',
          500,
          'QUOTA_CHECK_FAILED',
          'seedance'
        )
      }

      return {
        remaining: response.data.quota.remaining,
        total: response.data.quota.total,
        resetDate: response.data.quota.reset_date
      }
    } catch (error) {
      logger.error('Seedance 할당량 조회 실패', {
        error: error instanceof Error ? error.message : error
      })

      throw new VideoApiError(
        'Seedance 할당량 조회 중 오류가 발생했습니다',
        500,
        'QUOTA_CHECK_FAILED',
        'seedance'
      )
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health', 'GET')
      return true
    } catch (error) {
      logger.warn('Seedance 헬스체크 실패', {
        error: error instanceof Error ? error.message : error
      })
      return false
    }
  }

  /**
   * 파라미터를 Seedance 형식으로 변환
   */
  private convertToSeedanceParams(params: VideoApiParams): SeedanceApiParams & { webhookUrl: string } {
    return {
      ...params,
      model: 'seedance-v2', // 최신 모델 사용
      style: 'realistic', // 기본 스타일
      webhookUrl: this.createWebhookUrl(crypto.randomUUID())
    }
  }

  /**
   * 해상도를 Seedance 형식으로 변환
   */
  private convertResolution(width?: number, height?: number): string {
    if (width && height) {
      return `${width}x${height}`
    }

    // 기본 해상도들
    return '1024x576' // 16:9 기본
  }

  /**
   * Seedance 응답을 표준 형식으로 변환
   */
  private convertToStandardJob(seedanceJob: SeedanceJobResponse): VideoApiJob {
    const status = this.convertStatus(seedanceJob.status)

    return {
      id: seedanceJob.job_id,
      status,
      progress: seedanceJob.progress || this.getDefaultProgress(seedanceJob.status),
      estimatedTime: seedanceJob.estimated_time,
      resultUrl: seedanceJob.result?.video_url,
      thumbnailUrl: seedanceJob.result?.thumbnail_url,
      error: seedanceJob.error?.message,
      createdAt: seedanceJob.created_time,
      updatedAt: seedanceJob.updated_time
    }
  }

  /**
   * Seedance 상태를 표준 상태로 변환
   */
  private convertStatus(seedanceStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (seedanceStatus) {
      case 'waiting':
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
      case 'waiting':
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

  /**
   * Seedance 전용 최소 요청 간격 (3초)
   */
  protected getMinRequestInterval(): number {
    return 3000
  }

  /**
   * 파라미터 검증 (Seedance 전용 확장)
   */
  protected validateParams(params: VideoApiParams): void {
    super.validateParams(params)

    // Seedance 전용 검증
    if (params.duration && params.duration > 10) {
      throw new VideoApiError(
        'Seedance는 최대 10초까지 지원합니다',
        400,
        'DURATION_TOO_LONG',
        'seedance'
      )
    }
  }
}