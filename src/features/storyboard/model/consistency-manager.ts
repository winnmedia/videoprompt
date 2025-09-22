/**
 * Consistency Manager
 *
 * 스토리보드 이미지 간 스타일 일관성 관리
 * CLAUDE.md 준수: FSD features 레이어, 스타일 일관성 추출 및 전파, 색상 팔레트 유지
 */

import type {
  ConsistencyReference,
  GenerationResult,
  StoryboardFrame
} from '../../../entities/storyboard'
import logger from '../../../shared/lib/logger'

/**
 * 색상 팔레트 분석 결과
 */
export interface ColorPaletteAnalysis {
  dominantColors: string[] // HEX 값들
  colorHarmony: 'monochromatic' | 'complementary' | 'triadic' | 'split-complementary' | 'analogous'
  brightness: 'dark' | 'medium' | 'bright'
  saturation: 'low' | 'medium' | 'high'
  temperature: 'warm' | 'cool' | 'neutral'
}

/**
 * 스타일 특성 분석 결과
 */
export interface StyleAnalysis {
  artStyle: 'realistic' | 'cartoon' | 'anime' | 'painting' | 'sketch' | 'abstract'
  lightingType: 'natural' | 'dramatic' | 'soft' | 'harsh' | 'backlit' | 'ambient'
  compositionType: 'close-up' | 'medium' | 'wide' | 'extreme-wide' | 'birds-eye' | 'worms-eye'
  mood: 'cheerful' | 'serious' | 'mysterious' | 'dramatic' | 'peaceful' | 'energetic'
  visualComplexity: 'simple' | 'moderate' | 'complex'
}

/**
 * 일관성 점수 계산 결과
 */
export interface ConsistencyScore {
  overall: number // 0.0 ~ 1.0
  color: number
  style: number
  lighting: number
  composition: number
  recommendations: string[]
}

/**
 * 일관성 데이터 추출 인터페이스
 */
export interface ConsistencyExtractor {
  analyzeColors(imageUrl: string): Promise<ColorPaletteAnalysis>
  analyzeStyle(imageUrl: string): Promise<StyleAnalysis>
  extractVisualFingerprint(imageUrl: string): Promise<string>
}

/**
 * 스타일 일관성 관리자
 *
 * 책임:
 * - 이미지에서 스타일 특성 추출
 * - 일관성 참조 데이터 생성 및 관리
 * - 일관성 점수 계산
 * - 스타일 가이드라인 생성
 */
export class ConsistencyManager {
  private extractor: ConsistencyExtractor
  private consistencyDatabase: Map<string, ConsistencyReference[]> = new Map()
  private styleProfiles: Map<string, StyleAnalysis> = new Map()
  private colorProfiles: Map<string, ColorPaletteAnalysis> = new Map()

  constructor(extractor: ConsistencyExtractor) {
    this.extractor = extractor
  }

  /**
   * 프레임에서 일관성 데이터 추출
   */
  async extractConsistencyFromFrame(frame: StoryboardFrame): Promise<ConsistencyReference[]> {
    if (!frame.result?.imageUrl) {
      throw new Error('프레임에 생성된 이미지가 없습니다')
    }

    const imageUrl = frame.result.imageUrl

    try {
      // 병렬로 분석 실행
      const [colorAnalysis, styleAnalysis, fingerprint] = await Promise.all([
        this.extractor.analyzeColors(imageUrl),
        this.extractor.analyzeStyle(imageUrl),
        this.extractor.extractVisualFingerprint(imageUrl)
      ])

      // 분석 결과 캐싱
      this.colorProfiles.set(frame.metadata.id, colorAnalysis)
      this.styleProfiles.set(frame.metadata.id, styleAnalysis)

      // 일관성 참조 생성
      const references: ConsistencyReference[] = [
        this.createColorReference(frame, colorAnalysis),
        this.createStyleReference(frame, styleAnalysis),
        this.createLightingReference(frame, styleAnalysis),
        this.createCompositionReference(frame, styleAnalysis)
      ]

      // 데이터베이스에 저장
      this.consistencyDatabase.set(frame.metadata.id, references)

      logger.info('일관성 데이터 추출 완료', {
        frameId: frame.metadata.id,
        extractedRefs: references.length
      })

      return references

    } catch (error) {
      logger.error('일관성 데이터 추출 실패', {
        frameId: frame.metadata.id,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
      throw error
    }
  }

  /**
   * 여러 프레임 간 일관성 점수 계산
   */
  async calculateConsistencyScore(frames: StoryboardFrame[]): Promise<ConsistencyScore> {
    if (frames.length < 2) {
      return {
        overall: 1.0,
        color: 1.0,
        style: 1.0,
        lighting: 1.0,
        composition: 1.0,
        recommendations: ['프레임이 충분하지 않아 일관성을 계산할 수 없습니다.']
      }
    }

    const completedFrames = frames.filter(f => f.result?.imageUrl)
    if (completedFrames.length < 2) {
      return {
        overall: 0.0,
        color: 0.0,
        style: 0.0,
        lighting: 0.0,
        composition: 0.0,
        recommendations: ['완성된 프레임이 부족합니다.']
      }
    }

    try {
      // 모든 프레임의 분석 데이터가 있는지 확인하고 없으면 생성
      await this.ensureAnalysisData(completedFrames)

      const colorScore = this.calculateColorConsistency(completedFrames)
      const styleScore = this.calculateStyleConsistency(completedFrames)
      const lightingScore = this.calculateLightingConsistency(completedFrames)
      const compositionScore = this.calculateCompositionConsistency(completedFrames)

      const overall = (colorScore + styleScore + lightingScore + compositionScore) / 4

      const recommendations = this.generateConsistencyRecommendations({
        overall,
        color: colorScore,
        style: styleScore,
        lighting: lightingScore,
        composition: compositionScore,
        recommendations: []
      })

      return {
        overall,
        color: colorScore,
        style: styleScore,
        lighting: lightingScore,
        composition: compositionScore,
        recommendations
      }

    } catch (error) {
      logger.error('일관성 점수 계산 실패', { error })
      throw error
    }
  }

  /**
   * 일관성 기반 프롬프트 개선 제안
   */
  async generateConsistencyGuidedPrompt(
    basePrompt: string,
    targetFrame: StoryboardFrame,
    referenceFrames: StoryboardFrame[]
  ): Promise<string> {
    if (referenceFrames.length === 0) {
      return basePrompt
    }

    // 참조 프레임들의 공통 스타일 특성 추출
    const commonFeatures = await this.extractCommonFeatures(referenceFrames)

    // 프롬프트에 일관성 요소 추가
    const consistencyPrompt = this.buildConsistencyPrompt(commonFeatures)

    return `${basePrompt}, ${consistencyPrompt}`
  }

  /**
   * 스타일 가이드라인 생성
   */
  async generateStyleGuideline(frames: StoryboardFrame[]): Promise<{
    colorGuideline: string
    lightingGuideline: string
    compositionGuideline: string
    overallGuideline: string
  }> {
    const completedFrames = frames.filter(f => f.result?.imageUrl)
    await this.ensureAnalysisData(completedFrames)

    const colorGuideline = this.generateColorGuideline(completedFrames)
    const lightingGuideline = this.generateLightingGuideline(completedFrames)
    const compositionGuideline = this.generateCompositionGuideline(completedFrames)
    const overallGuideline = this.generateOverallGuideline(completedFrames)

    return {
      colorGuideline,
      lightingGuideline,
      compositionGuideline,
      overallGuideline
    }
  }

  /**
   * 일관성 참조 최적화
   */
  optimizeConsistencyReferences(
    references: ConsistencyReference[],
    targetWeight = 0.8
  ): ConsistencyReference[] {
    // 가중치 정규화
    const totalWeight = references.reduce((sum, ref) => sum + ref.weight, 0)

    if (totalWeight === 0) return references

    const normalizedRefs = references.map(ref => ({
      ...ref,
      weight: (ref.weight / totalWeight) * targetWeight
    }))

    // 중요도 순으로 정렬
    return normalizedRefs.sort((a, b) => b.weight - a.weight)
  }

  // === Private Helper Methods ===

  /**
   * 분석 데이터 존재 확인 및 생성
   */
  private async ensureAnalysisData(frames: StoryboardFrame[]): Promise<void> {
    const missingAnalysis = frames.filter(frame =>
      !this.colorProfiles.has(frame.metadata.id) ||
      !this.styleProfiles.has(frame.metadata.id)
    )

    if (missingAnalysis.length > 0) {
      await Promise.all(
        missingAnalysis.map(frame => this.extractConsistencyFromFrame(frame))
      )
    }
  }

  /**
   * 색상 일관성 참조 생성
   */
  private createColorReference(frame: StoryboardFrame, analysis: ColorPaletteAnalysis): ConsistencyReference {
    return {
      id: `color_${frame.metadata.id}`,
      type: 'style',
      name: `${frame.metadata.title} - 색상 팔레트`,
      description: `${analysis.colorHarmony} 색상 조화, ${analysis.temperature} 색온도`,
      referenceImageUrl: frame.result?.imageUrl,
      keyFeatures: [
        `주요색상: ${analysis.dominantColors.join(', ')}`,
        `색상조화: ${analysis.colorHarmony}`,
        `명도: ${analysis.brightness}`,
        `채도: ${analysis.saturation}`,
        `색온도: ${analysis.temperature}`
      ],
      weight: 0.8,
      isActive: true
    }
  }

  /**
   * 스타일 일관성 참조 생성
   */
  private createStyleReference(frame: StoryboardFrame, analysis: StyleAnalysis): ConsistencyReference {
    return {
      id: `style_${frame.metadata.id}`,
      type: 'style',
      name: `${frame.metadata.title} - 아트 스타일`,
      description: `${analysis.artStyle} 스타일, ${analysis.mood} 분위기`,
      referenceImageUrl: frame.result?.imageUrl,
      keyFeatures: [
        `아트스타일: ${analysis.artStyle}`,
        `분위기: ${analysis.mood}`,
        `복잡도: ${analysis.visualComplexity}`
      ],
      weight: 0.7,
      isActive: true
    }
  }

  /**
   * 조명 일관성 참조 생성
   */
  private createLightingReference(frame: StoryboardFrame, analysis: StyleAnalysis): ConsistencyReference {
    return {
      id: `lighting_${frame.metadata.id}`,
      type: 'style',
      name: `${frame.metadata.title} - 조명`,
      description: `${analysis.lightingType} 조명 스타일`,
      referenceImageUrl: frame.result?.imageUrl,
      keyFeatures: [`조명타입: ${analysis.lightingType}`],
      weight: 0.6,
      isActive: true
    }
  }

  /**
   * 구도 일관성 참조 생성
   */
  private createCompositionReference(frame: StoryboardFrame, analysis: StyleAnalysis): ConsistencyReference {
    return {
      id: `composition_${frame.metadata.id}`,
      type: 'style',
      name: `${frame.metadata.title} - 구도`,
      description: `${analysis.compositionType} 구도 스타일`,
      referenceImageUrl: frame.result?.imageUrl,
      keyFeatures: [`구도타입: ${analysis.compositionType}`],
      weight: 0.5,
      isActive: true
    }
  }

  /**
   * 색상 일관성 점수 계산
   */
  private calculateColorConsistency(frames: StoryboardFrame[]): number {
    const colorProfiles = frames
      .map(f => this.colorProfiles.get(f.metadata.id))
      .filter((p): p is ColorPaletteAnalysis => p !== undefined)

    if (colorProfiles.length < 2) return 1.0

    // 색온도 일관성
    const temperatures = colorProfiles.map(p => p.temperature)
    const temperatureConsistency = this.calculateCategoricalConsistency(temperatures)

    // 명도 일관성
    const brightness = colorProfiles.map(p => p.brightness)
    const brightnessConsistency = this.calculateCategoricalConsistency(brightness)

    // 채도 일관성
    const saturations = colorProfiles.map(p => p.saturation)
    const saturationConsistency = this.calculateCategoricalConsistency(saturations)

    return (temperatureConsistency + brightnessConsistency + saturationConsistency) / 3
  }

  /**
   * 스타일 일관성 점수 계산
   */
  private calculateStyleConsistency(frames: StoryboardFrame[]): number {
    const styleProfiles = frames
      .map(f => this.styleProfiles.get(f.metadata.id))
      .filter((p): p is StyleAnalysis => p !== undefined)

    if (styleProfiles.length < 2) return 1.0

    const artStyles = styleProfiles.map(p => p.artStyle)
    const moods = styleProfiles.map(p => p.mood)

    const artStyleConsistency = this.calculateCategoricalConsistency(artStyles)
    const moodConsistency = this.calculateCategoricalConsistency(moods)

    return (artStyleConsistency + moodConsistency) / 2
  }

  /**
   * 조명 일관성 점수 계산
   */
  private calculateLightingConsistency(frames: StoryboardFrame[]): number {
    const styleProfiles = frames
      .map(f => this.styleProfiles.get(f.metadata.id))
      .filter((p): p is StyleAnalysis => p !== undefined)

    if (styleProfiles.length < 2) return 1.0

    const lightingTypes = styleProfiles.map(p => p.lightingType)
    return this.calculateCategoricalConsistency(lightingTypes)
  }

  /**
   * 구도 일관성 점수 계산
   */
  private calculateCompositionConsistency(frames: StoryboardFrame[]): number {
    const styleProfiles = frames
      .map(f => this.styleProfiles.get(f.metadata.id))
      .filter((p): p is StyleAnalysis => p !== undefined)

    if (styleProfiles.length < 2) return 1.0

    const compositionTypes = styleProfiles.map(p => p.compositionType)
    return this.calculateCategoricalConsistency(compositionTypes)
  }

  /**
   * 범주형 데이터의 일관성 계산
   */
  private calculateCategoricalConsistency(values: string[]): number {
    if (values.length < 2) return 1.0

    const frequency = new Map<string, number>()
    values.forEach(value => {
      frequency.set(value, (frequency.get(value) || 0) + 1)
    })

    const maxFrequency = Math.max(...frequency.values())
    return maxFrequency / values.length
  }

  /**
   * 공통 특성 추출
   */
  private async extractCommonFeatures(frames: StoryboardFrame[]): Promise<{
    dominantColors: string[]
    commonLighting: string
    commonMood: string
    commonStyle: string
  }> {
    await this.ensureAnalysisData(frames)

    const colorProfiles = frames.map(f => this.colorProfiles.get(f.metadata.id)).filter(Boolean) as ColorPaletteAnalysis[]
    const styleProfiles = frames.map(f => this.styleProfiles.get(f.metadata.id)).filter(Boolean) as StyleAnalysis[]

    // 가장 빈번한 특성들 추출
    const allColors = colorProfiles.flatMap(p => p.dominantColors)
    const dominantColors = this.getMostFrequent(allColors, 3)

    const lightingTypes = styleProfiles.map(p => p.lightingType)
    const commonLighting = this.getMostFrequent(lightingTypes, 1)[0] || 'natural'

    const moods = styleProfiles.map(p => p.mood)
    const commonMood = this.getMostFrequent(moods, 1)[0] || 'neutral'

    const styles = styleProfiles.map(p => p.artStyle)
    const commonStyle = this.getMostFrequent(styles, 1)[0] || 'realistic'

    return {
      dominantColors,
      commonLighting,
      commonMood,
      commonStyle
    }
  }

  /**
   * 가장 빈번한 요소들 추출
   */
  private getMostFrequent<T>(items: T[], count: number): T[] {
    const frequency = new Map<T, number>()
    items.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1)
    })

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([item]) => item)
  }

  /**
   * 일관성 프롬프트 구성
   */
  private buildConsistencyPrompt(features: {
    dominantColors: string[]
    commonLighting: string
    commonMood: string
    commonStyle: string
  }): string {
    const parts = [
      `${features.commonStyle} art style`,
      `${features.commonLighting} lighting`,
      `${features.commonMood} mood`
    ]

    if (features.dominantColors.length > 0) {
      parts.push(`color palette: ${features.dominantColors.join(', ')}`)
    }

    return parts.join(', ')
  }

  /**
   * 일관성 개선 권장사항 생성
   */
  private generateConsistencyRecommendations(score: ConsistencyScore): string[] {
    const recommendations: string[] = []

    if (score.color < 0.7) {
      recommendations.push('색상 팔레트의 일관성을 개선하세요. 주요 색상을 통일하거나 색상 조화를 맞추는 것을 고려해보세요.')
    }

    if (score.style < 0.7) {
      recommendations.push('아트 스타일의 일관성을 개선하세요. 동일한 렌더링 기법과 시각적 스타일을 유지해보세요.')
    }

    if (score.lighting < 0.7) {
      recommendations.push('조명의 일관성을 개선하세요. 전체적으로 동일한 조명 환경과 그림자 스타일을 적용해보세요.')
    }

    if (score.composition < 0.7) {
      recommendations.push('구도의 일관성을 개선하세요. 카메라 각도와 프레이밍을 통일해보세요.')
    }

    if (score.overall >= 0.8) {
      recommendations.push('전반적으로 좋은 일관성을 보이고 있습니다. 현재 스타일을 유지하세요.')
    }

    return recommendations
  }

  /**
   * 색상 가이드라인 생성
   */
  private generateColorGuideline(frames: StoryboardFrame[]): string {
    const colorProfiles = frames.map(f => this.colorProfiles.get(f.metadata.id)).filter(Boolean) as ColorPaletteAnalysis[]

    if (colorProfiles.length === 0) return '색상 분석 데이터가 없습니다.'

    const dominantTemperature = this.getMostFrequent(colorProfiles.map(p => p.temperature), 1)[0]
    const dominantBrightness = this.getMostFrequent(colorProfiles.map(p => p.brightness), 1)[0]
    const allColors = colorProfiles.flatMap(p => p.dominantColors)
    const commonColors = this.getMostFrequent(allColors, 5)

    return `주요 색온도: ${dominantTemperature}, 명도: ${dominantBrightness}, 권장 색상: ${commonColors.join(', ')}`
  }

  /**
   * 조명 가이드라인 생성
   */
  private generateLightingGuideline(frames: StoryboardFrame[]): string {
    const styleProfiles = frames.map(f => this.styleProfiles.get(f.metadata.id)).filter(Boolean) as StyleAnalysis[]

    if (styleProfiles.length === 0) return '조명 분석 데이터가 없습니다.'

    const dominantLighting = this.getMostFrequent(styleProfiles.map(p => p.lightingType), 1)[0]
    return `권장 조명 스타일: ${dominantLighting}`
  }

  /**
   * 구도 가이드라인 생성
   */
  private generateCompositionGuideline(frames: StoryboardFrame[]): string {
    const styleProfiles = frames.map(f => this.styleProfiles.get(f.metadata.id)).filter(Boolean) as StyleAnalysis[]

    if (styleProfiles.length === 0) return '구도 분석 데이터가 없습니다.'

    const dominantComposition = this.getMostFrequent(styleProfiles.map(p => p.compositionType), 1)[0]
    return `권장 구도 스타일: ${dominantComposition}`
  }

  /**
   * 전체 가이드라인 생성
   */
  private generateOverallGuideline(frames: StoryboardFrame[]): string {
    const styleProfiles = frames.map(f => this.styleProfiles.get(f.metadata.id)).filter(Boolean) as StyleAnalysis[]

    if (styleProfiles.length === 0) return '스타일 분석 데이터가 없습니다.'

    const dominantStyle = this.getMostFrequent(styleProfiles.map(p => p.artStyle), 1)[0]
    const dominantMood = this.getMostFrequent(styleProfiles.map(p => p.mood), 1)[0]

    return `전체 스타일: ${dominantStyle}, 분위기: ${dominantMood}`
  }
}