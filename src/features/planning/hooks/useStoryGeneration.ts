/**
 * useStoryGeneration Hook
 *
 * Gemini API를 사용한 4단계 스토리 생성 기능
 * CLAUDE.md 준수: 비용 안전 미들웨어, $300 사건 방지
 */

import { useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'

import type {
  PlanningInputData,
  StoryStep,
  StoryGenerationRequest,
  StoryGenerationResponse,
  WizardStep,
} from '../../../entities/planning'

import {
  validatePlanningInput,
  createDefaultStorySteps,
} from '../../../entities/planning'

import { planningActions } from '../store/planning-slice'
import { geminiClient } from '../../../shared/lib/gemini-client'
import logger from '../../../shared/lib/logger'

/**
 * 스토리 생성 상태
 */
export interface UseStoryGenerationState {
  isGenerating: boolean
  progress: number // 0-100
  currentStep: StoryGenerationStep
  lastResult: StoryGenerationResponse | null
  error: string | null
  retryCount: number
}

/**
 * 생성 단계
 */
export type StoryGenerationStep =
  | 'idle'
  | 'preparing'
  | 'generating_outline'
  | 'creating_steps'
  | 'validating'
  | 'completed'
  | 'error'

/**
 * Hook 옵션
 */
export interface UseStoryGenerationOptions {
  maxRetries?: number
  onStepChange?: (step: StoryGenerationStep, progress: number) => void
  onSuccess?: (result: StoryGenerationResponse) => void
  onError?: (error: string) => void
}

/**
 * 4단계 스토리 생성 Hook
 */
export function useStoryGeneration(options: UseStoryGenerationOptions = {}) {
  const {
    maxRetries = 3,
    onStepChange,
    onSuccess,
    onError,
  } = options

  const dispatch = useDispatch()

  // 내부 상태
  const [state, setState] = useState<UseStoryGenerationState>({
    isGenerating: false,
    progress: 0,
    currentStep: 'idle',
    lastResult: null,
    error: null,
    retryCount: 0,
  })

  // 취소를 위한 AbortController
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<UseStoryGenerationState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates }

      // 단계 변경 알림
      if (onStepChange && updates.currentStep) {
        onStepChange(updates.currentStep, newState.progress)
      }

      return newState
    })
  }, [onStepChange])

  /**
   * 진행률 업데이트
   */
  const updateProgress = useCallback((step: StoryGenerationStep, progress: number) => {
    updateState({ currentStep: step, progress })
  }, [updateState])

  /**
   * 4단계 스토리 생성
   */
  const generateStory = useCallback(async (
    inputData: PlanningInputData
  ): Promise<StoryGenerationResponse | null> => {
    // 이미 생성 중인 경우 방지 - $300 사건 방지
    if (state.isGenerating) {
      logger.warn('이미 스토리 생성이 진행 중입니다.')
      return null
    }

    // 입력 검증
    const validation = validatePlanningInput(inputData)
    if (!validation.isValid) {
      const errorMessage = validation.errors[0]?.message || '입력 데이터가 유효하지 않습니다'
      updateState({ error: errorMessage })
      onError?.(errorMessage)
      return null
    }

    try {
      // AbortController 설정
      abortControllerRef.current = new AbortController()

      // 초기 상태 설정
      updateState({
        isGenerating: true,
        progress: 0,
        currentStep: 'preparing',
        error: null,
        lastResult: null,
      })

      dispatch(planningActions.setLoading(true))

      // 1단계: 준비 (10%)
      updateProgress('preparing', 10)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 2단계: 아웃라인 생성 (40%)
      updateProgress('generating_outline', 40)

      const request: StoryGenerationRequest = {
        inputData,
      }

      // Gemini API 호출 - 비용 안전 미들웨어 적용
      const apiResponse = await geminiClient.generateStory({
        prompt: buildStoryPrompt(inputData),
        genre: inputData.toneAndManner,
        targetDuration: inputData.targetDuration,
        style: mapToneToStyle(inputData.toneAndManner),
        tone: mapDevelopmentToTone(inputData.development),
      })

      // 3단계: 4단계 구조로 변환 (70%)
      updateProgress('creating_steps', 70)

      const storySteps = await convertToFourSteps(apiResponse, inputData)

      // 4단계: 검증 (90%)
      updateProgress('validating', 90)

      const result: StoryGenerationResponse = {
        storySteps,
        estimatedDuration: storySteps.reduce((sum, step) => sum + (step.duration || 0), 0),
        suggestedKeywords: apiResponse.suggestedKeywords || extractKeywords(inputData),
        rationale: generateRationale(inputData, storySteps),
      }

      // 완료 (100%)
      updateState({
        isGenerating: false,
        progress: 100,
        currentStep: 'completed',
        lastResult: result,
        retryCount: 0,
      })

      // Redux 상태 업데이트
      dispatch(planningActions.updateStorySteps(storySteps))

      onSuccess?.(result)

      logger.info('스토리 생성 성공', {
        stepsCount: storySteps.length,
        totalDuration: result.estimatedDuration,
        toneAndManner: inputData.toneAndManner,
        development: inputData.development,
      })

      // 비용 로그
      logger.logCostEvent('gemini_story_generation', 0.015, {
        stepsCount: storySteps.length,
        promptLength: inputData.logline.length,
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리 생성에 실패했습니다'

      // 에러 상태
      updateState({
        isGenerating: false,
        progress: 0,
        currentStep: 'error',
        error: errorMessage,
        retryCount: state.retryCount + 1,
      })

      onError?.(errorMessage)

      logger.error('스토리 생성 오류', {
        error: errorMessage,
        inputData,
        retryCount: state.retryCount,
      })

      return null

    } finally {
      dispatch(planningActions.setLoading(false))
      abortControllerRef.current = null
    }
  }, [state.isGenerating, state.retryCount, dispatch, updateState, updateProgress, onSuccess, onError])

  /**
   * 스토리 재생성
   */
  const regenerateStory = useCallback(async (
    inputData: PlanningInputData,
    improvementPrompt?: string
  ): Promise<StoryGenerationResponse | null> => {
    if (state.retryCount >= maxRetries) {
      const errorMessage = `최대 재시도 횟수(${maxRetries})를 초과했습니다`
      updateState({ error: errorMessage })
      onError?.(errorMessage)
      return null
    }

    // 개선 프롬프트가 있으면 입력에 반영
    const enhancedInputData: PlanningInputData = improvementPrompt
      ? {
          ...inputData,
          additionalNotes: `${inputData.additionalNotes || ''}\n개선 요청: ${improvementPrompt}`.trim(),
        }
      : inputData

    return generateStory(enhancedInputData)
  }, [state.retryCount, maxRetries, generateStory, updateState, onError])

  /**
   * 기본 템플릿 사용
   */
  const useDefaultTemplate = useCallback((): void => {
    const defaultSteps = createDefaultStorySteps()
    const storySteps: StoryStep[] = defaultSteps.map((step, index) => ({
      ...step,
      id: `step_${Date.now()}_${index}`,
    }))

    const result: StoryGenerationResponse = {
      storySteps,
      estimatedDuration: storySteps.reduce((sum, step) => sum + (step.duration || 0), 0),
      suggestedKeywords: ['영상 기획', '스토리텔링'],
      rationale: '기본 4단계 구조 템플릿을 사용했습니다.',
    }

    updateState({
      isGenerating: false,
      progress: 100,
      currentStep: 'completed',
      lastResult: result,
      error: null,
    })

    dispatch(planningActions.updateStorySteps(storySteps))
    onSuccess?.(result)

    logger.info('기본 템플릿 사용', {
      stepsCount: storySteps.length,
    })
  }, [dispatch, updateState, onSuccess])

  /**
   * 생성 취소
   */
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    updateState({
      isGenerating: false,
      progress: 0,
      currentStep: 'idle',
      error: null,
    })

    dispatch(planningActions.setLoading(false))

    logger.info('스토리 생성이 취소되었습니다.')
  }, [updateState, dispatch])

  /**
   * 에러 클리어
   */
  const clearError = useCallback(() => {
    updateState({ error: null, currentStep: 'idle' })
  }, [updateState])

  /**
   * 상태 리셋
   */
  const reset = useCallback(() => {
    if (state.isGenerating) {
      cancelGeneration()
    }

    setState({
      isGenerating: false,
      progress: 0,
      currentStep: 'idle',
      lastResult: null,
      error: null,
      retryCount: 0,
    })
  }, [state.isGenerating, cancelGeneration])

  return {
    // 상태
    state,
    isGenerating: state.isGenerating,
    progress: state.progress,
    currentStep: state.currentStep,
    error: state.error,
    lastResult: state.lastResult,
    retryCount: state.retryCount,
    canRetry: state.retryCount < maxRetries,

    // 액션
    generateStory,
    regenerateStory,
    useDefaultTemplate,
    cancelGeneration,
    clearError,
    reset,
  }
}

/**
 * 프롬프트 빌더
 */
function buildStoryPrompt(inputData: PlanningInputData): string {
  const { title, logline, toneAndManner, development, intensity, targetDuration, additionalNotes } = inputData

  return `
영상 제목: ${title}
한 줄 스토리: ${logline}
톤앤매너: ${toneAndManner}
전개 방식: ${development}
스토리 강도: ${intensity}
목표 시간: ${targetDuration || 180}초
${additionalNotes ? `추가 요청사항: ${additionalNotes}` : ''}

위 정보를 바탕으로 4단계 구조의 영상 스토리를 작성해주세요:
1. 도입부 (관심 유발)
2. 전개부 (핵심 내용)
3. 심화부 (상세 설명)
4. 마무리 (정리 및 행동 유도)

각 단계별로 제목, 설명, 예상 시간, 핵심 포인트를 포함해주세요.
  `.trim()
}

/**
 * 톤앤매너를 AI 스타일로 매핑
 */
function mapToneToStyle(tone: string): 'casual' | 'professional' | 'creative' | 'educational' {
  switch (tone) {
    case 'casual': return 'casual'
    case 'professional': return 'professional'
    case 'creative': return 'creative'
    case 'educational': return 'educational'
    case 'marketing': return 'professional'
    default: return 'professional'
  }
}

/**
 * 전개 방식을 AI 톤으로 매핑
 */
function mapDevelopmentToTone(development: string): 'serious' | 'humorous' | 'dramatic' | 'informative' {
  switch (development) {
    case 'linear': return 'informative'
    case 'dramatic': return 'dramatic'
    case 'problem_solution': return 'serious'
    case 'comparison': return 'informative'
    case 'tutorial': return 'informative'
    default: return 'informative'
  }
}

/**
 * AI 응답을 4단계 구조로 변환
 */
async function convertToFourSteps(
  apiResponse: any,
  inputData: PlanningInputData
): Promise<StoryStep[]> {
  const targetDuration = inputData.targetDuration || 180
  const stepDurations = calculateStepDurations(targetDuration, inputData.development)

  const storySteps: StoryStep[] = []
  const scenes = apiResponse.scenes || []

  // 4단계로 그룹화
  const stepTitles = ['도입부', '전개부', '심화부', '마무리']
  const scenesPerStep = Math.ceil(scenes.length / 4)

  for (let i = 0; i < 4; i++) {
    const startIdx = i * scenesPerStep
    const endIdx = Math.min(startIdx + scenesPerStep, scenes.length)
    const stepScenes = scenes.slice(startIdx, endIdx)

    const step: StoryStep = {
      id: `step_${Date.now()}_${i}`,
      order: i + 1,
      title: stepTitles[i],
      description: stepScenes.map((scene: any) => scene.description).join(' '),
      duration: stepDurations[i],
      keyPoints: stepScenes.map((scene: any) => scene.title).filter(Boolean),
    }

    storySteps.push(step)
  }

  return storySteps
}

/**
 * 전개 방식에 따른 단계별 시간 배분
 */
function calculateStepDurations(totalDuration: number, development: string): number[] {
  const ratios = (() => {
    switch (development) {
      case 'linear': return [0.2, 0.3, 0.3, 0.2] // 균등 분배
      case 'dramatic': return [0.15, 0.25, 0.4, 0.2] // 심화부 강조
      case 'problem_solution': return [0.25, 0.2, 0.35, 0.2] // 도입부와 심화부 강조
      case 'comparison': return [0.2, 0.35, 0.25, 0.2] // 전개부 강조
      case 'tutorial': return [0.15, 0.3, 0.4, 0.15] // 심화부 강조
      default: return [0.2, 0.3, 0.3, 0.2]
    }
  })()

  return ratios.map(ratio => Math.round(totalDuration * ratio))
}

/**
 * 키워드 추출
 */
function extractKeywords(inputData: PlanningInputData): string[] {
  const keywords = [inputData.toneAndManner, inputData.development]

  if (inputData.logline.length > 0) {
    // 간단한 키워드 추출 (실제로는 더 정교한 NLP 가능)
    const words = inputData.logline.split(/\s+/).filter(word => word.length > 2)
    keywords.push(...words.slice(0, 3))
  }

  return keywords.filter((keyword, index, arr) => arr.indexOf(keyword) === index)
}

/**
 * 생성 근거 설명
 */
function generateRationale(inputData: PlanningInputData, storySteps: StoryStep[]): string {
  const { toneAndManner, development, intensity } = inputData
  const totalDuration = storySteps.reduce((sum, step) => sum + (step.duration || 0), 0)

  return `
${toneAndManner} 톤앤매너와 ${development} 전개 방식을 적용하여 ${intensity} 강도의 스토리를 구성했습니다.
총 ${totalDuration}초 동안 4단계 구조로 전개되며, 각 단계별 핵심 포인트를 명확히 구분했습니다.
시청자의 관심을 끌고 핵심 메시지를 효과적으로 전달할 수 있는 구조입니다.
  `.trim()
}