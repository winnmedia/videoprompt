/**
 * Image Generation Engine
 *
 * 스토리보드 이미지 생성을 위한 핵심 엔진
 * CLAUDE.md 준수: FSD features 레이어, 순차적 생성 로직, ByteDance-Seedream API 통합
 */

import type {
  StoryboardFrame,
  ImageGenerationConfig,
  GenerationResult,
  ConsistencyReference,
  PromptEngineering
} from '../../../entities/storyboard'
import logger from '../../../shared/lib/logger'

/**
 * 이미지 생성 요청 인터페이스
 */
export interface ImageGenerationRequest {
  frameId: string
  prompt: PromptEngineering
  config: ImageGenerationConfig
  consistencyRefs: ConsistencyReference[]
  referenceImageUrl?: string // 이전 이미지 참조
  retryAttempt: number
}

/**
 * 생성 진행 콜백
 */
export interface GenerationProgressCallback {
  onProgress: (frameId: string, progress: number, status: string) => void
  onComplete: (frameId: string, result: GenerationResult) => void
  onError: (frameId: string, error: Error) => void
}

/**
 * API 클라이언트 인터페이스 (의존성 주입)
 */
export interface ImageGenerationAPIClient {
  generateImage(params: {
    prompt: string
    style: string
    width: number
    height: number
    referenceImage?: string
    seed?: number
    steps?: number
    guidance?: number
  }): Promise<{
    imageUrl: string
    seed: number
    processingTime: number
    cost: number
  }>

  enhancePrompt(prompt: string, style: string, consistencyRefs: ConsistencyReference[]): Promise<string>

  extractConsistencyData(imageUrl: string): Promise<{
    styleFingerprint: string
    colorPalette: string[]
    lightingProfile: string
    compositionStyle: string
  }>
}

/**
 * 이미지 생성 엔진 클래스
 *
 * 책임:
 * - 순차적 이미지 생성 관리
 * - 일관성 데이터 전파
 * - 에러 처리 및 재시도
 * - 생성 진행 상태 추적
 */
export class ImageGenerationEngine {
  private apiClient: ImageGenerationAPIClient
  private isGenerating = false
  private currentQueue: ImageGenerationRequest[] = []
  private generationHistory: Map<string, GenerationResult[]> = new Map()

  constructor(apiClient: ImageGenerationAPIClient) {
    this.apiClient = apiClient
  }

  /**
   * 단일 프레임 이미지 생성
   */
  async generateSingleFrame(
    request: ImageGenerationRequest,
    callbacks: GenerationProgressCallback
  ): Promise<GenerationResult> {
    const { frameId, prompt, config, consistencyRefs, referenceImageUrl } = request

    try {
      callbacks.onProgress(frameId, 0.1, '프롬프트 향상 중...')

      // 1. 프롬프트 향상 (일관성 참조 반영)
      const enhancedPrompt = await this.enhancePromptWithConsistency(
        prompt.enhancedPrompt,
        config.style || 'cinematic',
        consistencyRefs
      )

      callbacks.onProgress(frameId, 0.3, '이미지 생성 중...')

      // 2. API 호출로 이미지 생성
      const apiResult = await this.apiClient.generateImage({
        prompt: enhancedPrompt,
        style: config.style || 'cinematic',
        width: this.getWidth(config.aspectRatio),
        height: this.getHeight(config.aspectRatio),
        referenceImage: referenceImageUrl,
        seed: config.seed,
        steps: config.steps || 20,
        guidance: config.guidanceScale || 7.5
      })

      callbacks.onProgress(frameId, 0.8, '결과 처리 중...')

      // 3. 생성 결과 구성
      const result: GenerationResult = {
        imageUrl: apiResult.imageUrl,
        thumbnailUrl: this.generateThumbnailUrl(apiResult.imageUrl),
        generationId: this.generateId(),
        model: config.model,
        config,
        prompt: {
          ...prompt,
          enhancedPrompt
        },
        generatedAt: new Date(),
        processingTime: apiResult.processingTime,
        cost: apiResult.cost
      }

      // 4. 생성 히스토리 저장
      this.addToHistory(frameId, result)

      callbacks.onProgress(frameId, 1.0, '완료')
      callbacks.onComplete(frameId, result)

      logger.info('이미지 생성 완료', {
        frameId,
        processingTime: apiResult.processingTime,
        cost: apiResult.cost
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

      logger.error('이미지 생성 실패', {
        frameId,
        error: errorMessage,
        retryAttempt: request.retryAttempt
      })

      callbacks.onError(frameId, error instanceof Error ? error : new Error(errorMessage))
      throw error
    }
  }

  /**
   * 순차적 배치 생성
   * 첫 번째 이미지 → 일관성 데이터 추출 → 후속 이미지들에 적용
   */
  async generateSequentialBatch(
    requests: ImageGenerationRequest[],
    callbacks: GenerationProgressCallback
  ): Promise<GenerationResult[]> {
    if (this.isGenerating) {
      throw new Error('이미 생성 작업이 진행 중입니다')
    }

    this.isGenerating = true
    this.currentQueue = [...requests]
    const results: GenerationResult[] = []

    try {
      let referenceImageUrl: string | undefined

      for (let i = 0; i < requests.length; i++) {
        const request = requests[i]

        // 첫 번째 이미지가 아니면 이전 이미지를 참조로 사용
        const enhancedRequest = {
          ...request,
          referenceImageUrl: i > 0 ? referenceImageUrl : request.referenceImageUrl
        }

        const result = await this.generateSingleFrame(enhancedRequest, callbacks)
        results.push(result)

        // 첫 번째 이미지의 경우 일관성 데이터 추출
        if (i === 0) {
          referenceImageUrl = result.imageUrl

          try {
            const consistencyData = await this.apiClient.extractConsistencyData(result.imageUrl)

            // 후속 요청들의 일관성 참조에 추가
            const newConsistencyRef: ConsistencyReference = {
              id: this.generateId(),
              type: 'style',
              name: '첫 번째 프레임 스타일',
              description: '첫 번째 프레임에서 추출한 스타일 참조',
              referenceImageUrl: result.imageUrl,
              keyFeatures: [
                consistencyData.styleFingerprint,
                consistencyData.lightingProfile,
                consistencyData.compositionStyle
              ],
              weight: 0.7,
              isActive: true
            }

            // 나머지 요청들에 일관성 참조 추가
            for (let j = i + 1; j < requests.length; j++) {
              requests[j].consistencyRefs.push(newConsistencyRef)
            }

          } catch (consistencyError) {
            logger.warn('일관성 데이터 추출 실패', {
              frameId: request.frameId,
              error: consistencyError
            })
          }
        }

        // 잠시 대기 (API 레이트 리밋 방지)
        if (i < requests.length - 1) {
          await this.delay(1000)
        }
      }

      return results

    } finally {
      this.isGenerating = false
      this.currentQueue = []
    }
  }

  /**
   * 병렬 배치 생성 (일관성 보장 없음, 빠른 생성)
   */
  async generateParallelBatch(
    requests: ImageGenerationRequest[],
    callbacks: GenerationProgressCallback,
    maxConcurrency = 3
  ): Promise<GenerationResult[]> {
    if (this.isGenerating) {
      throw new Error('이미 생성 작업이 진행 중입니다')
    }

    this.isGenerating = true

    try {
      const semaphore = new Semaphore(maxConcurrency)
      const promises = requests.map(async (request) => {
        await semaphore.acquire()
        try {
          return await this.generateSingleFrame(request, callbacks)
        } finally {
          semaphore.release()
        }
      })

      return await Promise.all(promises)

    } finally {
      this.isGenerating = false
    }
  }

  /**
   * 생성 취소
   */
  cancelGeneration(): void {
    this.isGenerating = false
    this.currentQueue = []
    logger.info('이미지 생성이 취소되었습니다')
  }

  /**
   * 생성 상태 확인
   */
  getGenerationStatus(): {
    isGenerating: boolean
    queueLength: number
    currentFrameId: string | null
  } {
    return {
      isGenerating: this.isGenerating,
      queueLength: this.currentQueue.length,
      currentFrameId: this.currentQueue[0]?.frameId || null
    }
  }

  /**
   * 생성 히스토리 조회
   */
  getGenerationHistory(frameId: string): GenerationResult[] {
    return this.generationHistory.get(frameId) || []
  }

  // === Private Helper Methods ===

  /**
   * 일관성을 고려한 프롬프트 향상
   */
  private async enhancePromptWithConsistency(
    basePrompt: string,
    style: string,
    consistencyRefs: ConsistencyReference[]
  ): Promise<string> {
    if (consistencyRefs.length === 0) {
      return await this.apiClient.enhancePrompt(basePrompt, style, [])
    }

    // 활성화된 일관성 참조만 필터링
    const activeRefs = consistencyRefs.filter(ref => ref.isActive)

    return await this.apiClient.enhancePrompt(basePrompt, style, activeRefs)
  }

  /**
   * 종횡비에 따른 너비 계산
   */
  private getWidth(aspectRatio: string): number {
    const ratios: Record<string, number> = {
      '16:9': 1024,
      '4:3': 1024,
      '1:1': 1024,
      '9:16': 576,
      '3:4': 768
    }
    return ratios[aspectRatio] || 1024
  }

  /**
   * 종횡비에 따른 높이 계산
   */
  private getHeight(aspectRatio: string): number {
    const ratios: Record<string, number> = {
      '16:9': 576,
      '4:3': 768,
      '1:1': 1024,
      '9:16': 1024,
      '3:4': 1024
    }
    return ratios[aspectRatio] || 576
  }

  /**
   * 썸네일 URL 생성
   */
  private generateThumbnailUrl(imageUrl: string): string {
    // 실제 구현에서는 썸네일 생성 서비스 사용
    return imageUrl.replace(/\.(jpg|jpeg|png|webp)$/i, '_thumb.$1')
  }

  /**
   * 유니크 ID 생성
   */
  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 생성 히스토리에 결과 추가
   */
  private addToHistory(frameId: string, result: GenerationResult): void {
    const history = this.generationHistory.get(frameId) || []
    history.push(result)
    this.generationHistory.set(frameId, history)
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 세마포어 클래스 (동시 실행 제한)
 */
class Semaphore {
  private permits: number
  private waitQueue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve()
      } else {
        this.waitQueue.push(resolve)
      }
    })
  }

  release(): void {
    this.permits++
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()
      if (next) {
        this.permits--
        next()
      }
    }
  }
}