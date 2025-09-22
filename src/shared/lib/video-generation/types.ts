/**
 * Video Generation Types & Interfaces
 *
 * 영상 생성 API의 통합 타입 정의
 * CLAUDE.md 준수: FSD shared/lib 레이어, 비용 안전 규칙, 타입 안전성
 */

import { z } from 'zod'

/**
 * 영상 생성 제공업체 타입
 */
export type VideoGenerationProvider = 'runway' | 'seedance' | 'stable-video'

/**
 * 영상 생성 상태
 */
export type VideoGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * 영상 품질 옵션
 */
export type VideoQuality = 'low' | 'medium' | 'high' | 'ultra'

/**
 * 영상 스타일 옵션
 */
export type VideoStyle = 'realistic' | 'cinematic' | 'animation' | 'sketch' | 'artistic'

/**
 * 영상 생성 기본 요청 스키마
 */
export const VideoGenerationRequestSchema = z.object({
  prompt: z.string().min(1, '프롬프트는 필수입니다'),
  imageUrl: z.string().url('유효한 이미지 URL이 필요합니다').optional(),
  duration: z.number().min(1).max(30, '영상 길이는 1-30초 사이여야 합니다').default(5),
  quality: z.enum(['low', 'medium', 'high', 'ultra']).default('medium'),
  style: z.enum(['realistic', 'cinematic', 'animation', 'sketch', 'artistic']).default('realistic'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  fps: z.number().min(12).max(60).default(24),
  seed: z.number().int().min(0).optional(),
  negativePrompt: z.string().optional(),
  motionLevel: z.number().min(0).max(1).default(0.5), // 0=정적, 1=매우 동적
})

/**
 * 영상 생성 응답 스키마
 */
export const VideoGenerationResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().optional(),
  quality: z.enum(['low', 'medium', 'high', 'ultra']),
  style: z.enum(['realistic', 'cinematic', 'animation', 'sketch', 'artistic']),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']),
  fps: z.number(),
  seed: z.number().int().optional(),
  prompt: z.string(),
  imageUrl: z.string().url().optional(),
  progress: z.number().min(0).max(100).default(0),
  estimatedCompletionTime: z.number().optional(), // 예상 완료 시간 (초)
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  provider: z.enum(['runway', 'seedance', 'stable-video']),
  externalJobId: z.string().optional(), // 외부 API의 작업 ID
  cost: z.number().optional(), // 실제 비용
  estimatedCost: z.number().optional(), // 예상 비용
})

/**
 * 제공업체별 설정 스키마
 */
export const ProviderConfigSchema = z.object({
  apiKey: z.string().min(1, 'API 키는 필수입니다'),
  baseUrl: z.string().url().optional(),
  timeout: z.number().min(1000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
  rateLimit: z.object({
    requestsPerMinute: z.number().min(1).default(10),
    requestsPerHour: z.number().min(1).default(100),
    minInterval: z.number().min(1000).default(6000), // 최소 요청 간격 (ms)
  }).default({}),
})

/**
 * 통합 영상 생성 제공업체 인터페이스
 */
export interface VideoGenerationProvider {
  readonly name: VideoGenerationProvider
  readonly supportedFeatures: {
    imageToVideo: boolean
    textToVideo: boolean
    maxDuration: number
    supportedQualities: VideoQuality[]
    supportedStyles: VideoStyle[]
    supportedAspectRatios: Array<'16:9' | '9:16' | '1:1' | '4:3'>
  }

  /**
   * 영상 생성 요청
   */
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse>

  /**
   * 작업 상태 확인
   */
  checkStatus(jobId: string): Promise<VideoGenerationResponse>

  /**
   * 작업 취소
   */
  cancelJob(jobId: string): Promise<boolean>

  /**
   * 사용량 통계 조회
   */
  getUsageStats(): UsageStats

  /**
   * 제공업체 상태 확인
   */
  healthCheck(): Promise<boolean>
}

/**
 * 타입 추론
 */
export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>
export type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

/**
 * 사용량 통계
 */
export interface UsageStats {
  totalCalls: number
  lastCallTime: number
  recentCalls: number // 최근 1분간 호출 수
  hourlyRecentCalls: number // 최근 1시간간 호출 수
  nextAvailableTime: number // 다음 가능한 호출 시간
  timeUntilNextCall: number // 다음 호출까지 남은 시간 (ms)
  totalCost: number // 총 비용
  monthlyCost: number // 이번 달 비용
}

/**
 * 비용 안전 제한 설정
 */
export interface CostSafetyLimits {
  maxDailyCost: number // 일일 최대 비용
  maxMonthlyCost: number // 월간 최대 비용
  maxRequestsPerHour: number // 시간당 최대 요청 수
  minRequestInterval: number // 최소 요청 간격 (ms)
  alertThresholds: {
    dailyCost: number // 일일 비용 경고 임계값
    monthlyCost: number // 월간 비용 경고 임계값
    requestRate: number // 요청률 경고 임계값
  }
}

/**
 * 영상 생성 에러 타입
 */
export class VideoGenerationError extends Error {
  public readonly code: string
  public readonly provider: VideoGenerationProvider
  public readonly retryable: boolean
  public readonly details?: any

  constructor(
    message: string,
    code: string,
    provider: VideoGenerationProvider,
    retryable: boolean = false,
    details?: any
  ) {
    super(message)
    this.name = 'VideoGenerationError'
    this.code = code
    this.provider = provider
    this.retryable = retryable
    this.details = details
  }
}

/**
 * 비용 안전 에러
 */
export class CostSafetyError extends VideoGenerationError {
  constructor(message: string, provider: VideoGenerationProvider, details?: any) {
    super(message, 'COST_SAFETY_VIOLATION', provider, false, details)
    this.name = 'CostSafetyError'
  }
}

/**
 * 할당량 초과 에러
 */
export class QuotaExceededError extends VideoGenerationError {
  constructor(message: string, provider: VideoGenerationProvider, details?: any) {
    super(message, 'QUOTA_EXCEEDED', provider, false, details)
    this.name = 'QuotaExceededError'
  }
}

/**
 * 네트워크 에러
 */
export class NetworkError extends VideoGenerationError {
  constructor(message: string, provider: VideoGenerationProvider, details?: any) {
    super(message, 'NETWORK_ERROR', provider, true, details)
    this.name = 'NetworkError'
  }
}

/**
 * 타임아웃 에러
 */
export class TimeoutError extends VideoGenerationError {
  constructor(message: string, provider: VideoGenerationProvider, details?: any) {
    super(message, 'TIMEOUT_ERROR', provider, true, details)
    this.name = 'TimeoutError'
  }
}