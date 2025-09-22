/**
 * ByteDance Seedream-4.0 API Client
 *
 * ByteDance Seedream-4.0 API를 사용한 AI 이미지 생성 클라이언트
 * CLAUDE.md 준수: FSD shared/lib 레이어, 비용 안전 규칙 ($300 사건 방지)
 */

import { z } from 'zod'
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationStyle
} from '../../entities/scenario'

/**
 * Seedream API 설정
 */
const SEEDREAM_CONFIG = {
  API_URL: process.env.SEEDREAM_API_URL || 'https://api.seedream.bytedance.com/v1',
  GENERATE_ENDPOINT: '/image/generate',
  TIMEOUT: 30000, // 30초 타임아웃
  MAX_RETRIES: 3
} as const

/**
 * Seedream API 요청 스키마
 */
const SeedreamRequestSchema = z.object({
  prompt: z.string().min(1, '프롬프트는 필수입니다'),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  reference_image_url: z.string().url().optional(),
  aspect_ratio: z.enum(['16:9', '4:3', '1:1', '9:16']).optional(),
  seed: z.number().int().min(0).optional(),
  model: z.literal('seedream-4.0').default('seedream-4.0')
})

/**
 * Seedream API 응답 스키마
 */
const SeedreamResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    image_url: z.string().url(),
    seed: z.number().int(),
    style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
    prompt: z.string(),
    reference_image_url: z.string().url().optional(),
    created_at: z.string()
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional()
})

/**
 * 비용 안전 미들웨어 (Seedream 특화)
 * $300 사건 방지를 위한 엄격한 제한
 */
class SeedreamCostSafetyMiddleware {
  private static lastCallTime = 0
  private static callCount = 0
  private static readonly MIN_INTERVAL = 12000 // 12초 최소 간격 (Gemini보다 더 엄격)
  private static readonly MAX_CALLS_PER_MINUTE = 5 // 분당 5회 제한
  private static readonly MAX_CALLS_PER_HOUR = 50 // 시간당 50회 제한
  private static readonly callTimes: number[] = []
  private static readonly hourlyCallTimes: number[] = []

  static async checkSafety(): Promise<void> {
    const now = Date.now()

    // 1. 최소 간격 체크 (12초 - 이미지 생성은 더 비싸므로 더 엄격)
    if (now - this.lastCallTime < this.MIN_INTERVAL) {
      throw new Error(`Seedream API 호출 간격이 너무 짧습니다. ${this.MIN_INTERVAL/1000}초 후 다시 시도해주세요.`)
    }

    // 2. 분당 호출 횟수 체크
    this.callTimes.push(now)
    this.callTimes.splice(0, this.callTimes.length - this.MAX_CALLS_PER_MINUTE)

    const recentCalls = this.callTimes.filter(time => now - time < 60000)
    if (recentCalls.length >= this.MAX_CALLS_PER_MINUTE) {
      throw new Error(`Seedream API 분당 호출 한도(${this.MAX_CALLS_PER_MINUTE}회)를 초과했습니다. 1분 후 다시 시도해주세요.`)
    }

    // 3. 시간당 호출 횟수 체크
    this.hourlyCallTimes.push(now)
    this.hourlyCallTimes.splice(0, this.hourlyCallTimes.length - this.MAX_CALLS_PER_HOUR)

    const hourlyRecentCalls = this.hourlyCallTimes.filter(time => now - time < 3600000)
    if (hourlyRecentCalls.length >= this.MAX_CALLS_PER_HOUR) {
      throw new Error(`Seedream API 시간당 호출 한도(${this.MAX_CALLS_PER_HOUR}회)를 초과했습니다. 1시간 후 다시 시도해주세요.`)
    }

    this.lastCallTime = now
    this.callCount++
  }

  static getStats() {
    const now = Date.now()
    return {
      totalCalls: this.callCount,
      lastCallTime: this.lastCallTime,
      recentCalls: this.callTimes.filter(time => now - time < 60000).length,
      hourlyRecentCalls: this.hourlyCallTimes.filter(time => now - time < 3600000).length,
      nextAvailableTime: this.lastCallTime + this.MIN_INTERVAL,
      timeUntilNextCall: Math.max(0, (this.lastCallTime + this.MIN_INTERVAL) - now)
    }
  }

  static reset(): void {
    this.lastCallTime = 0
    this.callCount = 0
    this.callTimes.length = 0
    this.hourlyCallTimes.length = 0
  }
}

/**
 * Seedream API 클라이언트 클래스
 */
export class SeedreamClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.SEEDREAM_API_KEY || ''
    this.baseUrl = baseUrl || SEEDREAM_CONFIG.API_URL

    if (!this.apiKey) {
      throw new Error('SEEDREAM_API_KEY가 설정되지 않았습니다.')
    }
  }

  /**
   * AI 이미지 생성
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // 비용 안전 체크 (최우선)
    await SeedreamCostSafetyMiddleware.checkSafety()

    // 요청 검증
    const validatedRequest = SeedreamRequestSchema.parse({
      prompt: request.prompt,
      style: request.style,
      reference_image_url: request.referenceImageUrl,
      aspect_ratio: request.aspectRatio,
      seed: request.seed,
      model: 'seedream-4.0'
    })

    let lastError: Error | null = null

    // 재시도 로직
    for (let attempt = 1; attempt <= SEEDREAM_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), SEEDREAM_CONFIG.TIMEOUT)

        const response = await fetch(`${this.baseUrl}${SEEDREAM_CONFIG.GENERATE_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'VideoPlanet-SeedreamClient/1.0.0'
          },
          body: JSON.stringify(validatedRequest),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Seedream API 오류 (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        const validatedResponse = SeedreamResponseSchema.parse(data)

        if (!validatedResponse.success || !validatedResponse.data) {
          throw new Error(
            validatedResponse.error?.message ||
            'Seedream API에서 알 수 없는 오류가 발생했습니다.'
          )
        }

        // 성공적인 응답 변환
        return {
          imageUrl: validatedResponse.data.image_url,
          seed: validatedResponse.data.seed,
          style: validatedResponse.data.style,
          prompt: validatedResponse.data.prompt,
          referenceImageUrl: validatedResponse.data.reference_image_url,
          generatedAt: new Date(validatedResponse.data.created_at)
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // 마지막 시도가 아니면 잠시 대기 후 재시도
        if (attempt < SEEDREAM_CONFIG.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 지수 백오프 (최대 5초)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // 모든 재시도 실패 (테스트 환경에서는 로그 출력 안함)
    if (process.env.NODE_ENV !== 'test') {
      console.error('Seedream API 호출 실패:', lastError)
    }
    throw new Error(
      lastError
        ? `이미지 생성 실패 (${SEEDREAM_CONFIG.MAX_RETRIES}회 재시도): ${lastError.message}`
        : '이미지 생성 중 알 수 없는 오류가 발생했습니다.'
    )
  }

  /**
   * 일관성 유지를 위한 연속 이미지 생성
   * 첫 번째 이미지를 참조로 사용하여 스타일 일관성 보장
   */
  async generateConsistentImages(
    prompts: string[],
    baseStyle: ImageGenerationStyle,
    referenceImageUrl?: string
  ): Promise<ImageGenerationResponse[]> {
    if (prompts.length === 0) {
      throw new Error('최소 하나의 프롬프트가 필요합니다.')
    }

    const results: ImageGenerationResponse[] = []
    let currentReferenceUrl = referenceImageUrl

    for (let i = 0; i < prompts.length; i++) {
      const request: ImageGenerationRequest = {
        prompt: prompts[i],
        style: baseStyle,
        referenceImageUrl: currentReferenceUrl,
        aspectRatio: '16:9' // 비디오용 기본 비율
      }

      const result = await this.generateImage(request)
      results.push(result)

      // 첫 번째 생성된 이미지를 다음 이미지들의 참조로 사용
      if (i === 0 && !currentReferenceUrl) {
        currentReferenceUrl = result.imageUrl
      }
    }

    return results
  }

  /**
   * API 사용 통계 조회
   */
  getUsageStats() {
    return SeedreamCostSafetyMiddleware.getStats()
  }

  /**
   * 안전 제한 재설정 (테스트용)
   */
  resetSafetyLimits(): void {
    SeedreamCostSafetyMiddleware.reset()
  }

  /**
   * 테스트용 미들웨어 접근
   */
  static getCostSafetyMiddleware() {
    return SeedreamCostSafetyMiddleware
  }
}

/**
 * 기본 Seedream 클라이언트 인스턴스
 */
export const seedreamClient = (() => {
  try {
    return new SeedreamClient()
  } catch (error) {
    // 테스트 환경이나 API 키가 없는 경우 null 반환
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Seedream 클라이언트 초기화 실패:', error)
    }
    return null
  }
})()

/**
 * 비용 안전 통계 조회 함수
 */
export const getSeedreamUsageStats = () => {
  if (!seedreamClient) {
    throw new Error('Seedream 클라이언트가 초기화되지 않았습니다. SEEDREAM_API_KEY를 확인하세요.')
  }
  return seedreamClient.getUsageStats()
}

/**
 * 단순화된 API 함수들
 */
export const generateImageWithSeedream = (request: ImageGenerationRequest) => {
  if (!seedreamClient) {
    throw new Error('Seedream 클라이언트가 초기화되지 않았습니다. SEEDREAM_API_KEY를 확인하세요.')
  }
  return seedreamClient.generateImage(request)
}

export const generateConsistentImagesWithSeedream = (
  prompts: string[],
  style: ImageGenerationStyle,
  referenceImageUrl?: string
) => {
  if (!seedreamClient) {
    throw new Error('Seedream 클라이언트가 초기화되지 않았습니다. SEEDREAM_API_KEY를 확인하세요.')
  }
  return seedreamClient.generateConsistentImages(prompts, style, referenceImageUrl)
}

/**
 * 스타일별 최적화된 생성 함수들
 */
export const generatePencilSketch = (prompt: string, referenceImageUrl?: string) => {
  return generateImageWithSeedream({
    prompt,
    style: 'pencil',
    referenceImageUrl,
    aspectRatio: '16:9'
  })
}

export const generateColoredImage = (prompt: string, referenceImageUrl?: string) => {
  return generateImageWithSeedream({
    prompt,
    style: 'colored',
    referenceImageUrl,
    aspectRatio: '16:9'
  })
}

export const generateRoughSketch = (prompt: string, referenceImageUrl?: string) => {
  return generateImageWithSeedream({
    prompt,
    style: 'rough',
    referenceImageUrl,
    aspectRatio: '16:9'
  })
}

export const generateMonochromeImage = (prompt: string, referenceImageUrl?: string) => {
  return generateImageWithSeedream({
    prompt,
    style: 'monochrome',
    referenceImageUrl,
    aspectRatio: '16:9'
  })
}