/**
 * Video Generation Manager
 *
 * 팩토리 패턴을 사용한 통합 영상 생성 클라이언트 관리자
 * CLAUDE.md 준수: FSD shared/lib 레이어, 비용 안전 규칙, 타입 안전성
 */

import {
  type VideoGenerationProvider as IVideoGenerationProvider,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type ProviderConfig,
  type UsageStats,
  type VideoGenerationProvider as ProviderType,
  VideoGenerationError,
  CostSafetyError,
  QuotaExceededError
} from './types'
import { RunwayClient } from './runway-client'
import { SeedanceClient } from './seedance-client'
import { StableVideoClient } from './stable-video-client'

/**
 * 제공업체별 가중치 및 우선순위 설정
 */
interface ProviderPreference {
  provider: ProviderType
  weight: number // 높을수록 우선순위
  enabled: boolean
  costPerSecond: number // 초당 비용 (USD)
  avgQualityScore: number // 1-10 품질 점수
  avgProcessingTime: number // 평균 처리 시간 (초)
}

/**
 * 로드 밸런싱 전략
 */
type LoadBalancingStrategy = 'round-robin' | 'cost-optimized' | 'quality-first' | 'speed-first' | 'manual'

/**
 * 영상 생성 매니저 설정
 */
interface VideoGenerationManagerConfig {
  defaultProvider?: ProviderType
  loadBalancingStrategy?: LoadBalancingStrategy
  enableFailover?: boolean
  maxRetries?: number
  providers?: {
    runway?: ProviderConfig
    seedance?: ProviderConfig
    stableVideo?: ProviderConfig
  }
  preferences?: ProviderPreference[]
}

/**
 * 영상 생성 통합 관리자
 */
export class VideoGenerationManager {
  private clients = new Map<ProviderType, IVideoGenerationProvider>()
  private preferences: ProviderPreference[] = []
  private loadBalancingStrategy: LoadBalancingStrategy = 'cost-optimized'
  private enableFailover = true
  private maxRetries = 3
  private roundRobinIndex = 0

  constructor(config?: VideoGenerationManagerConfig) {
    this.loadBalancingStrategy = config?.loadBalancingStrategy || 'cost-optimized'
    this.enableFailover = config?.enableFailover ?? true
    this.maxRetries = config?.maxRetries ?? 3

    // 기본 제공업체 우선순위 설정
    this.preferences = config?.preferences || [
      {
        provider: 'seedance',
        weight: 8,
        enabled: true,
        costPerSecond: 0.006, // $0.006/초
        avgQualityScore: 7.5,
        avgProcessingTime: 180
      },
      {
        provider: 'runway',
        weight: 9,
        enabled: true,
        costPerSecond: 0.010, // $0.010/초
        avgQualityScore: 9.0,
        avgProcessingTime: 120
      },
      {
        provider: 'stable-video',
        weight: 6,
        enabled: true,
        costPerSecond: 0.040, // $0.040/초 (짧은 영상이지만 고정 비용)
        avgQualityScore: 8.0,
        avgProcessingTime: 300
      }
    ]

    // 클라이언트 초기화
    this.initializeClients(config?.providers)
  }

  /**
   * 클라이언트 초기화
   */
  private initializeClients(providerConfigs?: VideoGenerationManagerConfig['providers']): void {
    // Runway 클라이언트
    try {
      const runwayClient = new RunwayClient(providerConfigs?.runway)
      this.clients.set('runway', runwayClient)
    } catch (error) {
      console.warn('Runway 클라이언트 초기화 실패:', error)
    }

    // Seedance 클라이언트
    try {
      const seedanceClient = new SeedanceClient(providerConfigs?.seedance)
      this.clients.set('seedance', seedanceClient)
    } catch (error) {
      console.warn('Seedance 클라이언트 초기화 실패:', error)
    }

    // Stable Video 클라이언트
    try {
      const stableVideoClient = new StableVideoClient(providerConfigs?.stableVideo)
      this.clients.set('stable-video', stableVideoClient)
    } catch (error) {
      console.warn('Stable Video 클라이언트 초기화 실패:', error)
    }
  }

  /**
   * 영상 생성 (자동 제공업체 선택)
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const availableProviders = this.getAvailableProviders(request)

    if (availableProviders.length === 0) {
      throw new VideoGenerationError(
        '사용 가능한 영상 생성 제공업체가 없습니다.',
        'NO_PROVIDERS_AVAILABLE',
        'seedance' // 기본값
      )
    }

    let lastError: Error | null = null

    // 선택된 제공업체들로 순차 시도
    for (const provider of availableProviders) {
      try {
        const client = this.clients.get(provider)
        if (!client) continue

        console.log(`🎬 ${provider}로 영상 생성 시도 중...`)
        const result = await client.generateVideo(request)

        // 성공 시 제공업체 우선순위 업데이트 (선택사항)
        this.updateProviderPreference(provider, true)

        return result

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // 비용 안전 오류나 할당량 초과는 다른 제공업체로 시도
        if (error instanceof CostSafetyError || error instanceof QuotaExceededError) {
          console.warn(`⚠️ ${provider} 제한 도달, 다음 제공업체로 시도...`)
          this.updateProviderPreference(provider, false)
          continue
        }

        // Failover가 비활성화된 경우 즉시 실패
        if (!this.enableFailover) {
          break
        }

        console.warn(`❌ ${provider} 실패:`, error instanceof Error ? error.message : error)
        this.updateProviderPreference(provider, false)
      }
    }

    // 모든 제공업체 실패
    throw new VideoGenerationError(
      lastError
        ? `모든 영상 생성 제공업체 실패: ${lastError.message}`
        : '영상 생성에 실패했습니다.',
      'ALL_PROVIDERS_FAILED',
      availableProviders[0] || 'seedance',
      false,
      { availableProviders, lastError }
    )
  }

  /**
   * 특정 제공업체로 영상 생성
   */
  async generateVideoWithProvider(
    provider: ProviderType,
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResponse> {
    const client = this.clients.get(provider)
    if (!client) {
      throw new VideoGenerationError(
        `${provider} 클라이언트가 초기화되지 않았습니다.`,
        'PROVIDER_NOT_AVAILABLE',
        provider
      )
    }

    return await client.generateVideo(request)
  }

  /**
   * 작업 상태 확인
   */
  async checkStatus(provider: ProviderType, jobId: string): Promise<VideoGenerationResponse> {
    const client = this.clients.get(provider)
    if (!client) {
      throw new VideoGenerationError(
        `${provider} 클라이언트가 초기화되지 않았습니다.`,
        'PROVIDER_NOT_AVAILABLE',
        provider
      )
    }

    return await client.checkStatus(jobId)
  }

  /**
   * 작업 취소
   */
  async cancelJob(provider: ProviderType, jobId: string): Promise<boolean> {
    const client = this.clients.get(provider)
    if (!client) {
      return false
    }

    return await client.cancelJob(jobId)
  }

  /**
   * 전체 사용량 통계 조회
   */
  getAllUsageStats(): Record<ProviderType, UsageStats | null> {
    const stats: Record<ProviderType, UsageStats | null> = {
      runway: null,
      seedance: null,
      'stable-video': null
    }

    for (const [provider, client] of this.clients) {
      try {
        stats[provider] = client.getUsageStats()
      } catch (error) {
        console.warn(`${provider} 통계 조회 실패:`, error)
        stats[provider] = null
      }
    }

    return stats
  }

  /**
   * 제공업체 상태 확인
   */
  async getProviderHealthStatus(): Promise<Record<ProviderType, boolean>> {
    const healthStatus: Record<ProviderType, boolean> = {
      runway: false,
      seedance: false,
      'stable-video': false
    }

    const healthChecks = Array.from(this.clients.entries()).map(async ([provider, client]) => {
      try {
        healthStatus[provider] = await client.healthCheck()
      } catch {
        healthStatus[provider] = false
      }
    })

    await Promise.allSettled(healthChecks)
    return healthStatus
  }

  /**
   * 요청에 적합한 사용 가능한 제공업체 목록 반환
   */
  private getAvailableProviders(request: VideoGenerationRequest): ProviderType[] {
    // 요청 요구사항에 따라 필터링
    const suitableProviders = this.preferences
      .filter(pref => {
        if (!pref.enabled) return false

        const client = this.clients.get(pref.provider)
        if (!client) return false

        const features = client.supportedFeatures

        // 이미지가 없으면 textToVideo가 필요
        if (!request.imageUrl && !features.textToVideo) return false

        // 이미지가 있으면 imageToVideo가 필요
        if (request.imageUrl && !features.imageToVideo) return false

        // 최대 길이 체크
        if (request.duration > features.maxDuration) return false

        // 품질 지원 체크
        if (!features.supportedQualities.includes(request.quality as any)) return false

        // 화면 비율 지원 체크
        if (!features.supportedAspectRatios.includes(request.aspectRatio as any)) return false

        return true
      })
      .sort((a, b) => {
        return this.compareProviders(a, b, request)
      })
      .map(pref => pref.provider)

    return suitableProviders
  }

  /**
   * 제공업체 비교 (로드 밸런싱 전략에 따라)
   */
  private compareProviders(
    a: ProviderPreference,
    b: ProviderPreference,
    request: VideoGenerationRequest
  ): number {
    switch (this.loadBalancingStrategy) {
      case 'cost-optimized':
        // 비용 효율성 우선 (비용/품질 비율)
        const aCostEfficiency = a.costPerSecond / a.avgQualityScore
        const bCostEfficiency = b.costPerSecond / b.avgQualityScore
        return aCostEfficiency - bCostEfficiency

      case 'quality-first':
        // 품질 우선
        return b.avgQualityScore - a.avgQualityScore

      case 'speed-first':
        // 처리 속도 우선
        return a.avgProcessingTime - b.avgProcessingTime

      case 'round-robin':
        // 라운드 로빈 (가중치 고려)
        return b.weight - a.weight

      case 'manual':
        // 수동 설정된 가중치 우선
        return b.weight - a.weight

      default:
        return b.weight - a.weight
    }
  }

  /**
   * 제공업체 우선순위 업데이트 (성공/실패에 따라)
   */
  private updateProviderPreference(provider: ProviderType, success: boolean): void {
    const preference = this.preferences.find(p => p.provider === provider)
    if (!preference) return

    if (success) {
      // 성공 시 가중치 증가 (최대 10)
      preference.weight = Math.min(preference.weight + 0.1, 10)
    } else {
      // 실패 시 가중치 감소 (최소 1)
      preference.weight = Math.max(preference.weight - 0.5, 1)
    }
  }

  /**
   * 제공업체 활성화/비활성화
   */
  setProviderEnabled(provider: ProviderType, enabled: boolean): void {
    const preference = this.preferences.find(p => p.provider === provider)
    if (preference) {
      preference.enabled = enabled
    }
  }

  /**
   * 로드 밸런싱 전략 변경
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy
  }

  /**
   * 제공업체 정보 조회
   */
  getProviderInfo(): Array<{
    provider: ProviderType
    enabled: boolean
    weight: number
    features: any
    isAvailable: boolean
  }> {
    return this.preferences.map(pref => {
      const client = this.clients.get(pref.provider)
      return {
        provider: pref.provider,
        enabled: pref.enabled,
        weight: pref.weight,
        features: client?.supportedFeatures || null,
        isAvailable: !!client
      }
    })
  }

  /**
   * 테스트용 메소드들
   */
  resetAllSafetyLimits(): void {
    for (const client of this.clients.values()) {
      if ('resetSafetyLimits' in client && typeof client.resetSafetyLimits === 'function') {
        (client as any).resetSafetyLimits()
      }
    }
  }

  getClient(provider: ProviderType): IVideoGenerationProvider | undefined {
    return this.clients.get(provider)
  }
}

/**
 * 기본 영상 생성 매니저 인스턴스
 */
export const videoGenerationManager = new VideoGenerationManager()

/**
 * 단순화된 API 함수들
 */
export const generateVideo = (request: VideoGenerationRequest) => {
  return videoGenerationManager.generateVideo(request)
}

export const generateVideoWith = (provider: ProviderType, request: VideoGenerationRequest) => {
  return videoGenerationManager.generateVideoWithProvider(provider, request)
}

export const checkVideoStatus = (provider: ProviderType, jobId: string) => {
  return videoGenerationManager.checkStatus(provider, jobId)
}

export const cancelVideoJob = (provider: ProviderType, jobId: string) => {
  return videoGenerationManager.cancelJob(provider, jobId)
}

export const getVideoGenerationStats = () => {
  return videoGenerationManager.getAllUsageStats()
}

export const getVideoProviderStatus = () => {
  return videoGenerationManager.getProviderHealthStatus()
}

/**
 * 제공업체별 특화 함수들
 */
export const generateWithRunway = (request: VideoGenerationRequest) => {
  return generateVideoWith('runway', request)
}

export const generateWithSeedance = (request: VideoGenerationRequest) => {
  return generateVideoWith('seedance', request)
}

export const generateWithStableVideo = (request: VideoGenerationRequest) => {
  return generateVideoWith('stable-video', request)
}