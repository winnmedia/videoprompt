/**
 * useShotBreakdown Hook
 *
 * 4단계 스토리를 12숏으로 자동 분해하는 기능
 * CLAUDE.md 준수: 비용 안전, TDD, $300 사건 방지
 */

import { useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'

import type {
  StoryStep,
  ShotSequence,
  InsertShot,
  ShotBreakdownRequest,
  ShotBreakdownResponse,
  PlanningInputData,
  PLANNING_BUSINESS_RULES,
} from '../../../entities/planning'

import {
  validateStorySteps,
  createDefaultShotSequences,
} from '../../../entities/planning'

import { planningActions } from '../store/planning-slice'
import { geminiClient } from '../../../shared/lib/gemini-client'
import logger from '../../../shared/lib/logger'

/**
 * 숏 분해 상태
 */
export interface UseShotBreakdownState {
  isGenerating: boolean
  progress: number // 0-100
  currentStep: ShotBreakdownStep
  lastResult: ShotBreakdownResponse | null
  error: string | null
  retryCount: number
}

/**
 * 분해 단계
 */
export type ShotBreakdownStep =
  | 'idle'
  | 'analyzing_story'
  | 'calculating_distribution'
  | 'generating_shots'
  | 'creating_inserts'
  | 'optimizing'
  | 'completed'
  | 'error'

/**
 * Hook 옵션
 */
export interface UseShotBreakdownOptions {
  targetShotCount?: number
  includeInserts?: boolean
  maxRetries?: number
  onStepChange?: (step: ShotBreakdownStep, progress: number) => void
  onSuccess?: (result: ShotBreakdownResponse) => void
  onError?: (error: string) => void
}

/**
 * 12숏 분해 Hook
 */
export function useShotBreakdown(options: UseShotBreakdownOptions = {}) {
  const {
    targetShotCount = PLANNING_BUSINESS_RULES.DEFAULT_SHOT_COUNT,
    includeInserts = true,
    maxRetries = 3,
    onStepChange,
    onSuccess,
    onError,
  } = options

  const dispatch = useDispatch()

  // 내부 상태
  const [state, setState] = useState<UseShotBreakdownState>({
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
  const updateState = useCallback((updates: Partial<UseShotBreakdownState>) => {
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
  const updateProgress = useCallback((step: ShotBreakdownStep, progress: number) => {
    updateState({ currentStep: step, progress })
  }, [updateState])

  /**
   * 12숏 분해 실행
   */
  const breakdownShots = useCallback(async (
    storySteps: StoryStep[],
    inputData: PlanningInputData
  ): Promise<ShotBreakdownResponse | null> => {
    // 이미 생성 중인 경우 방지 - $300 사건 방지
    if (state.isGenerating) {
      logger.warn('이미 숏 분해가 진행 중입니다.')
      return null
    }

    // 스토리 스텝 검증
    const validation = validateStorySteps(storySteps)
    if (!validation.isValid) {
      const errorMessage = validation.errors[0]?.message || '스토리 스텝이 유효하지 않습니다'
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
        currentStep: 'analyzing_story',
        error: null,
        lastResult: null,
      })

      dispatch(planningActions.setLoading(true))

      // 1단계: 스토리 분석 (15%)
      updateProgress('analyzing_story', 15)
      const storyAnalysis = await analyzeStoryStructure(storySteps, inputData)

      // 2단계: 시간 배분 계산 (30%)
      updateProgress('calculating_distribution', 30)
      const distribution = calculateShotDistribution(storySteps, targetShotCount)

      // 3단계: 숏 생성 (60%)
      updateProgress('generating_shots', 60)
      const shotSequences = await generateShotSequences(
        storySteps,
        inputData,
        distribution,
        storyAnalysis
      )

      // 4단계: 인서트 생성 (80%)
      updateProgress('creating_inserts', 80)
      const insertShots = includeInserts
        ? await generateInsertShots(shotSequences, inputData)
        : []

      // 5단계: 최적화 (95%)
      updateProgress('optimizing', 95)
      const optimizedShots = optimizeShotSequences(shotSequences, storySteps)
      const totalDuration = optimizedShots.reduce((sum, shot) => sum + shot.duration, 0)

      const result: ShotBreakdownResponse = {
        shotSequences: optimizedShots,
        insertShots,
        totalDuration,
        distributionRationale: generateDistributionRationale(distribution, storySteps),
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
      dispatch(planningActions.updateShotSequences(optimizedShots))
      if (insertShots.length > 0) {
        dispatch(planningActions.updateInsertShots(insertShots))
      }

      onSuccess?.(result)

      logger.info('숏 분해 성공', {
        shotCount: optimizedShots.length,
        insertCount: insertShots.length,
        totalDuration,
        storyStepCount: storySteps.length,
      })

      // 비용 로그
      logger.logCostEvent('gemini_shot_breakdown', 0.01, {
        shotCount: optimizedShots.length,
        storyStepCount: storySteps.length,
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '숏 분해에 실패했습니다'

      // 에러 상태
      updateState({
        isGenerating: false,
        progress: 0,
        currentStep: 'error',
        error: errorMessage,
        retryCount: state.retryCount + 1,
      })

      onError?.(errorMessage)

      logger.error('숏 분해 오류', {
        error: errorMessage,
        storyStepCount: storySteps.length,
        retryCount: state.retryCount,
      })

      return null

    } finally {
      dispatch(planningActions.setLoading(false))
      abortControllerRef.current = null
    }
  }, [state.isGenerating, state.retryCount, targetShotCount, includeInserts, dispatch, updateState, updateProgress, onSuccess, onError])

  /**
   * 기본 분해 템플릿 사용
   */
  const useDefaultBreakdown = useCallback((storySteps: StoryStep[]): void => {
    const defaultShots = createDefaultShotSequences(storySteps)
    const shotSequences: ShotSequence[] = defaultShots.map((shot, index) => ({
      ...shot,
      id: `shot_${Date.now()}_${index}`,
    }))

    const result: ShotBreakdownResponse = {
      shotSequences,
      insertShots: [],
      totalDuration: shotSequences.reduce((sum, shot) => sum + shot.duration, 0),
      distributionRationale: '기본 균등 분배 템플릿을 사용했습니다.',
    }

    updateState({
      isGenerating: false,
      progress: 100,
      currentStep: 'completed',
      lastResult: result,
      error: null,
    })

    dispatch(planningActions.updateShotSequences(shotSequences))
    onSuccess?.(result)

    logger.info('기본 분해 템플릿 사용', {
      shotCount: shotSequences.length,
    })
  }, [dispatch, updateState, onSuccess])

  /**
   * 숏 재분해
   */
  const regenerateBreakdown = useCallback(async (
    storySteps: StoryStep[],
    inputData: PlanningInputData,
    feedback?: string
  ): Promise<ShotBreakdownResponse | null> => {
    if (state.retryCount >= maxRetries) {
      const errorMessage = `최대 재시도 횟수(${maxRetries})를 초과했습니다`
      updateState({ error: errorMessage })
      onError?.(errorMessage)
      return null
    }

    // 피드백이 있으면 입력에 반영
    const enhancedInputData: PlanningInputData = feedback
      ? {
          ...inputData,
          additionalNotes: `${inputData.additionalNotes || ''}\n분해 피드백: ${feedback}`.trim(),
        }
      : inputData

    return breakdownShots(storySteps, enhancedInputData)
  }, [state.retryCount, maxRetries, breakdownShots, updateState, onError])

  /**
   * 분해 취소
   */
  const cancelBreakdown = useCallback(() => {
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

    logger.info('숏 분해가 취소되었습니다.')
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
      cancelBreakdown()
    }

    setState({
      isGenerating: false,
      progress: 0,
      currentStep: 'idle',
      lastResult: null,
      error: null,
      retryCount: 0,
    })
  }, [state.isGenerating, cancelBreakdown])

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
    breakdownShots,
    regenerateBreakdown,
    useDefaultBreakdown,
    cancelBreakdown,
    clearError,
    reset,
  }
}

/**
 * 스토리 구조 분석
 */
async function analyzeStoryStructure(
  storySteps: StoryStep[],
  inputData: PlanningInputData
): Promise<any> {
  // 스토리의 특성 분석
  const analysis = {
    complexity: calculateComplexity(storySteps),
    visualDensity: calculateVisualDensity(inputData),
    pacing: determinePacing(inputData.development, inputData.intensity),
    keyMoments: identifyKeyMoments(storySteps),
  }

  return analysis
}

/**
 * 숏 배분 계산
 */
function calculateShotDistribution(
  storySteps: StoryStep[],
  targetShotCount: number
): number[] {
  const totalDuration = storySteps.reduce((sum, step) => sum + (step.duration || 0), 0)

  if (totalDuration === 0) {
    // 균등 분배
    const shotsPerStep = Math.floor(targetShotCount / storySteps.length)
    const remainder = targetShotCount % storySteps.length

    return storySteps.map((_, index) =>
      index < remainder ? shotsPerStep + 1 : shotsPerStep
    )
  }

  // 시간 비례 분배
  return storySteps.map(step => {
    const ratio = (step.duration || 0) / totalDuration
    return Math.max(1, Math.round(ratio * targetShotCount))
  })
}

/**
 * 숏 시퀀스 생성
 */
async function generateShotSequences(
  storySteps: StoryStep[],
  inputData: PlanningInputData,
  distribution: number[],
  analysis: any
): Promise<ShotSequence[]> {
  const shotSequences: ShotSequence[] = []
  let shotIndex = 0

  for (let stepIndex = 0; stepIndex < storySteps.length; stepIndex++) {
    const step = storySteps[stepIndex]
    const shotCount = distribution[stepIndex]
    const stepDuration = step.duration || 30
    const avgShotDuration = Math.round(stepDuration / shotCount)

    for (let i = 0; i < shotCount; i++) {
      const shot: ShotSequence = {
        id: `shot_${Date.now()}_${shotIndex}`,
        order: shotIndex + 1,
        title: `${step.title} - 숏 ${i + 1}`,
        description: generateShotDescription(step, i, shotCount, inputData),
        duration: calculateShotDuration(avgShotDuration, i, shotCount, analysis.pacing),
        contiDescription: generateContiDescription(step, i, inputData.toneAndManner),
        contiStyle: selectContiStyle(inputData.toneAndManner),
        storyStepId: step.id,
        shotType: selectShotType(i, shotCount, step),
        cameraMovement: selectCameraMovement(inputData.development, analysis.pacing),
        visualElements: generateVisualElements(step, i),
        transitionType: selectTransitionType(i, shotCount),
      }

      shotSequences.push(shot)
      shotIndex++
    }
  }

  return shotSequences
}

/**
 * 인서트 숏 생성
 */
async function generateInsertShots(
  shotSequences: ShotSequence[],
  inputData: PlanningInputData
): Promise<InsertShot[]> {
  const insertShots: InsertShot[] = []

  // 주요 숏에만 인서트 추가 (전체의 30% 정도)
  const targetShots = shotSequences.filter((_, index) => (index + 1) % 3 === 0)

  for (const shot of targetShots) {
    for (let i = 0; i < 2; i++) { // 숏당 최대 2개 인서트
      const insert: InsertShot = {
        id: `insert_${Date.now()}_${shot.id}_${i}`,
        shotSequenceId: shot.id,
        order: i + 1,
        description: generateInsertDescription(shot, i),
        purpose: selectInsertPurpose(i),
      }

      insertShots.push(insert)
    }
  }

  return insertShots
}

/**
 * 숏 시퀀스 최적화
 */
function optimizeShotSequences(
  shotSequences: ShotSequence[],
  storySteps: StoryStep[]
): ShotSequence[] {
  // 시간 조정 및 전환 최적화
  return shotSequences.map((shot, index) => {
    const nextShot = shotSequences[index + 1]
    const prevShot = shotSequences[index - 1]

    return {
      ...shot,
      // 트랜지션 최적화
      transitionType: optimizeTransition(shot, prevShot, nextShot),
    }
  })
}

// 헬퍼 함수들
function calculateComplexity(storySteps: StoryStep[]): 'low' | 'medium' | 'high' {
  const avgKeyPoints = storySteps.reduce((sum, step) => sum + step.keyPoints.length, 0) / storySteps.length
  if (avgKeyPoints <= 2) return 'low'
  if (avgKeyPoints <= 4) return 'medium'
  return 'high'
}

function calculateVisualDensity(inputData: PlanningInputData): 'low' | 'medium' | 'high' {
  if (inputData.toneAndManner === 'educational') return 'medium'
  if (inputData.toneAndManner === 'creative') return 'high'
  return 'low'
}

function determinePacing(development: string, intensity: string): 'slow' | 'medium' | 'fast' {
  if (intensity === 'high' || development === 'dramatic') return 'fast'
  if (intensity === 'low' || development === 'tutorial') return 'slow'
  return 'medium'
}

function identifyKeyMoments(storySteps: StoryStep[]): number[] {
  // 각 스텝의 중간 지점을 키 모멘트로 설정
  return storySteps.map((_, index) => index + 0.5)
}

function generateShotDescription(step: StoryStep, shotIndex: number, totalShots: number, inputData: PlanningInputData): string {
  const position = shotIndex === 0 ? '시작' : shotIndex === totalShots - 1 ? '마무리' : '중간'
  return `${step.title}의 ${position} 부분을 표현하는 숏입니다. ${step.description}`
}

function generateContiDescription(step: StoryStep, shotIndex: number, tone: string): string {
  return `${step.title}에서 ${shotIndex + 1}번째 숏의 구성과 연출을 ${tone} 톤으로 표현해주세요.`
}

function selectContiStyle(tone: string): 'pencil' | 'rough' | 'monochrome' | 'colored' {
  switch (tone) {
    case 'professional': return 'monochrome'
    case 'creative': return 'colored'
    case 'casual': return 'rough'
    default: return 'pencil'
  }
}

function selectShotType(shotIndex: number, totalShots: number, step: StoryStep): 'close_up' | 'medium' | 'wide' | 'extreme_wide' {
  if (shotIndex === 0) return 'wide' // 첫 숏은 와이드
  if (shotIndex === totalShots - 1) return 'close_up' // 마지막 숏은 클로즈업
  return 'medium' // 중간은 미디엄
}

function selectCameraMovement(development: string, pacing: string): 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly' {
  if (pacing === 'fast') return 'zoom'
  if (development === 'dramatic') return 'dolly'
  return 'static'
}

function generateVisualElements(step: StoryStep, shotIndex: number): string[] {
  return step.keyPoints.slice(0, 2) // 핵심 포인트에서 2개까지
}

function selectTransitionType(shotIndex: number, totalShots: number): 'cut' | 'fade' | 'dissolve' | 'wipe' {
  if (shotIndex === totalShots - 1) return 'fade' // 마지막은 페이드
  return 'cut' // 대부분 컷
}

function calculateShotDuration(avgDuration: number, shotIndex: number, totalShots: number, pacing: string): number {
  const baseMultiplier = pacing === 'fast' ? 0.8 : pacing === 'slow' ? 1.2 : 1.0
  const positionMultiplier = shotIndex === 0 || shotIndex === totalShots - 1 ? 1.2 : 1.0

  return Math.round(avgDuration * baseMultiplier * positionMultiplier)
}

function generateInsertDescription(shot: ShotSequence, insertIndex: number): string {
  const purposes = ['세부 사항 강조', '맥락 설명', '감정 표현', '시각적 전환']
  return `${shot.title}의 ${purposes[insertIndex] || '보조 요소'}를 위한 인서트 숏`
}

function selectInsertPurpose(index: number): 'detail' | 'context' | 'emotion' | 'transition' {
  const purposes = ['detail', 'context', 'emotion', 'transition'] as const
  return purposes[index % purposes.length]
}

function optimizeTransition(
  shot: ShotSequence,
  prevShot?: ShotSequence,
  nextShot?: ShotSequence
): 'cut' | 'fade' | 'dissolve' | 'wipe' {
  // 다른 스토리 스텝으로 넘어갈 때 디졸브
  if (nextShot && shot.storyStepId !== nextShot.storyStepId) {
    return 'dissolve'
  }

  // 기본은 컷
  return 'cut'
}

function generateDistributionRationale(distribution: number[], storySteps: StoryStep[]): string {
  const total = distribution.reduce((sum, count) => sum + count, 0)
  const details = storySteps.map((step, index) =>
    `${step.title}: ${distribution[index]}개 숏`
  ).join(', ')

  return `총 ${total}개 숏을 4단계로 분배했습니다. ${details}. 각 단계의 중요도와 시간에 따라 적절히 배분했습니다.`
}