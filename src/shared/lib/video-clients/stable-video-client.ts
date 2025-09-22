/**
 * Stable Video Diffusion Client
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * Stability AI의 Stable Video Diffusion API 클라이언트
 */

import { BaseVideoClient, VideoApiParams, VideoApiJob, VideoApiError } from './base-client'
import logger from '../logger'

/**
 * Stable Video API 전용 파라미터
 */
interface StableVideoApiParams extends VideoApiParams {
  model?: 'svd' | 'svd-xt'
  motion_bucket_id?: number // 1-255, 모션 강도
  noise?: number // 0-1, 노이즈 레벨
  cfg_scale?: number // 1-10, classifier-free guidance scale
}

/**
 * Stable Video API 응답 형식
 */
interface StableVideoJobResponse {
  id: string
  status: 'in-progress' | 'complete' | 'failed'
  artifacts?: Array<{
    base64?: string
    seed: number
    finishReason: string
  }>
  created_at: string
  updated_at?: string
}

/**
 * Stable Video 클라이언트
 */
export class StableVideoClient extends BaseVideoClient {
  constructor() {
    const apiKey = process.env.STABILITY_API_KEY
    if (!apiKey) {
      throw new Error('STABILITY_API_KEY 환경변수가 설정되지 않았습니다')
    }

    super(
      'https://api.stability.ai/v2beta',
      apiKey,
      'stable-video',
      300000 // 5분 타임아웃 (Stable Video는 더 오래 걸림)
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(params: VideoApiParams): Promise<VideoApiJob> {
    this.validateParams(params)
    this.checkRateLimit()

    const stableParams = this.convertToStableVideoParams(params)

    try {
      // Stable Video는 FormData 사용
      const formData = new FormData()

      if (stableParams.imageUrl) {
        // 이미지 URL에서 Blob 가져오기
        const imageResponse = await fetch(stableParams.imageUrl)
        const imageBlob = await imageResponse.blob()
        formData.append('image', imageBlob)
      }

      formData.append('seed', (stableParams.seed || Math.floor(Math.random() * 1000000)).toString())
      formData.append('cfg_scale', (stableParams.cfg_scale || 2.5).toString())
      formData.append('motion_bucket_id', (stableParams.motion_bucket_id || 40).toString())

      if (stableParams.noise !== undefined) {
        formData.append('noise', stableParams.noise.toString())
      }

      const response = await this.withRetry(async () => {
        return this.makeRequestFormData<StableVideoJobResponse>('/image-to-video', formData)
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Stable Video API 응답이 올바르지 않습니다',
          500,
          'INVALID_RESPONSE',
          'stable-video'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Stable Video 영상 생성 실패', {
        error: error instanceof Error ? error.message : error,
        params: stableParams
      })

      throw new VideoApiError(
        'Stable Video 영상 생성 중 오류가 발생했습니다',
        500,
        'GENERATION_FAILED',
        'stable-video'
      )
    }
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<VideoApiJob> {
    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<StableVideoJobResponse>(`/image-to-video/result/${jobId}`, 'GET')
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Stable Video 작업 상태 조회 실패',
          404,
          'JOB_NOT_FOUND',
          'stable-video'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Stable Video 상태 조회 실패', {
        error: error instanceof Error ? error.message : error,
        jobId
      })

      throw new VideoApiError(
        'Stable Video 작업 상태 조회 중 오류가 발생했습니다',
        500,
        'STATUS_CHECK_FAILED',
        'stable-video'
      )
    }
  }

  /**
   * 작업 취소 (Stable Video는 취소 기능 없음)
   */
  async cancelJob(jobId: string): Promise<void> {
    logger.warn('Stable Video는 작업 취소를 지원하지 않습니다', { jobId })
    // 실제로는 아무것도 하지 않지만 에러도 던지지 않음
  }

  /**
   * 사용자 크레딧 조회
   */
  async getCredits(): Promise<{ credits: number }> {
    try {
      const response = await this.makeRequest<{ credits: number }>('/user/account', 'GET')

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Stable Video 크레딧 조회 실패',
          500,
          'CREDITS_CHECK_FAILED',
          'stable-video'
        )
      }

      return response.data
    } catch (error) {
      logger.error('Stable Video 크레딧 조회 실패', {
        error: error instanceof Error ? error.message : error
      })

      throw new VideoApiError(
        'Stable Video 크레딧 조회 중 오류가 발생했습니다',
        500,
        'CREDITS_CHECK_FAILED',
        'stable-video'
      )
    }
  }

  /**
   * FormData 요청 헬퍼
   */
  private async makeRequestFormData<T>(
    endpoint: string,
    formData: FormData
  ): Promise<{ success: boolean; data?: T; error?: any }> {
    const url = `${this.baseUrl}${endpoint}`

    const requestHeaders = {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'VideoPlanet/1.0',
      // Content-Type은 FormData일 때 자동 설정됨
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
        signal: AbortSignal.timeout(this.timeout)
      })

      const responseData = await response.json()

      if (!response.ok) {
        const error = new VideoApiError(
          responseData.message || `HTTP ${response.status}`,
          response.status,
          responseData.id || 'UNKNOWN_ERROR',
          this.providerName,
          this.isRetryableError(response.status)
        )

        logger.error(`${this.providerName} API 오류`, {
          status: response.status,
          error: responseData
        })

        throw error
      }

      return {
        success: true,
        data: responseData
      }
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      throw new VideoApiError(
        error instanceof Error ? error.message : '알 수 없는 오류',
        0,
        'NETWORK_ERROR',
        this.providerName,
        true
      )
    }
  }

  /**
   * 재시도 가능한 오류인지 확인
   */
  private isRetryableError(status: number): boolean {
    return status >= 500 || status === 429 || status === 408
  }

  /**
   * 파라미터를 Stable Video 형식으로 변환
   */
  private convertToStableVideoParams(params: VideoApiParams): StableVideoApiParams {
    return {
      ...params,
      model: 'svd-xt', // 더 긴 영상 생성 가능
      motion_bucket_id: 40, // 중간 정도 모션
      cfg_scale: 2.5, // 기본 guidance scale
      noise: 0.1 // 약간의 노이즈
    }
  }

  /**
   * Stable Video 응답을 표준 형식으로 변환
   */
  private convertToStandardJob(stableJob: StableVideoJobResponse): VideoApiJob {
    const status = this.convertStatus(stableJob.status)
    let resultUrl: string | undefined

    // Base64 데이터를 URL로 변환 (실제로는 별도 저장소에 업로드 필요)
    if (stableJob.artifacts && stableJob.artifacts.length > 0) {
      const artifact = stableJob.artifacts[0]
      if (artifact.base64) {
        // 실제 구현에서는 S3 등에 업로드하고 URL 반환
        resultUrl = `data:video/mp4;base64,${artifact.base64}`
      }
    }

    return {
      id: stableJob.id,
      status,
      progress: this.getDefaultProgress(stableJob.status),
      resultUrl,
      createdAt: stableJob.created_at,
      updatedAt: stableJob.updated_at || new Date().toISOString()
    }
  }

  /**
   * Stable Video 상태를 표준 상태로 변환
   */
  private convertStatus(stableStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (stableStatus) {
      case 'in-progress':
        return 'processing'
      case 'complete':
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
      case 'in-progress':
        return 50
      case 'complete':
        return 100
      case 'failed':
        return 0
      default:
        return 0
    }
  }

  /**
   * Stable Video 전용 최소 요청 간격 (10초)
   */
  protected getMinRequestInterval(): number {
    return 10000
  }

  /**
   * 파라미터 검증 (Stable Video 전용 확장)
   */
  protected validateParams(params: VideoApiParams): void {
    super.validateParams(params)

    // Stable Video는 이미지 입력이 필수
    if (!params.imageUrl) {
      throw new VideoApiError(
        'Stable Video는 입력 이미지가 필수입니다',
        400,
        'IMAGE_REQUIRED',
        'stable-video'
      )
    }

    // Stable Video는 최대 4초까지 지원
    if (params.duration && params.duration > 4) {
      throw new VideoApiError(
        'Stable Video는 최대 4초까지 지원합니다',
        400,
        'DURATION_TOO_LONG',
        'stable-video'
      )
    }
  }
}