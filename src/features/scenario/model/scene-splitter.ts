/**
 * Scene Splitter - 스토리 씬 분할 엔진
 *
 * 긴 스토리를 작업 가능한 씬 단위로 분할하는 비즈니스 로직
 * CLAUDE.md 준수: FSD features 레이어, 도메인 로직 분리
 */

import type {
  Scene,
  Scenario,
  SceneSplitRequest,
  SceneType
} from '../../../entities/scenario'

import { splitStoryIntoScenes } from '../../../shared/lib/gemini-client'
import logger from '../../../shared/lib/logger'

/**
 * 씬 분할 결과 타입
 */
export interface SceneSplitResult {
  success: boolean
  scenes: Scene[]
  splitStrategy: SplitStrategy
  metadata: {
    originalText: string
    targetSceneCount: number
    actualSceneCount: number
    averageSceneDuration: number
    splitMethod: 'ai' | 'rule_based' | 'hybrid'
  }
  warnings: string[]
  error?: string
}

/**
 * 분할 전략 타입
 */
export type SplitStrategy = 
  | 'natural_breaks'    // 자연스러운 단락 기준
  | 'duration_based'    // 지속시간 기준
  | 'content_based'     // 내용 의미 기준
  | 'hybrid'           // 혼합 방식
  | 'ai_guided'        // AI 주도 분할

/**
 * 분할 옵션
 */
export interface SceneSplitOptions {
  strategy?: SplitStrategy
  useAI?: boolean
  fallbackToRuleBased?: boolean
  preserveDialogue?: boolean
  minSceneDuration?: number
  maxSceneDuration?: number
  targetSceneCount?: number
}

/**
 * 씬 분할 엔진 클래스
 */
export class SceneSplitter {
  /**
   * 스토리 텍스트를 씬들로 분할
   */
  static async splitStory(
    storyText: string,
    options: SceneSplitOptions = {}
  ): Promise<SceneSplitResult> {
    const {
      strategy = 'hybrid',
      useAI = true,
      fallbackToRuleBased = true,
      minSceneDuration = 10,
      maxSceneDuration = 120,
      targetSceneCount = 5
    } = options

    try {
      logger.info('씬 분할 시작', {
        strategy,
        textLength: storyText.length,
        targetSceneCount
      })

      let scenes: Omit<Scene, 'id'>[] = []
      let splitMethod: 'ai' | 'rule_based' | 'hybrid' = 'rule_based'
      const warnings: string[] = []

      // AI 기반 분할 시도
      if (useAI && (strategy === 'ai_guided' || strategy === 'hybrid')) {
        try {
          const aiRequest: SceneSplitRequest = {
            storyText,
            targetSceneCount,
            maxSceneDuration
          }

          scenes = await splitStoryIntoScenes(aiRequest)
          splitMethod = 'ai'
          
          logger.info('AI 기반 씬 분할 성공', {
            sceneCount: scenes.length
          })

        } catch (error) {
          logger.warn('AI 분할 실패, 규칙 기반으로 폴백', {
            error: error instanceof Error ? error.message : String(error)
          })
          
          if (!fallbackToRuleBased) {
            throw error
          }
          warnings.push('AI 분할에 실패하여 규칙 기반 분할을 사용하였습니다.')
        }
      }

      // 규칙 기반 분할 (폴백 또는 기본 전략)
      if (scenes.length === 0) {
        scenes = this.ruleBasedSplit(storyText, {
          strategy,
          minSceneDuration,
          maxSceneDuration,
          targetSceneCount,
          preserveDialogue: options.preserveDialogue
        })
        splitMethod = splitMethod === 'ai' ? 'hybrid' : 'rule_based'
      }

      // 씬 ID 추가 및 최종 검증
      const finalScenes: Scene[] = scenes.map((scene, index) => ({
        ...scene,
        id: `scene_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        order: index + 1
      }))

      // 관리 가능한 범위로 조정
      const validatedScenes = this.validateAndAdjustScenes(finalScenes, {
        minSceneDuration,
        maxSceneDuration,
        targetSceneCount
      })

      const result: SceneSplitResult = {
        success: true,
        scenes: validatedScenes,
        splitStrategy: strategy,
        metadata: {
          originalText: storyText,
          targetSceneCount,
          actualSceneCount: validatedScenes.length,
          averageSceneDuration: validatedScenes.reduce((sum, scene) => sum + (scene.duration || 0), 0) / validatedScenes.length,
          splitMethod
        },
        warnings
      }

      logger.info('씬 분할 완료', {
        sceneCount: validatedScenes.length,
        method: splitMethod,
        warningCount: warnings.length
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '씬 분할 중 알 수 없는 오류가 발생했습니다.'
      
      logger.error('씬 분할 실패', {
        error: errorMessage,
        strategy,
        textLength: storyText.length
      })

      return {
        success: false,
        scenes: [],
        splitStrategy: strategy,
        metadata: {
          originalText: storyText,
          targetSceneCount,
          actualSceneCount: 0,
          averageSceneDuration: 0,
          splitMethod: 'rule_based'
        },
        warnings: [],
        error: errorMessage
      }
    }
  }

  /**
   * 기존 시나리오의 씬들을 재분할
   */
  static async resplitScenario(
    scenario: Scenario,
    newTargetCount: number,
    options: SceneSplitOptions = {}
  ): Promise<SceneSplitResult> {
    try {
      // 기존 씬들을 텍스트로 병합
      const combinedText = scenario.scenes
        .map(scene => {
          const parts = []
          if (scene.title) parts.push(`[제목: ${scene.title}]`)
          if (scene.description) parts.push(scene.description)
          if (scene.dialogue) parts.push(`대사: ${scene.dialogue}`)
          if (scene.actionDescription) parts.push(`액션: ${scene.actionDescription}`)
          return parts.join(' ')
        })
        .join('\n\n')

      return await this.splitStory(combinedText, {
        ...options,
        targetSceneCount: newTargetCount
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '시나리오 재분할 중 오류가 발생했습니다.'
      
      logger.error('시나리오 재분할 실패', {
        scenarioId: scenario.metadata.id,
        error: errorMessage
      })

      return {
        success: false,
        scenes: scenario.scenes, // 기존 씬 유지
        splitStrategy: 'hybrid',
        metadata: {
          originalText: '',
          targetSceneCount: newTargetCount,
          actualSceneCount: scenario.scenes.length,
          averageSceneDuration: 0,
          splitMethod: 'rule_based'
        },
        warnings: [],
        error: errorMessage
      }
    }
  }

  // === Private Helper Methods ===

  /**
   * 규칙 기반 씬 분할
   */
  private static ruleBasedSplit(
    text: string,
    options: {
      strategy: SplitStrategy
      minSceneDuration: number
      maxSceneDuration: number
      targetSceneCount: number
      preserveDialogue?: boolean
    }
  ): Omit<Scene, 'id'>[] {
    const { strategy, minSceneDuration, maxSceneDuration, targetSceneCount } = options

    let splitPoints: number[] = []

    switch (strategy) {
      case 'natural_breaks':
        splitPoints = this.findNaturalBreaks(text)
        break
        
      case 'duration_based':
        splitPoints = this.findDurationBasedSplits(text, targetSceneCount)
        break
        
      case 'content_based':
        splitPoints = this.findContentBasedSplits(text)
        break
        
      default: // hybrid
        const naturalBreaks = this.findNaturalBreaks(text)
        const contentBreaks = this.findContentBasedSplits(text)
        splitPoints = [...new Set([...naturalBreaks, ...contentBreaks])].sort((a, b) => a - b)
        break
    }

    // 분할 지점을 기반으로 씬 생성
    const scenes: Omit<Scene, 'id'>[] = []
    const paragraphs = text.split(/\n\s*\n/)
    
    let currentStart = 0
    splitPoints.push(paragraphs.length)

    splitPoints.forEach((splitPoint, index) => {
      if (splitPoint > currentStart) {
        const sceneText = paragraphs.slice(currentStart, splitPoint).join('\n\n')
        
        if (sceneText.trim()) {
          const scene = this.createSceneFromText(sceneText, index + 1, {
            minDuration: minSceneDuration,
            maxDuration: maxSceneDuration
          })
          scenes.push(scene)
        }
        
        currentStart = splitPoint
      }
    })

    return scenes.length > 0 ? scenes : [this.createDefaultScene(text)]
  }

  /**
   * 자연스러운 단락 찾기
   */
  private static findNaturalBreaks(text: string): number[] {
    const paragraphs = text.split(/\n\s*\n/)
    const breaks: number[] = []

    paragraphs.forEach((paragraph, index) => {
      // 전환 단어 탐지
      const transitionWords = /\b(그뒤|Meanwhile|한편|이어서|다음날|나중에)\b/i
      if (transitionWords.test(paragraph)) {
        breaks.push(index + 1)
      }

      // 장면 전환 표시어 탐지
      const sceneMarkers = /\b(FADE IN|FADE OUT|CUT TO|장면 전환|컷|페이드)\b/i
      if (sceneMarkers.test(paragraph)) {
        breaks.push(index + 1)
      }
    })

    return breaks
  }

  /**
   * 지속시간 기반 분할 지점 찾기
   */
  private static findDurationBasedSplits(text: string, targetCount: number): number[] {
    const paragraphs = text.split(/\n\s*\n/)
    const segmentSize = Math.ceil(paragraphs.length / targetCount)
    const breaks: number[] = []

    for (let i = segmentSize; i < paragraphs.length; i += segmentSize) {
      breaks.push(i)
    }

    return breaks
  }

  /**
   * 내용 기반 분할 지점 찾기
   */
  private static findContentBasedSplits(text: string): number[] {
    const paragraphs = text.split(/\n\s*\n/)
    const breaks: number[] = []

    paragraphs.forEach((paragraph, index) => {
      // 대화 시작/끝 탐지
      if (paragraph.includes(':') || paragraph.includes('대사')) {
        breaks.push(index)
      }

      // 액션 시퀀스 탐지
      const actionWords = /\b(달리기|뛰기|움직이기|잡기|둘러보기)\b/
      if (actionWords.test(paragraph)) {
        breaks.push(index + 1)
      }
    })

    return breaks
  }

  /**
   * 텍스트에서 씬 생성
   */
  private static createSceneFromText(
    text: string,
    order: number,
    options: { minDuration: number; maxDuration: number }
  ): Omit<Scene, 'id'> {
    const { minDuration, maxDuration } = options
    
    // 대략적인 지속시간 계산 (단어 수 기반)
    const wordCount = text.split(/\s+/).length
    const estimatedDuration = Math.max(minDuration, Math.min(maxDuration, wordCount * 2)) // 1단어당 2초

    // 제목 추출 (첫 번째 문장 또는 기본값)
    const firstSentence = text.split(/[.!?]\s+/)[0]?.trim()
    const title = firstSentence && firstSentence.length < 50 
      ? firstSentence 
      : `씬 ${order}`

    // 씬 타입 추론
    let sceneType: SceneType = 'dialogue'
    if (text.includes(':') || text.includes('대사')) {
      sceneType = 'dialogue'
    } else if (/\b(달리기|뛰기|움직이기)\b/.test(text)) {
      sceneType = 'action'
    } else if (/\b(전환|컷|페이드)\b/.test(text)) {
      sceneType = 'transition'
    }

    return {
      order,
      type: sceneType,
      title,
      description: text,
      duration: estimatedDuration,
      location: '스튜디오', // 기본값
      characters: [],
      actionDescription: sceneType === 'action' ? text : undefined,
      notes: `자동 분할된 씬 (${wordCount}단어)`,
      visualElements: []
    }
  }

  /**
   * 기본 씬 생성 (폴백)
   */
  private static createDefaultScene(text: string): Omit<Scene, 'id'> {
    return {
      order: 1,
      type: 'dialogue',
      title: '전체 스토리',
      description: text,
      duration: 60,
      location: '스튜디오',
      characters: ['나레이터'],
      notes: '분할되지 않은 전체 스토리',
      visualElements: []
    }
  }

  /**
   * 씬 검증 및 조정
   */
  private static validateAndAdjustScenes(
    scenes: Scene[],
    constraints: {
      minSceneDuration: number
      maxSceneDuration: number
      targetSceneCount: number
    }
  ): Scene[] {
    const { minSceneDuration, maxSceneDuration, targetSceneCount } = constraints
    let adjustedScenes = [...scenes]

    // 너무 짧은 씬 병합
    adjustedScenes = this.mergeShortScenes(adjustedScenes, minSceneDuration)

    // 너무 긴 씬 분할
    adjustedScenes = this.splitLongScenes(adjustedScenes, maxSceneDuration)

    // 목표 수에 맞춰 조정
    if (adjustedScenes.length > targetSceneCount * 1.5) {
      adjustedScenes = this.mergeExcessScenes(adjustedScenes, targetSceneCount)
    }

    // 순서 재정렬
    adjustedScenes.forEach((scene, index) => {
      scene.order = index + 1
    })

    return adjustedScenes
  }

  private static mergeShortScenes(scenes: Scene[], minDuration: number): Scene[] {
    const result: Scene[] = []
    let currentScene: Scene | null = null

    scenes.forEach(scene => {
      if (!currentScene) {
        currentScene = { ...scene }
        return
      }

      if ((currentScene.duration || 0) < minDuration) {
        // 이전 씬과 병합
        currentScene.description += '\n\n' + scene.description
        currentScene.duration = (currentScene.duration || 0) + (scene.duration || 0)
        currentScene.title += ` & ${scene.title}`
        
        if (scene.dialogue) {
          currentScene.dialogue = (currentScene.dialogue || '') + '\n' + scene.dialogue
        }
      } else {
        result.push(currentScene)
        currentScene = { ...scene }
      }
    })

    if (currentScene) {
      result.push(currentScene)
    }

    return result
  }

  private static splitLongScenes(scenes: Scene[], maxDuration: number): Scene[] {
    const result: Scene[] = []

    scenes.forEach(scene => {
      if ((scene.duration || 0) <= maxDuration) {
        result.push(scene)
        return
      }

      // 긴 씬 분할
      const splitCount = Math.ceil((scene.duration || 0) / maxDuration)
      const splitDuration = (scene.duration || 0) / splitCount
      const paragraphs = scene.description.split(/\n\s*\n/)
      const paragraphsPerSplit = Math.ceil(paragraphs.length / splitCount)

      for (let i = 0; i < splitCount; i++) {
        const startIdx = i * paragraphsPerSplit
        const endIdx = Math.min(startIdx + paragraphsPerSplit, paragraphs.length)
        const splitParagraphs = paragraphs.slice(startIdx, endIdx)

        result.push({
          ...scene,
          id: `${scene.id}_split_${i}`,
          title: `${scene.title} (파트 ${i + 1})`,
          description: splitParagraphs.join('\n\n'),
          duration: splitDuration,
          notes: `${scene.notes || ''} (긴 씬 분할 ${i + 1}/${splitCount})`.trim()
        })
      }
    })

    return result
  }

  private static mergeExcessScenes(scenes: Scene[], targetCount: number): Scene[] {
    if (scenes.length <= targetCount) return scenes

    const result: Scene[] = []
    const mergeRatio = scenes.length / targetCount
    
    for (let i = 0; i < targetCount; i++) {
      const startIdx = Math.floor(i * mergeRatio)
      const endIdx = Math.floor((i + 1) * mergeRatio)
      const scenesToMerge = scenes.slice(startIdx, endIdx)

      if (scenesToMerge.length === 1) {
        result.push(scenesToMerge[0])
      } else if (scenesToMerge.length > 1) {
        // 여러 씬 병합
        const mergedScene: Scene = {
          ...scenesToMerge[0],
          title: scenesToMerge.map(s => s.title).join(' + '),
          description: scenesToMerge.map(s => s.description).join('\n\n'),
          duration: scenesToMerge.reduce((sum, s) => sum + (s.duration || 0), 0),
          notes: `병합된 씬 (${scenesToMerge.length}개 씬)`,
          characters: [...new Set(scenesToMerge.flatMap(s => s.characters || []))]
        }
        result.push(mergedScene)
      }
    }

    return result
  }
}

/**
 * 씬 분할 유틸리티 함수들
 */
export const sceneSplitterUtils = {
  /**
   * 텍스트 복잡도 분석
   */
  analyzeTextComplexity: (text: string) => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim())
    const words = text.split(/\s+/)
    const paragraphs = text.split(/\n\s*\n/)
    
    return {
      sentenceCount: sentences.length,
      wordCount: words.length,
      paragraphCount: paragraphs.length,
      averageWordsPerSentence: words.length / sentences.length,
      complexityScore: Math.min(100, (sentences.length * 2 + words.length * 0.1) / 10),
      recommendedSceneCount: Math.max(3, Math.min(12, Math.ceil(paragraphs.length / 3)))
    }
  },

  /**
   * 최적 분할 전략 제안
   */
  suggestSplitStrategy: (text: string, targetDuration: number) => {
    const analysis = sceneSplitterUtils.analyzeTextComplexity(text)
    
    if (analysis.complexityScore > 70) {
      return 'ai_guided' // 복잡한 텍스트는 AI 사용
    } else if (targetDuration > 300) {
      return 'duration_based' // 긴 영상은 지속시간 기반
    } else if (analysis.paragraphCount > 10) {
      return 'content_based' // 많은 단락은 내용 기반
    } else {
      return 'natural_breaks' // 기본적인 경우
    }
  }
}
