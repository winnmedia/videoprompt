/**
 * Video Generation API - Public Interface
 *
 * 영상 생성 API의 통합 진입점
 * CLAUDE.md 준수: FSD Public API 패턴, 명확한 인터페이스 제공
 */

// ===== 타입 및 인터페이스 =====
export type {
  VideoGenerationProvider as ProviderType,
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoQuality,
  VideoStyle,
  ProviderConfig,
  UsageStats,
  CostSafetyLimits
} from './types'

// ===== 에러 타입 =====
export {
  VideoGenerationError,
  CostSafetyError,
  QuotaExceededError,
  NetworkError,
  TimeoutError
} from './types'

// ===== 검증 스키마 =====
export {
  VideoGenerationRequestSchema,
  VideoGenerationResponseSchema,
  ProviderConfigSchema
} from './types'

// ===== 통합 매니저 (추천) =====
export {
  VideoGenerationManager,
  videoGenerationManager,
  generateVideo,
  generateVideoWith,
  checkVideoStatus,
  cancelVideoJob,
  getVideoGenerationStats,
  getVideoProviderStatus,
  generateWithRunway,
  generateWithSeedance,
  generateWithStableVideo
} from './video-generation-manager'

// ===== 개별 클라이언트 (고급 사용자용) =====
export { RunwayClient, runwayClient } from './runway-client'
export { SeedanceClient, seedanceClient } from './seedance-client'
export { StableVideoClient, stableVideoClient } from './stable-video-client'

// ===== 비용 안전 미들웨어 =====
export {
  CostSafetyMiddleware,
  RunwayCostSafetyMiddleware,
  SeedanceCostSafetyMiddleware,
  StableVideoCostSafetyMiddleware
} from './cost-safety-middleware'

// ===== 유틸리티 함수들 =====

/**
 * 요청 타입별 추천 제공업체 반환
 */
export function getRecommendedProvider(request: VideoGenerationRequest): ProviderType {
  // 이미지가 없는 경우 (텍스트-투-비디오)
  if (!request.imageUrl) {
    return 'runway' // Runway가 텍스트-투-비디오에 가장 적합
  }

  // 긴 영상이 필요한 경우
  if (request.duration > 10) {
    return 'seedance' // Seedance가 최대 30초까지 지원
  }

  // 고품질이 필요한 경우
  if (request.quality === 'ultra' || request.quality === 'high') {
    return 'runway' // Runway가 품질이 가장 좋음
  }

  // 비용 효율성이 중요한 경우
  if (request.duration <= 5) {
    return 'seedance' // Seedance가 가장 비용 효율적
  }

  // 기본값
  return 'seedance'
}

/**
 * 제공업체별 예상 비용 계산
 */
export function estimateGenerationCost(
  provider: ProviderType,
  request: VideoGenerationRequest
): number {
  const baseCosts = {
    runway: 0.05,
    seedance: 0.03,
    'stable-video': 0.04
  }

  const baseCost = baseCosts[provider]
  const durationMultiplier = request.duration / 5 // 5초 기준
  const qualityMultiplier = {
    low: 0.8,
    medium: 1.0,
    high: 1.3,
    ultra: 1.6
  }[request.quality] || 1.0

  return baseCost * durationMultiplier * qualityMultiplier
}

/**
 * 제공업체 기능 호환성 확인
 */
export function isProviderCompatible(
  provider: ProviderType,
  request: VideoGenerationRequest
): boolean {
  const features = {
    runway: {
      imageToVideo: true,
      textToVideo: true,
      maxDuration: 10,
      supportedQualities: ['medium', 'high'],
      supportedAspectRatios: ['16:9', '9:16', '1:1']
    },
    seedance: {
      imageToVideo: true,
      textToVideo: false,
      maxDuration: 30,
      supportedQualities: ['medium', 'high'],
      supportedAspectRatios: ['16:9', '9:16', '1:1']
    },
    'stable-video': {
      imageToVideo: true,
      textToVideo: false,
      maxDuration: 4,
      supportedQualities: ['medium', 'high'],
      supportedAspectRatios: ['16:9', '9:16', '1:1']
    }
  }

  const feature = features[provider]

  // 이미지 유무에 따른 기능 요구사항 체크
  if (!request.imageUrl && !feature.textToVideo) return false
  if (request.imageUrl && !feature.imageToVideo) return false

  // 시간 제한 체크
  if (request.duration > feature.maxDuration) return false

  // 품질 지원 체크
  if (!feature.supportedQualities.includes(request.quality as any)) return false

  // 화면 비율 지원 체크
  if (!feature.supportedAspectRatios.includes(request.aspectRatio as any)) return false

  return true
}

/**
 * 최적 제공업체 조합 반환 (배치 처리용)
 */
export function getOptimalProviderMix(
  requests: VideoGenerationRequest[]
): Array<{ request: VideoGenerationRequest; provider: ProviderType; estimatedCost: number }> {
  return requests.map(request => {
    const compatibleProviders = (['runway', 'seedance', 'stable-video'] as ProviderType[])
      .filter(provider => isProviderCompatible(provider, request))

    const providerCosts = compatibleProviders.map(provider => ({
      provider,
      cost: estimateGenerationCost(provider, request)
    }))

    // 비용 효율성 우선으로 정렬
    providerCosts.sort((a, b) => a.cost - b.cost)

    const selectedProvider = providerCosts[0]?.provider || 'seedance'

    return {
      request,
      provider: selectedProvider,
      estimatedCost: estimateGenerationCost(selectedProvider, request)
    }
  })
}

/**
 * 비용 안전 상태 확인
 */
export async function checkCostSafetyStatus(): Promise<{
  runway: { safe: boolean; stats: UsageStats }
  seedance: { safe: boolean; stats: UsageStats }
  stableVideo: { safe: boolean; stats: UsageStats }
}> {
  const stats = getVideoGenerationStats()

  return {
    runway: {
      safe: stats.runway?.timeUntilNextCall === 0,
      stats: stats.runway || {
        totalCalls: 0,
        lastCallTime: 0,
        recentCalls: 0,
        hourlyRecentCalls: 0,
        nextAvailableTime: 0,
        timeUntilNextCall: 0,
        totalCost: 0,
        monthlyCost: 0
      }
    },
    seedance: {
      safe: stats.seedance?.timeUntilNextCall === 0,
      stats: stats.seedance || {
        totalCalls: 0,
        lastCallTime: 0,
        recentCalls: 0,
        hourlyRecentCalls: 0,
        nextAvailableTime: 0,
        timeUntilNextCall: 0,
        totalCost: 0,
        monthlyCost: 0
      }
    },
    stableVideo: {
      safe: stats['stable-video']?.timeUntilNextCall === 0,
      stats: stats['stable-video'] || {
        totalCalls: 0,
        lastCallTime: 0,
        recentCalls: 0,
        hourlyRecentCalls: 0,
        nextAvailableTime: 0,
        timeUntilNextCall: 0,
        totalCost: 0,
        monthlyCost: 0
      }
    }
  }
}

// ===== 기본 내보내기 =====
export default {
  // 주요 기능
  generateVideo,
  generateVideoWith,
  checkVideoStatus,
  cancelVideoJob,

  // 매니저
  manager: videoGenerationManager,

  // 유틸리티
  getRecommendedProvider,
  estimateGenerationCost,
  isProviderCompatible,
  getOptimalProviderMix,
  checkCostSafetyStatus,

  // 통계
  getStats: getVideoGenerationStats,
  getProviderStatus: getVideoProviderStatus
} as const