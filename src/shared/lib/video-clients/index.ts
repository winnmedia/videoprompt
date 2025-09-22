/**
 * Video Clients Public API
 *
 * CLAUDE.md 준수: shared/lib Public API
 * 모든 영상 생성 클라이언트들의 진입점
 */

// 베이스 클라이언트 및 타입들
export {
  BaseVideoClient,
  VideoApiError,
  type VideoApiParams,
  type VideoApiJob,
  type RetryStrategy,
  type ApiResponse
} from './base-client'

// 구체적인 클라이언트들
export { RunwayClient } from './runway-client'
export { SeedanceClient } from './seedance-client'
export { StableVideoClient } from './stable-video-client'

/**
 * 클라이언트 팩토리
 */
import { RunwayClient } from './runway-client'
import { SeedanceClient } from './seedance-client'
import { StableVideoClient } from './stable-video-client'
import { BaseVideoClient } from './base-client'

export type VideoProvider = 'runway' | 'seedance' | 'stable-video'

export class VideoClientFactory {
  private static clients: Map<VideoProvider, BaseVideoClient> = new Map()

  /**
   * 클라이언트 인스턴스 가져오기 (싱글톤)
   */
  static getClient(provider: VideoProvider): BaseVideoClient {
    if (!this.clients.has(provider)) {
      const client = this.createClient(provider)
      this.clients.set(provider, client)
    }

    return this.clients.get(provider)!
  }

  /**
   * 새 클라이언트 인스턴스 생성
   */
  private static createClient(provider: VideoProvider): BaseVideoClient {
    switch (provider) {
      case 'runway':
        return new RunwayClient()
      case 'seedance':
        return new SeedanceClient()
      case 'stable-video':
        return new StableVideoClient()
      default:
        throw new Error(`지원하지 않는 영상 생성 제공업체: ${provider}`)
    }
  }

  /**
   * 모든 클라이언트의 헬스체크
   */
  static async healthCheckAll(): Promise<Record<VideoProvider, boolean>> {
    const results: Record<VideoProvider, boolean> = {} as any

    const providers: VideoProvider[] = ['runway', 'seedance', 'stable-video']

    await Promise.all(
      providers.map(async (provider) => {
        try {
          const client = this.getClient(provider)
          results[provider] = await client.healthCheck()
        } catch (error) {
          results[provider] = false
        }
      })
    )

    return results
  }

  /**
   * 클라이언트 캐시 클리어
   */
  static clearCache(): void {
    this.clients.clear()
  }

  /**
   * 지원하는 제공업체 목록
   */
  static getSupportedProviders(): VideoProvider[] {
    return ['runway', 'seedance', 'stable-video']
  }

  /**
   * 제공업체별 특징 정보
   */
  static getProviderInfo(provider: VideoProvider): {
    name: string
    maxDuration: number
    requiresImage: boolean
    supportedRatios: string[]
    features: string[]
  } {
    switch (provider) {
      case 'runway':
        return {
          name: 'Runway ML',
          maxDuration: 30,
          requiresImage: false,
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          features: ['text-to-video', 'image-to-video', 'camera-control', 'motion-brush']
        }

      case 'seedance':
        return {
          name: 'ByteDance Seedance',
          maxDuration: 10,
          requiresImage: false,
          supportedRatios: ['16:9', '9:16', '1:1'],
          features: ['text-to-video', 'image-to-video', 'style-control', 'fast-generation']
        }

      case 'stable-video':
        return {
          name: 'Stable Video Diffusion',
          maxDuration: 4,
          requiresImage: true,
          supportedRatios: ['1:1'],
          features: ['image-to-video', 'motion-control', 'open-source', 'free-tier']
        }

      default:
        throw new Error(`알 수 없는 제공업체: ${provider}`)
    }
  }
}