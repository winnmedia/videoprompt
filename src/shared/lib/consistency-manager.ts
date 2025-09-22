/**
 * 스토리보드 이미지 일관성 관리자
 *
 * CLAUDE.md 준수:
 * - FSD shared/lib 레이어, 도메인 독립적 유틸리티
 * - 비용 안전: 중복 생성 방지, 캐싱 활용
 * - 단순성 원칙: 명확한 책임 분리
 */

import type {
  ConsistencyReference,
  StoryboardFrame,
  GenerationResult,
  ImageGenerationConfig,
  PromptEngineering
} from '../../entities/storyboard/types'
import logger from './logger'

/**
 * 일관성 가중치 설정
 */
interface ConsistencyWeights {
  character: number // 캐릭터 일관성
  location: number  // 배경/장소 일관성
  style: number     // 스타일 일관성
  color: number     // 색상 일관성
}

/**
 * 기본 일관성 가중치
 */
const DEFAULT_WEIGHTS: ConsistencyWeights = {
  character: 0.9,
  location: 0.7,
  style: 0.8,
  color: 0.6
}

/**
 * 일관성 분석 결과
 */
interface ConsistencyAnalysis {
  hasReference: boolean
  referenceImageUrl: string | null
  activeReferences: ConsistencyReference[]
  missingElements: string[]
  recommendations: string[]
}

/**
 * 프롬프트 향상 결과
 */
interface EnhancedPrompt {
  originalPrompt: string
  enhancedPrompt: string
  addedModifiers: string[]
  consistencyTerms: string[]
  technicalSpecs: string[]
}

/**
 * 스토리보드 이미지 일관성 관리자
 */
export class ConsistencyManager {
  private static referenceCache = new Map<string, ConsistencyReference>()
  private static analysisCache = new Map<string, ConsistencyAnalysis>()

  /**
   * 첫 번째 생성 이미지로부터 일관성 참조 자동 생성
   */
  static createReferenceFromFirstImage(
    generationResult: GenerationResult,
    frameTitle: string
  ): ConsistencyReference {
    const cacheKey = `auto_ref_${generationResult.imageUrl}`

    if (this.referenceCache.has(cacheKey)) {
      return this.referenceCache.get(cacheKey)!
    }

    const reference: ConsistencyReference = {
      id: `ref_${Date.now()}_auto`,
      type: 'style',
      name: `${frameTitle} 스타일 참조`,
      description: '첫 번째 이미지에서 자동 추출된 스타일 참조',
      referenceImageUrl: generationResult.imageUrl,
      keyFeatures: this.extractKeyFeatures(generationResult),
      weight: DEFAULT_WEIGHTS.style,
      isActive: true
    }

    this.referenceCache.set(cacheKey, reference)

    logger.info('자동 일관성 참조 생성', {
      referenceId: reference.id,
      imageUrl: generationResult.imageUrl,
      keyFeatures: reference.keyFeatures.length
    })

    return reference
  }

  /**
   * 프레임 생성을 위한 일관성 분석
   */
  static analyzeFrameConsistency(
    frame: StoryboardFrame,
    allReferences: ConsistencyReference[],
    previousFrames: StoryboardFrame[] = []
  ): ConsistencyAnalysis {
    const cacheKey = `analysis_${frame.metadata.id}_${allReferences.length}_${previousFrames.length}`

    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!
    }

    const activeReferences = allReferences.filter(ref => ref.isActive)
    const hasReference = activeReferences.length > 0

    // 참조 이미지 URL 결정 (우선순위: style > character > location)
    const referenceImageUrl = activeReferences
      .sort((a, b) => {
        const priorities = { style: 3, character: 2, location: 1, object: 0 }
        return priorities[b.type] - priorities[a.type]
      })[0]?.referenceImageUrl || null

    // 누락된 일관성 요소 검출
    const missingElements: string[] = []
    const requiredTypes: ConsistencyReference['type'][] = ['character', 'location', 'style']

    requiredTypes.forEach(type => {
      const hasType = activeReferences.some(ref => ref.type === type)
      if (!hasType && this.shouldHaveReference(frame, type)) {
        missingElements.push(type)
      }
    })

    // 권장사항 생성
    const recommendations = this.generateRecommendations(
      frame,
      activeReferences,
      missingElements,
      previousFrames
    )

    const analysis: ConsistencyAnalysis = {
      hasReference,
      referenceImageUrl,
      activeReferences,
      missingElements,
      recommendations
    }

    this.analysisCache.set(cacheKey, analysis)

    return analysis
  }

  /**
   * 일관성을 고려한 프롬프트 향상
   */
  static enhancePromptForConsistency(
    basePrompt: string,
    consistencyRefs: ConsistencyReference[],
    config: ImageGenerationConfig
  ): EnhancedPrompt {
    const activeRefs = consistencyRefs.filter(ref => ref.isActive)

    let enhancedPrompt = basePrompt
    const addedModifiers: string[] = []
    const consistencyTerms: string[] = []
    const technicalSpecs: string[] = []

    // 스타일 일관성 적용
    const styleRefs = activeRefs.filter(ref => ref.type === 'style')
    if (styleRefs.length > 0) {
      const styleTerms = styleRefs.flatMap(ref => ref.keyFeatures)
      consistencyTerms.push(...styleTerms)
      addedModifiers.push('동일한 스타일 유지')
    }

    // 캐릭터 일관성 적용
    const characterRefs = activeRefs.filter(ref => ref.type === 'character')
    if (characterRefs.length > 0) {
      characterRefs.forEach(ref => {
        const characterDesc = `${ref.name}: ${ref.description}`
        enhancedPrompt = `${characterDesc}, ${enhancedPrompt}`
        addedModifiers.push(`캐릭터 일관성: ${ref.name}`)
      })
    }

    // 위치/배경 일관성 적용
    const locationRefs = activeRefs.filter(ref => ref.type === 'location')
    if (locationRefs.length > 0) {
      locationRefs.forEach(ref => {
        enhancedPrompt = `배경: ${ref.description}, ${enhancedPrompt}`
        addedModifiers.push(`배경 일관성: ${ref.name}`)
      })
    }

    // 기술적 사양 추가
    technicalSpecs.push(
      `해상도: ${config.aspectRatio}`,
      `품질: ${config.quality}`,
      `스타일: ${config.style || 'cinematic'}`
    )

    // 일관성 강화 지시어 추가
    if (activeRefs.length > 0) {
      enhancedPrompt += ', 이전 이미지와 동일한 스타일과 색감 유지'
      technicalSpecs.push('일관성 유지 강화')
    }

    return {
      originalPrompt: basePrompt,
      enhancedPrompt,
      addedModifiers,
      consistencyTerms,
      technicalSpecs
    }
  }

  /**
   * 생성 결과로부터 다음 프레임용 일관성 참조 업데이트
   */
  static updateConsistencyFromResult(
    result: GenerationResult,
    existingRefs: ConsistencyReference[]
  ): ConsistencyReference[] {
    const updatedRefs = [...existingRefs]

    // 스타일 참조 업데이트 또는 생성
    const styleRefIndex = updatedRefs.findIndex(ref => ref.type === 'style')

    if (styleRefIndex >= 0) {
      // 기존 스타일 참조 업데이트
      updatedRefs[styleRefIndex] = {
        ...updatedRefs[styleRefIndex],
        referenceImageUrl: result.imageUrl,
        keyFeatures: this.extractKeyFeatures(result),
        weight: Math.min(updatedRefs[styleRefIndex].weight + 0.1, 1.0) // 점진적 강화
      }
    } else {
      // 새 스타일 참조 생성
      const newStyleRef: ConsistencyReference = {
        id: `style_ref_${Date.now()}`,
        type: 'style',
        name: '자동 생성 스타일',
        description: '생성된 이미지로부터 추출된 스타일',
        referenceImageUrl: result.imageUrl,
        keyFeatures: this.extractKeyFeatures(result),
        weight: DEFAULT_WEIGHTS.style,
        isActive: true
      }
      updatedRefs.push(newStyleRef)
    }

    logger.info('일관성 참조 업데이트', {
      resultImageUrl: result.imageUrl,
      totalRefs: updatedRefs.length,
      activeRefs: updatedRefs.filter(ref => ref.isActive).length
    })

    return updatedRefs
  }

  /**
   * 이미지 생성 결과에서 주요 특징 추출
   */
  private static extractKeyFeatures(result: GenerationResult): string[] {
    const features: string[] = []

    // 프롬프트에서 스타일 키워드 추출
    const prompt = result.prompt.enhancedPrompt.toLowerCase()

    // 색상 관련 키워드
    const colorKeywords = ['blue', 'red', 'green', 'warm', 'cold', 'bright', 'dark', 'pastel']
    colorKeywords.forEach(keyword => {
      if (prompt.includes(keyword)) {
        features.push(`색상: ${keyword}`)
      }
    })

    // 스타일 관련 키워드
    const styleKeywords = ['cinematic', 'realistic', 'cartoon', 'anime', 'vintage', 'modern']
    styleKeywords.forEach(keyword => {
      if (prompt.includes(keyword)) {
        features.push(`스타일: ${keyword}`)
      }
    })

    // 기술적 설정에서 추출
    features.push(`모델: ${result.model}`)
    features.push(`화질: ${result.config.quality}`)

    if (result.config.style) {
      features.push(`프리셋: ${result.config.style}`)
    }

    return features
  }

  /**
   * 프레임이 특정 타입의 참조를 가져야 하는지 판단
   */
  private static shouldHaveReference(
    frame: StoryboardFrame,
    type: ConsistencyReference['type']
  ): boolean {
    const description = frame.metadata.description.toLowerCase()

    switch (type) {
      case 'character':
        return description.includes('인물') ||
               description.includes('캐릭터') ||
               description.includes('사람')

      case 'location':
        return description.includes('배경') ||
               description.includes('장소') ||
               description.includes('환경')

      case 'style':
        return true // 모든 프레임에 스타일 일관성 필요

      case 'object':
        return description.includes('물체') ||
               description.includes('도구') ||
               description.includes('아이템')

      default:
        return false
    }
  }

  /**
   * 일관성 개선 권장사항 생성
   */
  private static generateRecommendations(
    frame: StoryboardFrame,
    activeRefs: ConsistencyReference[],
    missingElements: string[],
    previousFrames: StoryboardFrame[]
  ): string[] {
    const recommendations: string[] = []

    // 누락된 요소에 대한 권장사항
    if (missingElements.includes('character')) {
      recommendations.push('주요 캐릭터에 대한 일관성 참조를 추가하세요')
    }

    if (missingElements.includes('location')) {
      recommendations.push('배경/장소에 대한 일관성 참조를 추가하세요')
    }

    if (missingElements.includes('style')) {
      recommendations.push('전체적인 스타일 참조를 설정하세요')
    }

    // 이전 프레임과의 연속성 검토
    if (previousFrames.length > 0) {
      const lastFrame = previousFrames[previousFrames.length - 1]
      if (lastFrame.result && !activeRefs.some(ref => ref.referenceImageUrl === lastFrame.result?.imageUrl)) {
        recommendations.push('이전 프레임의 스타일을 참조로 추가하여 연속성을 강화하세요')
      }
    }

    // 참조 가중치 조정 권장사항
    const lowWeightRefs = activeRefs.filter(ref => ref.weight < 0.5)
    if (lowWeightRefs.length > 0) {
      recommendations.push('일관성 효과를 높이기 위해 참조 가중치를 조정하세요')
    }

    return recommendations
  }

  /**
   * 캐시 정리
   */
  static clearCache(): void {
    this.referenceCache.clear()
    this.analysisCache.clear()
    logger.info('일관성 관리자 캐시 정리 완료')
  }

  /**
   * 일관성 통계 계산
   */
  static calculateConsistencyStatistics(frames: StoryboardFrame[]): {
    totalFrames: number
    framesWithReference: number
    averageReferenceCount: number
    consistencyScore: number
  } {
    const totalFrames = frames.length
    const framesWithReference = frames.filter(frame =>
      frame.consistencyRefs.length > 0
    ).length

    const totalReferences = frames.reduce((sum, frame) =>
      sum + frame.consistencyRefs.length, 0
    )
    const averageReferenceCount = totalFrames > 0 ? totalReferences / totalFrames : 0

    // 일관성 점수 계산 (0-1)
    const consistencyScore = totalFrames > 0 ? framesWithReference / totalFrames : 0

    return {
      totalFrames,
      framesWithReference,
      averageReferenceCount,
      consistencyScore
    }
  }
}