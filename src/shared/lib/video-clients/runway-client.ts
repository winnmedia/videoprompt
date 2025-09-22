/**
 * Runway ML Video Generation Client
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * Runway ML API를 통한 영상 생성 클라이언트
 */

import { BaseVideoClient, VideoApiParams, VideoApiJob, VideoApiError } from './base-client'
import logger from '../logger'

/**
 * Runway API 전용 파라미터
 */
interface RunwayApiParams extends VideoApiParams {
  model?: 'gen3a_turbo' | 'gen3a'
  motionBrush?: {
    areas: Array<{
      coordinates: number[]
      description: string
    }>
  }
  cameraPan?: 'left' | 'right' | 'up' | 'down' | 'zoom_in' | 'zoom_out'
}

/**
 * Runway API 응답 형식
 */
interface RunwayJobResponse {
  id: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  progress?: number
  createdAt: string
  output?: string[]
  failure?: string
  failure_code?: string
  eta?: number
}

/**
 * Runway ML 클라이언트
 */
export class RunwayClient extends BaseVideoClient {
  constructor() {
    const apiKey = process.env.RUNWAY_API_KEY
    if (!apiKey) {
      throw new Error('RUNWAY_API_KEY 환경변수가 설정되지 않았습니다')
    }

    super(
      'https://api.runwayml.com/v1',
      apiKey,
      'runway',
      120000 // 2분 타임아웃 (영상 생성은 시간이 오래 걸림)
    )
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(params: VideoApiParams): Promise<VideoApiJob> {
    this.validateParams(params)
    this.checkRateLimit()

    const runwayParams = this.convertToRunwayParams(params)

    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<RunwayJobResponse>('/image_to_video', 'POST', {
          promptImage: runwayParams.imageUrl,
          promptText: runwayParams.prompt,
          model: runwayParams.model || 'gen3a_turbo',
          duration: runwayParams.duration || 5,
          ratio: this.convertAspectRatio(runwayParams.aspectRatio),
          seed: runwayParams.seed,
          watermark: false,
          enhance_prompt: true,
          callback_url: runwayParams.webhookUrl
        })
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Runway API 응답이 올바르지 않습니다',
          500,
          'INVALID_RESPONSE',
          'runway'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Runway 영상 생성 실패', {
        error: error instanceof Error ? error.message : error,
        params: runwayParams
      })

      throw new VideoApiError(
        'Runway 영상 생성 중 오류가 발생했습니다',
        500,
        'GENERATION_FAILED',
        'runway'
      )
    }
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<VideoApiJob> {
    try {
      const response = await this.withRetry(async () => {
        return this.makeRequest<RunwayJobResponse>(`/tasks/${jobId}`, 'GET')
      })

      if (!response.success || !response.data) {
        throw new VideoApiError(
          'Runway 작업 상태 조회 실패',
          404,
          'JOB_NOT_FOUND',
          'runway'
        )
      }

      return this.convertToStandardJob(response.data)
    } catch (error) {
      if (error instanceof VideoApiError) {
        throw error
      }

      logger.error('Runway 상태 조회 실패', {
        error: error instanceof Error ? error.message : error,
        jobId
      })

      throw new VideoApiError(
        'Runway 작업 상태 조회 중 오류가 발생했습니다',
        500,
        'STATUS_CHECK_FAILED',
        'runway'
      )
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      await this.withRetry(async () => {
        return this.makeRequest(`/tasks/${jobId}/cancel`, 'POST')
      })

      logger.info('Runway 작업 취소됨', { jobId })
    } catch (error) {
      logger.error('Runway 작업 취소 실패', {
        error: error instanceof Error ? error.message : error,
        jobId
      })

      throw new VideoApiError(
        'Runway 작업 취소 중 오류가 발생했습니다',
        500,
        'CANCEL_FAILED',
        'runway'
      )
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Runway API는 별도 헬스체크 엔드포인트가 없으므로
      // 사용자 정보 조회로 대체
      await this.makeRequest('/me', 'GET')
      return true
    } catch (error) {
      logger.warn('Runway 헬스체크 실패', {
        error: error instanceof Error ? error.message : error
      })
      return false
    }
  }

  /**
   * 파라미터를 Runway 형식으로 변환
   */
  private convertToRunwayParams(params: VideoApiParams): RunwayApiParams & { webhookUrl: string } {
    return {
      ...params,
      model: 'gen3a_turbo', // 기본 모델
      webhookUrl: this.createWebhookUrl(crypto.randomUUID())
    }
  }

  /**
   * 화면 비율을 Runway 형식으로 변환
   */
  private convertAspectRatio(aspectRatio?: string): string {
    switch (aspectRatio) {
      case '16:9':
        return '1408:768'
      case '9:16':
        return '768:1408'
      case '1:1':
        return '768:768'
      case '4:3':
        return '1024:768'
      case '3:4':
        return '768:1024'
      default:
        return '1408:768' // 기본값 16:9
    }
  }

  /**
   * Runway 응답을 표준 형식으로 변환
   */
  private convertToStandardJob(runwayJob: RunwayJobResponse): VideoApiJob {
    const status = this.convertStatus(runwayJob.status)

    return {
      id: runwayJob.id,
      status,
      progress: this.calculateProgress(runwayJob.status, runwayJob.progress),
      estimatedTime: runwayJob.eta,
      resultUrl: runwayJob.output?.[0], // 첫 번째 결과 URL
      error: runwayJob.failure,
      createdAt: runwayJob.createdAt,
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * Runway 상태를 표준 상태로 변환
   */
  private convertStatus(runwayStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (runwayStatus) {
      case 'PENDING':
        return 'pending'
      case 'RUNNING':
        return 'processing'
      case 'SUCCEEDED':
        return 'completed'
      case 'FAILED':
        return 'failed'
      default:
        return 'pending'
    }
  }

  /**
   * 진행률 계산
   */
  private calculateProgress(status: string, progress?: number): number {
    if (progress !== undefined) {
      return Math.round(progress * 100)
    }

    switch (status) {
      case 'PENDING':
        return 0
      case 'RUNNING':
        return 50 // 기본값
      case 'SUCCEEDED':
        return 100
      case 'FAILED':
        return 0
      default:
        return 0
    }
  }

  /**
   * Runway 전용 최소 요청 간격 (5초)
   */
  protected getMinRequestInterval(): number {
    return 5000
  }
}