/**
 * 스토리보드 워크플로우 통합 훅
 *
 * 시나리오 기획 → 12개 숏트 → 콘티 이미지 생성의 완전한 파이프라인
 * CLAUDE.md 준수: FSD features 레이어, $300 사건 방지
 */

import { useCallback, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { scenarioSelectors, scenarioActions } from '../../../entities/scenario/store'
import { storyboardSelectors, storyboardActions } from '../../../entities/storyboard/store'
import { useScenarioStoryboardIntegration } from '../../../shared/hooks/useScenarioStoryboardIntegration'
import { ConsistencyManager } from '../../../shared/lib/consistency-manager'
import type {
  Scenario,
  Scene,
  StoryGenerationRequest
} from '../../../entities/scenario/types'
import type {
  BatchGenerationRequest,
  ConsistencyReference,
  GenerationProgress
} from '../../../entities/storyboard/types'
import logger from '../../../shared/lib/logger'

/**
 * 워크플로우 단계 정의
 */
export type WorkflowStep =
  | 'idle'
  | 'story_planning'      // 스토리 기획 단계
  | 'scene_generation'    // 12개 숏트 생성 단계
  | 'scene_validation'    // 씬 검증 단계
  | 'storyboard_setup'    // 스토리보드 설정 단계
  | 'consistency_setup'   // 일관성 참조 설정 단계
  | 'image_generation'    // 콘티 이미지 생성 단계
  | 'review_and_refine'   // 검토 및 수정 단계
  | 'completed'           // 완료 단계
  | 'error'              // 오류 단계

/**
 * 워크플로우 상태
 */
interface WorkflowState {
  currentStep: WorkflowStep
  progress: number // 0-1
  isProcessing: boolean
  error: string | null
  canProceedToNext: boolean
  canGoBack: boolean
  completedSteps: Set<WorkflowStep>
  stepResults: Record<WorkflowStep, unknown>
}

/**
 * 워크플로우 단계별 설정
 */
interface StepConfig {
  title: string
  description: string
  estimatedTime: number // 초 단위
  requirements: string[]
  autoAdvance: boolean
}

/**
 * 워크플로우 단계 설정
 */
const WORKFLOW_STEPS: Record<WorkflowStep, StepConfig> = {
  idle: {
    title: '시작',
    description: '워크플로우를 시작합니다',
    estimatedTime: 0,
    requirements: [],
    autoAdvance: false
  },
  story_planning: {
    title: '스토리 기획',
    description: 'AI를 활용하여 기본 스토리를 기획합니다',
    estimatedTime: 30,
    requirements: ['스토리 프롬프트', '장르', '타겟 시간'],
    autoAdvance: false
  },
  scene_generation: {
    title: '씬 분할',
    description: '스토리를 12개의 핵심 씬으로 분할합니다',
    estimatedTime: 45,
    requirements: ['완성된 스토리'],
    autoAdvance: true
  },
  scene_validation: {
    title: '씬 검증',
    description: '생성된 씬들을 검토하고 수정합니다',
    estimatedTime: 120,
    requirements: ['12개 씬 생성 완료'],
    autoAdvance: false
  },
  storyboard_setup: {
    title: '스토리보드 설정',
    description: '콘티 생성을 위한 기본 설정을 구성합니다',
    estimatedTime: 60,
    requirements: ['검증된 씬 목록'],
    autoAdvance: true
  },
  consistency_setup: {
    title: '일관성 설정',
    description: '이미지 생성 일관성을 위한 참조를 설정합니다',
    estimatedTime: 90,
    requirements: ['스토리보드 설정 완료'],
    autoAdvance: false
  },
  image_generation: {
    title: '콘티 생성',
    description: 'AI를 활용하여 스토리보드 이미지를 생성합니다',
    estimatedTime: 300,
    requirements: ['일관성 참조 설정'],
    autoAdvance: true
  },
  review_and_refine: {
    title: '검토 및 수정',
    description: '생성된 콘티를 검토하고 필요시 재생성합니다',
    estimatedTime: 180,
    requirements: ['이미지 생성 완료'],
    autoAdvance: false
  },
  completed: {
    title: '완료',
    description: '스토리보드 워크플로우가 완료되었습니다',
    estimatedTime: 0,
    requirements: ['모든 단계 완료'],
    autoAdvance: false
  },
  error: {
    title: '오류',
    description: '워크플로우 진행 중 오류가 발생했습니다',
    estimatedTime: 0,
    requirements: [],
    autoAdvance: false
  }
}

/**
 * 스토리보드 워크플로우 훅
 */
export function useStoryboardWorkflow() {
  const dispatch = useAppDispatch()

  // $300 사건 방지: 마지막 실행 시간 추적
  const lastExecutionRef = useRef<Record<string, number>>({})

  // Redux 상태
  const currentScenario = useAppSelector(scenarioSelectors.getCurrentScenario)
  const currentStoryboard = useAppSelector(storyboardSelectors.getCurrentStoryboard)
  const scenarioLoading = useAppSelector(scenarioSelectors.getIsLoading)
  const storyboardLoading = useAppSelector(storyboardSelectors.getIsLoading)
  const storyboardGeneration = useAppSelector(storyboardSelectors.getBatchGeneration)

  // 통합 훅 사용
  const {
    integrationState,
    createStoryboardFromScenario,
    syncSceneChanges,
    startBatchGeneration,
    addConsistencyReference
  } = useScenarioStoryboardIntegration({
    autoCreateStoryboard: true,
    preserveExistingFrames: true,
    enableConsistencyTracking: true,
    batchSize: 3 // 비용 안전
  })

  /**
   * 현재 워크플로우 상태 계산
   */
  const workflowState = useMemo((): WorkflowState => {
    // 현재 단계 결정
    let currentStep: WorkflowStep = 'idle'
    const completedSteps = new Set<WorkflowStep>()
    let progress = 0

    if (currentScenario) {
      completedSteps.add('story_planning')
      currentStep = 'scene_generation'
      progress = 0.1

      if (currentScenario.scenes.length >= 8) { // 최소 8개 씬
        completedSteps.add('scene_generation')
        currentStep = 'scene_validation'
        progress = 0.25

        // 모든 씬이 기본 정보를 가지고 있으면 검증 완료
        const validScenes = currentScenario.scenes.filter(scene =>
          scene.title && scene.description && scene.duration
        )

        if (validScenes.length === currentScenario.scenes.length) {
          completedSteps.add('scene_validation')
          currentStep = 'storyboard_setup'
          progress = 0.4

          if (currentStoryboard) {
            completedSteps.add('storyboard_setup')
            currentStep = 'consistency_setup'
            progress = 0.5

            // 일관성 참조가 설정되었는지 확인
            const hasConsistencyRefs = currentStoryboard.settings.globalConsistencyRefs.length > 0
            if (hasConsistencyRefs) {
              completedSteps.add('consistency_setup')
              currentStep = 'image_generation'
              progress = 0.6

              // 이미지 생성 진행 상태 확인
              if (storyboardGeneration.isActive) {
                const generationProgress = storyboardGeneration.progress
                const totalFrames = generationProgress.length
                const completedFrames = generationProgress.filter(p => p.status === 'completed').length

                if (totalFrames > 0) {
                  progress = 0.6 + (completedFrames / totalFrames) * 0.3 // 60%-90%
                }

                if (completedFrames === totalFrames && totalFrames > 0) {
                  completedSteps.add('image_generation')
                  currentStep = 'review_and_refine'
                  progress = 0.9
                }
              } else {
                // 배치 생성이 완료된 경우
                const framesWithResults = currentStoryboard.frames.filter(f => f.result)
                if (framesWithResults.length === currentStoryboard.frames.length) {
                  completedSteps.add('image_generation')
                  currentStep = 'review_and_refine'
                  progress = 0.9

                  // 모든 프레임이 승인되었으면 완료
                  const approvedFrames = framesWithResults.filter(f =>
                    f.userFeedback && f.userFeedback.rating >= 4
                  )
                  if (approvedFrames.length === framesWithResults.length) {
                    completedSteps.add('review_and_refine')
                    currentStep = 'completed'
                    progress = 1.0
                  }
                }
              }
            }
          }
        }
      }
    }

    // 오류 상태 확인
    const hasError = !!(scenarioLoading === false && !currentScenario) ||
                     !!(currentScenario && currentStoryboard && currentStoryboard.frames.some(f => f.metadata.status === 'failed'))

    if (hasError) {
      currentStep = 'error'
    }

    return {
      currentStep,
      progress,
      isProcessing: scenarioLoading || storyboardLoading || storyboardGeneration.isActive,
      error: null, // 실제 에러는 각 엔티티에서 관리
      canProceedToNext: !hasError && WORKFLOW_STEPS[currentStep].autoAdvance,
      canGoBack: completedSteps.size > 0 && currentStep !== 'completed',
      completedSteps,
      stepResults: {} // 실제 결과는 Redux 상태에서 조회
    }
  }, [
    currentScenario,
    currentStoryboard,
    scenarioLoading,
    storyboardLoading,
    storyboardGeneration
  ])

  /**
   * 비용 안전 체크
   */
  const canExecuteAction = useCallback((actionKey: string): boolean => {
    const now = Date.now()
    const lastExecution = lastExecutionRef.current[actionKey] || 0
    const timeDiff = now - lastExecution

    // 30초 내 중복 실행 방지
    if (timeDiff < 30000) {
      logger.warn('비용 안전: 30초 내 중복 실행 차단', { actionKey, timeDiff })
      return false
    }

    lastExecutionRef.current[actionKey] = now
    return true
  }, [])

  /**
   * 스토리 기획 시작
   */
  const startStoryPlanning = useCallback(async (request: StoryGenerationRequest) => {
    if (!canExecuteAction('startStoryPlanning')) return

    try {
      logger.info('스토리 기획 시작', { genre: request.genre, targetDuration: request.targetDuration })

      // 실제 구현은 scenario feature의 hooks 사용
      // 여기서는 워크플로우 상태만 관리
      dispatch(scenarioActions.setLoading(true))

      // TODO: 실제 AI 스토리 생성 API 호출
      // const result = await generateStory(request)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리 기획 실패'
      dispatch(scenarioActions.setError(errorMessage))
      logger.error('스토리 기획 실패', { error: errorMessage })
    }
  }, [dispatch, canExecuteAction])

  /**
   * 다음 단계로 진행
   */
  const proceedToNextStep = useCallback(async () => {
    if (!workflowState.canProceedToNext) return

    const actionKey = `proceed_${workflowState.currentStep}`
    if (!canExecuteAction(actionKey)) return

    try {
      switch (workflowState.currentStep) {
        case 'scene_generation':
          // 씬 생성 완료 후 자동으로 스토리보드 설정으로 이동
          if (currentScenario && currentScenario.scenes.length >= 8) {
            logger.info('씬 생성 완료, 스토리보드 설정 단계로 이동')
          }
          break

        case 'storyboard_setup':
          // 자동으로 스토리보드 생성
          if (currentScenario && !currentStoryboard) {
            await createStoryboardFromScenario(currentScenario)
          }
          break

        case 'image_generation':
          // 배치 이미지 생성 시작
          if (currentStoryboard && !storyboardGeneration.isActive) {
            await startBatchGeneration()

            // 첫 번째 이미지가 생성되면 일관성 참조로 설정
            const firstFrame = currentStoryboard.frames[0]
            if (firstFrame && firstFrame.result) {
              const reference = ConsistencyManager.createReferenceFromFirstImage(
                firstFrame.result,
                firstFrame.metadata.title
              )
              addConsistencyReference(
                reference.type,
                reference.name,
                reference.description,
                reference.referenceImageUrl
              )
            }
          }
          break

        default:
          logger.warn('자동 진행이 지원되지 않는 단계', { step: workflowState.currentStep })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '단계 진행 실패'
      logger.error('워크플로우 단계 진행 실패', {
        step: workflowState.currentStep,
        error: errorMessage
      })
    }
  }, [
    workflowState.currentStep,
    workflowState.canProceedToNext,
    currentScenario,
    currentStoryboard,
    storyboardGeneration,
    createStoryboardFromScenario,
    startBatchGeneration,
    addConsistencyReference,
    canExecuteAction
  ])

  /**
   * 특정 단계로 이동 (뒤로 가기)
   */
  const goToStep = useCallback((targetStep: WorkflowStep) => {
    if (!workflowState.canGoBack) return

    logger.info('워크플로우 단계 이동', {
      from: workflowState.currentStep,
      to: targetStep
    })

    // 실제 구현에서는 각 단계별 상태 복원 로직 필요
    // 현재는 로깅만 수행
  }, [workflowState])

  /**
   * 워크플로우 리셋
   */
  const resetWorkflow = useCallback(() => {
    if (!canExecuteAction('resetWorkflow')) return

    dispatch(scenarioActions.resetEditor())
    dispatch(storyboardActions.resetState())
    lastExecutionRef.current = {}

    logger.info('워크플로우 리셋 완료')
  }, [dispatch, canExecuteAction])

  /**
   * 단계별 진행 시간 추정
   */
  const getEstimatedTimeRemaining = useCallback((): number => {
    const remainingSteps = Object.entries(WORKFLOW_STEPS)
      .filter(([step]) => !workflowState.completedSteps.has(step as WorkflowStep))
      .reduce((total, [, config]) => total + config.estimatedTime, 0)

    return remainingSteps
  }, [workflowState.completedSteps])

  return {
    // 상태
    workflowState,
    currentStepConfig: WORKFLOW_STEPS[workflowState.currentStep],
    integrationState,
    estimatedTimeRemaining: getEstimatedTimeRemaining(),

    // 액션
    startStoryPlanning,
    proceedToNextStep,
    goToStep,
    resetWorkflow,

    // 헬퍼
    getStepConfig: useCallback((step: WorkflowStep) => WORKFLOW_STEPS[step], []),
    isStepCompleted: useCallback((step: WorkflowStep) => workflowState.completedSteps.has(step), [workflowState.completedSteps]),
    getProgressPercentage: useCallback(() => Math.round(workflowState.progress * 100), [workflowState.progress])
  }
}