/**
 * Story Generator - AI 스토리 생성 유스케이스
 *
 * Gemini API를 활용한 스토리 생성 비즈니스 로직
 * CLAUDE.md 준수: FSD features 레이어, 유스케이스 오케스트레이션
 */

import type {
  StoryGenerationRequest,
  StoryGenerationResponse,
  Scenario,
  ScenarioCreateInput
} from '../../../entities/scenario'

import { ScenarioModel } from '../../../entities/scenario'
import { generateStoryWithGemini } from '../../../shared/lib/gemini-client'
import logger from '../../../shared/lib/logger'

/**
 * 스토리 생성 결과 타입
 */
export interface StoryGenerationResult {
  success: boolean
  scenario?: Scenario
  generatedContent?: StoryGenerationResponse
  error?: string
  usage?: {
    tokensUsed: number
    requestDuration: number
    apiCalls: number
  }
}

/**
 * 스토리 생성 옵션
 */
export interface StoryGenerationOptions {
  saveToDatabase?: boolean
  validateResult?: boolean
  retryOnFailure?: boolean
  maxRetries?: number
}

/**
 * AI 스토리 생성기 클래스
 */
export class StoryGenerator {
  /**
   * 프롬프트를 기반으로 완전한 시나리오 생성
   */
  static async generateScenario(
    input: ScenarioCreateInput,
    request: StoryGenerationRequest,
    options: StoryGenerationOptions = {}
  ): Promise<StoryGenerationResult> {
    const startTime = Date.now()
    const {
      validateResult = true,
      retryOnFailure = true,
      maxRetries = 2
    } = options

    try {
      logger.info('스토리 생성 시작', {
        prompt: request.prompt,
        genre: request.genre,
        targetDuration: request.targetDuration,
        userId: input.userId
      })

      let attempts = 0
      let lastError: Error | null = null

      while (attempts <= maxRetries) {
        try {
          attempts++
          
          // AI로 스토리 생성
          const generatedContent = await generateStoryWithGemini(request)
          
          // 기본 시나리오 엔티티 생성
          let scenario = ScenarioModel.create(input)
          
          // AI 생성 내용으로 업데이트
          scenario = ScenarioModel.update(scenario, {
            scenes: generatedContent.scenes.map(scene => ({
              ...scene,
              id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            })),
            storyOutline: generatedContent.storyOutline,
            keywords: generatedContent.suggestedKeywords
          })

          // 검증 (옵션)
          if (validateResult) {
            const validation = ScenarioModel.validate(scenario)
            if (!validation.isValid) {
              const errorMessage = validation.errors.map(e => e.message).join(', ')
              throw new Error(`생성된 시나리오 검증 실패: ${errorMessage}`)
            }

            if (validation.warnings && validation.warnings.length > 0) {
              logger.warn('시나리오 검증 경고', {
                warnings: validation.warnings,
                scenarioId: scenario.metadata.id
              })
            }
          }

          const duration = Date.now() - startTime
          
          logger.info('스토리 생성 완료', {
            scenarioId: scenario.metadata.id,
            sceneCount: scenario.scenes.length,
            duration: `${duration}ms`,
            attempts
          })

          return {
            success: true,
            scenario,
            generatedContent,
            usage: {
              tokensUsed: 0, // Gemini API에서 제공되지 않음
              requestDuration: duration,
              apiCalls: attempts
            }
          }

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          
          logger.warn(`스토리 생성 시도 ${attempts} 실패`, {
            error: lastError.message,
            prompt: request.prompt,
            willRetry: retryOnFailure && attempts <= maxRetries
          })

          if (!retryOnFailure || attempts > maxRetries) {
            break
          }

          // 재시도 전 대기 (지수 백오프)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
        }
      }

      // 모든 시도 실패
      const errorMessage = `스토리 생성 실패 (${attempts}회 시도): ${lastError?.message || '알 수 없는 오류'}`
      
      logger.error('스토리 생성 최종 실패', {
        error: errorMessage,
        prompt: request.prompt,
        attempts
      })

      return {
        success: false,
        error: errorMessage,
        usage: {
          tokensUsed: 0,
          requestDuration: Date.now() - startTime,
          apiCalls: attempts
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      
      logger.error('스토리 생성 시스템 오류', {
        error: errorMessage,
        prompt: request.prompt
      })

      return {
        success: false,
        error: errorMessage,
        usage: {
          tokensUsed: 0,
          requestDuration: Date.now() - startTime,
          apiCalls: 0
        }
      }
    }
  }

  /**
   * 기존 스토리 개선/재생성
   */
  static async regenerateStory(
    scenario: Scenario,
    improvementPrompt: string,
    options: StoryGenerationOptions = {}
  ): Promise<StoryGenerationResult> {
    try {
      // 기존 정보를 바탕으로 개선 요청 생성
      const request: StoryGenerationRequest = {
        prompt: `기존 스토리를 다음 요구사항에 맞춰 개선해주세요:

기존 스토리: ${scenario.storyOutline}

개선 요구사항: ${improvementPrompt}`,
        genre: scenario.metadata.genre,
        targetDuration: scenario.metadata.targetDuration,
        style: 'professional',
        tone: 'informative'
      }

      const input: ScenarioCreateInput = {
        title: `${scenario.metadata.title} (개선됨)`,
        description: scenario.metadata.description,
        genre: scenario.metadata.genre,
        targetDuration: scenario.metadata.targetDuration,
        storyPrompt: request.prompt,
        userId: scenario.metadata.userId
      }

      return await this.generateScenario(input, request, options)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리 재생성 중 오류가 발생했습니다.'
      
      logger.error('스토리 재생성 오류', {
        scenarioId: scenario.metadata.id,
        error: errorMessage,
        improvementPrompt
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 프롬프트 전처리 및 최적화
   */
  static optimizePrompt(prompt: string, context?: {
    genre?: string
    targetAudience?: string
    platform?: string
  }): string {
    let optimizedPrompt = prompt.trim()

    // 기본 컨텍스트 추가
    if (context) {
      const contextParts = []
      
      if (context.genre) {
        contextParts.push(`장르: ${context.genre}`)
      }
      
      if (context.targetAudience) {
        contextParts.push(`대상 관객: ${context.targetAudience}`)
      }
      
      if (context.platform) {
        contextParts.push(`플랫폼: ${context.platform}`)
      }

      if (contextParts.length > 0) {
        optimizedPrompt = `${contextParts.join(', ')}에 적합한 ${optimizedPrompt}`
      }
    }

    // 명확한 지시사항 추가
    if (!optimizedPrompt.includes('영상') && !optimizedPrompt.includes('비디오')) {
      optimizedPrompt = `영상 콘텐츠를 위한 ${optimizedPrompt}`
    }

    return optimizedPrompt
  }

  /**
   * 스토리 생성 가능성 검증
   */
  static validatePrompt(prompt: string): {
    isValid: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    // 기본 검증
    if (!prompt || prompt.trim().length === 0) {
      issues.push('프롬프트가 비어있습니다.')
    }

    if (prompt.length < 10) {
      issues.push('프롬프트가 너무 짧습니다. 최소 10자 이상 입력해주세요.')
    }

    if (prompt.length > 500) {
      issues.push('프롬프트가 너무 깁니다. 500자 이하로 입력해주세요.')
      suggestions.push('핵심 내용만 간결하게 요약해보세요.')
    }

    // 콘텐츠 관련 검증
    const hasAction = /\b(액션|동작|움직임|실행)\b/.test(prompt)
    const hasDescription = /\b(설명|묘사|표현|보여)\b/.test(prompt)
    const hasObjective = /\b(목적|목표|전달|소개)\b/.test(prompt)

    if (!hasAction && !hasDescription && !hasObjective) {
      suggestions.push('구체적인 액션이나 목적을 포함하면 더 좋은 스토리가 생성됩니다.')
    }

    // 부적절한 내용 검사
    const inappropriateKeywords = ['폭력', '선정적', '차별', '혐오']
    const hasInappropriateContent = inappropriateKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    )

    if (hasInappropriateContent) {
      issues.push('부적절한 내용이 포함되어 있을 수 있습니다.')
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    }
  }
}

/**
 * 스토리 생성 헬퍼 함수들
 */
export const StoryGeneratorHelpers = {
  /**
   * 장르별 기본 설정 반환
   */
  getGenreDefaults: (genre: string) => {
    const defaults = {
      '브이로그': {
        style: 'casual' as const,
        tone: 'humorous' as const,
        targetDuration: 180
      },
      '교육': {
        style: 'educational' as const,
        tone: 'informative' as const,
        targetDuration: 300
      },
      '마케팅': {
        style: 'professional' as const,
        tone: 'serious' as const,
        targetDuration: 120
      },
      '엔터테인먼트': {
        style: 'creative' as const,
        tone: 'humorous' as const,
        targetDuration: 240
      }
    }

    return defaults[genre as keyof typeof defaults] || {
      style: 'professional' as const,
      tone: 'informative' as const,
      targetDuration: 300
    }
  },

  /**
   * 예상 비용 계산 (토큰 기반)
   */
  estimateGenerationCost: (prompt: string, targetDuration: number) => {
    const baseTokens = Math.ceil(prompt.length / 4) // 대략적인 토큰 수
    const durationMultiplier = Math.ceil(targetDuration / 60) // 분 단위
    const estimatedTokens = baseTokens * durationMultiplier * 2 // 입력 + 출력
    
    return {
      estimatedTokens,
      estimatedCostUSD: estimatedTokens * 0.00001, // 예상 비용 (실제와 다를 수 있음)
      warningLevel: estimatedTokens > 5000 ? 'high' : estimatedTokens > 2000 ? 'medium' : 'low'
    }
  }
}

// StoryGenerator에 헬퍼 메서드들 추가
StoryGenerator.getGenreDefaults = StoryGeneratorHelpers.getGenreDefaults
StoryGenerator.estimateGenerationCost = StoryGeneratorHelpers.estimateGenerationCost

// Export helpers for Public API
export const storyGeneratorHelpers = StoryGeneratorHelpers
