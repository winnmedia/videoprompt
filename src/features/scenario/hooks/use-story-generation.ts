/**
 * useStoryGeneration Hook
 *
 * AI 스토리 생성 기능을 위한 React Hook
 * CLAUDE.md 준수: FSD features 레이어, React 19 훅 규칙
 */

import { useState, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type {
  StoryGenerationRequest,
  ScenarioCreateInput,
  Scenario
} from '../../../entities/scenario'

import { scenarioActions, scenarioSelectors } from '../../../entities/scenario'
import { StoryGenerator, type StoryGenerationResult, type StoryGenerationOptions } from '../model/story-generator'
import logger from '../../../shared/lib/logger'

/**
 * 스토리 생성 Hook 상태
 */
export interface UseStoryGenerationState {
  isGenerating: boolean
  progress: number // 0-100
  currentStep: GenerationStep
  lastResult: StoryGenerationResult | null
  error: string | null
}

/**
 * 생성 단계
 */
export type GenerationStep = 
  | 'idle'
  | 'preparing'
  | 'generating_outline'
  | 'creating_scenes'
  | 'validating'
  | 'finalizing'
  | 'completed'
  | 'error'

/**
 * Hook 옵션
 */
export interface UseStoryGenerationOptions {
  autoSave?: boolean
  enableProgressTracking?: boolean
  onStepChange?: (step: GenerationStep, progress: number) => void
  onSuccess?: (result: StoryGenerationResult) => void
  onError?: (error: string) => void
}

/**
 * AI 스토리 생성 Hook
 */
export function useStoryGeneration(options: UseStoryGenerationOptions = {}) {
  const {
    autoSave = true,
    enableProgressTracking = true,
    onStepChange,
    onSuccess,
    onError
  } = options

  const dispatch = useDispatch()
  const isLoading = useSelector(scenarioSelectors.getIsLoading)
  const currentScenario = useSelector(scenarioSelectors.getCurrentScenario)
  
  // 내부 상태
  const [state, setState] = useState<UseStoryGenerationState>({
    isGenerating: false,
    progress: 0,
    currentStep: 'idle',
    lastResult: null,
    error: null
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
      if (enableProgressTracking && onStepChange && updates.currentStep) {
        onStepChange(updates.currentStep, newState.progress)
      }
      
      return newState
    })
  }, [enableProgressTracking, onStepChange])

  /**
   * 진행률 업데이트
   */
  const updateProgress = useCallback((step: GenerationStep, progress: number) => {
    updateState({ currentStep: step, progress })
  }, [updateState])

  /**
   * 새로운 스토리 생성
   */
  const generateStory = useCallback(async (
    input: ScenarioCreateInput,
    request: StoryGenerationRequest,
    generationOptions: StoryGenerationOptions = {}
  ): Promise<StoryGenerationResult | null> => {
    // 이미 생성 중인 경우 방지
    if (state.isGenerating) {
      logger.warn('이미 스토리 생성이 진행 중입니다.')
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
        lastResult: null
      })

      dispatch(scenarioActions.setLoading(true))

      // 1단계: 준비
      updateProgress('preparing', 10)
      await new Promise(resolve => setTimeout(resolve, 500)) // UI 업데이트 시간

      // 2단계: 아웃라인 생성
      updateProgress('generating_outline', 30)
      
      // 3단계: 씬 생성
      updateProgress('creating_scenes', 60)
      
      // 실제 생성 수행
      const result = await StoryGenerator.generateScenario(input, request, {
        ...generationOptions,
        validateResult: true
      })

      // 4단계: 검증
      updateProgress('validating', 80)
      await new Promise(resolve => setTimeout(resolve, 300))

      // 5단계: 마무리
      updateProgress('finalizing', 90)

      if (result.success && result.scenario) {
        // Redux 상태 업데이트
        dispatch(scenarioActions.setCurrentScenario(result.scenario))
        
        if (autoSave) {
          dispatch(scenarioActions.addToScenarioList(result.scenario))
        }

        // 성공 완료
        updateState({
          isGenerating: false,
          progress: 100,
          currentStep: 'completed',
          lastResult: result
        })

        onSuccess?.(result)
        
        logger.info('스토리 생성 성공', {
          scenarioId: result.scenario.metadata.id,
          sceneCount: result.scenario.scenes.length
        })

        return result

      } else {
        // 생성 실패
        throw new Error(result.error || '스토리 생성에 실패했습니다.')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      
      // 에러 상태
      updateState({
        isGenerating: false,
        progress: 0,
        currentStep: 'error',
        error: errorMessage
      })

      dispatch(scenarioActions.setError(errorMessage))
      onError?.(errorMessage)
      
      logger.error('스토리 생성 오류', {
        error: errorMessage,
        prompt: request.prompt
      })

      return null

    } finally {
      dispatch(scenarioActions.setLoading(false))
      abortControllerRef.current = null
    }
  }, [state.isGenerating, dispatch, autoSave, updateState, updateProgress, onSuccess, onError])

  /**
   * 스토리 재생성/개선
   */
  const regenerateStory = useCallback(async (
    improvementPrompt: string,
    options: StoryGenerationOptions = {}
  ): Promise<StoryGenerationResult | null> => {
    if (!currentScenario) {
      const error = '재생성할 시나리오가 없습니다.'
      onError?.(error)
      return null
    }

    try {
      updateState({
        isGenerating: true,
        progress: 0,
        currentStep: 'preparing',
        error: null
      })

      const result = await StoryGenerator.regenerateStory(
        currentScenario,
        improvementPrompt,
        options
      )

      if (result.success && result.scenario) {
        dispatch(scenarioActions.setCurrentScenario(result.scenario))
        
        updateState({
          isGenerating: false,
          progress: 100,
          currentStep: 'completed',
          lastResult: result
        })

        onSuccess?.(result)
        return result
      } else {
        throw new Error(result.error || '스토리 재생성에 실패했습니다.')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재생성 오류'
      
      updateState({
        isGenerating: false,
        currentStep: 'error',
        error: errorMessage
      })

      onError?.(errorMessage)
      return null
    }
  }, [currentScenario, dispatch, updateState, onSuccess, onError])

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
      error: null
    })
    
    dispatch(scenarioActions.setLoading(false))
    
    logger.info('스토리 생성이 취소되었습니다.')
  }, [updateState, dispatch])

  /**
   * 에러 상태 초기화
   */
  const clearError = useCallback(() => {
    updateState({ error: null, currentStep: 'idle' })
    dispatch(scenarioActions.clearError())
  }, [updateState, dispatch])

  /**
   * 전체 상태 초기화
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
      error: null
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
    
    // 액션
    generateStory,
    regenerateStory,
    cancelGeneration,
    clearError,
    reset,
    
    // Redux 상태 (대리)
    isLoading,
    currentScenario
  }
}

/**
 * 스토리 생성 진행 상태를 표시하는 간단한 Hook
 */
export function useStoryGenerationProgress() {
  const isLoading = useSelector(scenarioSelectors.getIsLoading)
  const currentScenario = useSelector(scenarioSelectors.getCurrentScenario)
  
  return {
    isGenerating: isLoading,
    hasScenario: !!currentScenario,
    sceneCount: currentScenario?.scenes.length || 0,
    totalDuration: currentScenario?.totalDuration || 0
  }
}
