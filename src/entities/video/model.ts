/**
 * Video Generation Domain Model
 *
 * CLAUDE.md 준수: entities 레이어 비즈니스 로직
 * 순수한 도메인 규칙과 검증 로직만 포함
 */

import {
  VideoGeneration,
  VideoGenerationParams,
  VideoGenerationRequest,
  VideoMetadata,
  VideoProvider,
  VideoGenerationStatus,
  VideoConstants,
  Resolution,
  isValidResolution
} from './types'

/**
 * 영상 생성 도메인 서비스
 * 비즈니스 규칙 검증 및 도메인 로직 처리
 */
export class VideoGenerationDomain {
  /**
   * 영상 생성 요청 검증
   */
  static validateGenerationRequest(request: VideoGenerationRequest): ValidationResult {
    const errors: string[] = []

    // 프롬프트 검증
    if (!request.params.prompt?.trim()) {
      errors.push('프롬프트는 필수입니다')
    }

    if (request.params.prompt?.length > VideoConstants.MAX_PROMPT_LENGTH) {
      errors.push(`프롬프트는 ${VideoConstants.MAX_PROMPT_LENGTH}자를 초과할 수 없습니다`)
    }

    // 길이 검증
    if (request.params.duration && request.params.duration > VideoConstants.MAX_DURATION_SECONDS) {
      errors.push(`영상 길이는 ${VideoConstants.MAX_DURATION_SECONDS}초를 초과할 수 없습니다`)
    }

    if (request.params.duration && request.params.duration <= 0) {
      errors.push('영상 길이는 0보다 커야 합니다')
    }

    // 해상도 검증
    if (request.params.resolution && !isValidResolution(request.params.resolution)) {
      errors.push('유효하지 않은 해상도입니다')
    }

    // 이미지 URL 검증
    if (request.params.imageUrl && !this.isValidImageUrl(request.params.imageUrl)) {
      errors.push('유효하지 않은 이미지 URL입니다')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 영상 생성 파라미터 정규화
   */
  static normalizeGenerationParams(params: VideoGenerationParams): VideoGenerationParams {
    return {
      prompt: params.prompt.trim(),
      imageUrl: params.imageUrl,
      duration: params.duration || VideoConstants.DEFAULT_DURATION,
      resolution: params.resolution || VideoConstants.DEFAULT_RESOLUTION,
      aspectRatio: params.aspectRatio || VideoConstants.DEFAULT_ASPECT_RATIO,
      seed: params.seed
    }
  }

  /**
   * 영상 생성 예상 시간 계산
   */
  static estimateGenerationTime(
    provider: VideoProvider,
    params: VideoGenerationParams
  ): number {
    const baseTimes = {
      runway: 60,      // 60초 기본
      seedance: 45,    // 45초 기본
      'stable-video': 30 // 30초 기본
    }

    const baseTime = baseTimes[provider] || 60
    const durationMultiplier = (params.duration || VideoConstants.DEFAULT_DURATION) / 5
    const resolutionMultiplier = this.getResolutionMultiplier(params.resolution)

    return Math.round(baseTime * durationMultiplier * resolutionMultiplier)
  }

  /**
   * 영상 생성 상태 전이 검증
   */
  static canTransitionTo(
    currentStatus: VideoGenerationStatus,
    newStatus: VideoGenerationStatus
  ): boolean {
    const allowedTransitions: Record<VideoGenerationStatus, VideoGenerationStatus[]> = {
      pending: ['processing', 'cancelled', 'failed'],
      processing: ['completed', 'failed', 'cancelled'],
      completed: [], // 완료 상태에서는 전이 불가
      failed: ['pending'], // 재시도를 위해 pending으로만 전이 가능
      cancelled: ['pending'] // 재시작을 위해 pending으로만 전이 가능
    }

    return allowedTransitions[currentStatus]?.includes(newStatus) || false
  }

  /**
   * 영상 생성 우선순위 계산
   */
  static calculatePriority(
    provider: VideoProvider,
    userTier: UserTier = 'basic'
  ): number {
    const tierMultipliers = {
      premium: 0.5,
      pro: 0.7,
      basic: 1.0
    }

    const providerBasePriority = {
      runway: VideoConstants.PRIORITY.NORMAL,
      seedance: VideoConstants.PRIORITY.NORMAL,
      'stable-video': VideoConstants.PRIORITY.LOW // 느리지만 무료
    }

    return Math.round(
      providerBasePriority[provider] * tierMultipliers[userTier]
    )
  }

  /**
   * 메타데이터 생성
   */
  static createMetadata(
    params: VideoGenerationParams,
    provider: VideoProvider
  ): VideoMetadata {
    const normalizedParams = this.normalizeGenerationParams(params)
    const estimatedTime = this.estimateGenerationTime(provider, normalizedParams)

    return {
      duration: normalizedParams.duration,
      resolution: normalizedParams.resolution,
      format: 'mp4', // 모든 제공업체에서 지원
      estimatedTime,
      fps: 24, // 기본 FPS
      aspectRatio: normalizedParams.aspectRatio
    }
  }

  /**
   * 재시도 가능 여부 확인
   */
  static canRetry(
    videoGeneration: VideoGeneration,
    maxRetries: number = VideoConstants.MAX_RETRIES
  ): boolean {
    // 실패 상태이고 최대 재시도 횟수를 초과하지 않은 경우
    if (videoGeneration.status !== 'failed') return false

    // 메타데이터에서 재시도 횟수 확인 (임시로 metadata 활용)
    const retryCount = (videoGeneration.metadata as any)?.retryCount || 0
    return retryCount < maxRetries
  }

  /**
   * 진행률 계산
   */
  static calculateProgress(
    status: VideoGenerationStatus,
    elapsedTime: number,
    estimatedTime: number
  ): number {
    switch (status) {
      case 'pending':
        return 0

      case 'processing':
        if (estimatedTime <= 0) return 50 // 기본값
        const progress = Math.min((elapsedTime / estimatedTime) * 100, 95)
        return Math.round(progress)

      case 'completed':
        return 100

      case 'failed':
      case 'cancelled':
        return 0

      default:
        return 0
    }
  }

  // Private 헬퍼 메서드들

  private static isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  private static getResolutionMultiplier(resolution?: Resolution): number {
    if (!resolution) return 1.0

    const pixelCount = resolution.width * resolution.height
    const basePixelCount = VideoConstants.DEFAULT_RESOLUTION.width *
                          VideoConstants.DEFAULT_RESOLUTION.height

    return Math.sqrt(pixelCount / basePixelCount)
  }
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly errors: string[]
}

/**
 * 사용자 등급
 */
export type UserTier = 'basic' | 'pro' | 'premium'

/**
 * 영상 생성 팩토리
 */
export class VideoGenerationFactory {
  /**
   * 새 영상 생성 엔티티 생성
   */
  static create(request: VideoGenerationRequest): VideoGeneration {
    const normalizedParams = VideoGenerationDomain.normalizeGenerationParams(request.params)
    const metadata = VideoGenerationDomain.createMetadata(normalizedParams, request.provider)
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      scenarioId: request.scenarioId,
      projectId: request.projectId,
      userId: '', // 실제 구현에서는 인증 컨텍스트에서 가져옴
      status: 'pending',
      inputPrompt: normalizedParams.prompt,
      inputImageUrl: normalizedParams.imageUrl,
      inputParams: normalizedParams,
      provider: request.provider,
      metadata,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    }
  }

  /**
   * 상태 업데이트된 영상 생성 엔티티 생성
   */
  static updateStatus(
    videoGeneration: VideoGeneration,
    newStatus: VideoGenerationStatus,
    additionalData?: Partial<VideoGeneration>
  ): VideoGeneration {
    if (!VideoGenerationDomain.canTransitionTo(videoGeneration.status, newStatus)) {
      throw new Error(
        `Invalid status transition: ${videoGeneration.status} -> ${newStatus}`
      )
    }

    return {
      ...videoGeneration,
      ...additionalData,
      status: newStatus,
      updatedAt: new Date(),
      completedAt: newStatus === 'completed' ? new Date() : videoGeneration.completedAt
    }
  }
}

/**
 * 영상 생성 집계 서비스
 */
export class VideoGenerationAggregates {
  /**
   * 사용자별 일일 생성 한도 확인
   */
  static checkDailyLimit(
    userGenerationsToday: number,
    userTier: UserTier
  ): { allowed: boolean; remaining: number } {
    const limits = {
      basic: 5,
      pro: 25,
      premium: 100
    }

    const limit = limits[userTier]
    const remaining = Math.max(0, limit - userGenerationsToday)

    return {
      allowed: userGenerationsToday < limit,
      remaining
    }
  }

  /**
   * 프로젝트별 진행 상황 요약
   */
  static summarizeProjectProgress(
    videoGenerations: VideoGeneration[]
  ): ProjectProgressSummary {
    const statusCounts = videoGenerations.reduce((acc, vg) => {
      acc[vg.status] = (acc[vg.status] || 0) + 1
      return acc
    }, {} as Record<VideoGenerationStatus, number>)

    const total = videoGenerations.length
    const completed = statusCounts.completed || 0
    const failed = statusCounts.failed || 0
    const processing = statusCounts.processing || 0

    return {
      total,
      completed,
      failed,
      processing,
      pending: statusCounts.pending || 0,
      cancelled: statusCounts.cancelled || 0,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0
    }
  }
}

/**
 * 프로젝트 진행 상황 요약
 */
export interface ProjectProgressSummary {
  readonly total: number
  readonly completed: number
  readonly failed: number
  readonly processing: number
  readonly pending: number
  readonly cancelled: number
  readonly completionRate: number
  readonly failureRate: number
}