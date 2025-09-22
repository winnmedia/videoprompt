/**
 * usePlanningWizard Hook
 *
 * 영상 기획 위저드의 전체 상태 관리를 담당하는 메인 Hook
 * CLAUDE.md 준수: FSD features 레이어, React 19 훅 규칙, $300 사건 방지
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type {
  PlanningProject,
  PlanningInputData,
  StoryStep,
  ShotSequence,
  WizardStep,
  WizardProgress,
  PlanningProjectCreateInput,
  SessionRestoreData,
  PLANNING_BUSINESS_RULES,
} from '../../../entities/planning'

import {
  validatePlanningInput,
  validateStorySteps,
  validateShotSequences,
  calculateWizardProgress,
  calculateCompletionPercentage,
  canRestoreSession,
} from '../../../entities/planning'

import { planningActions, planningSelectors } from '../store/planning-slice'
import logger from '../../../shared/lib/logger'

/**
 * 위저드 Hook 상태
 */
export interface UsePlanningWizardState {
  currentStep: WizardStep
  progress: WizardProgress
  isGenerating: boolean
  hasUnsavedChanges: boolean
  lastSavedAt: Date | null
  error: string | null
  sessionId: string
}

/**
 * Hook 옵션
 */
export interface UsePlanningWizardOptions {
  autoSave?: boolean
  autoSaveInterval?: number // 초 단위
  enableSessionRestore?: boolean
  onStepChange?: (step: WizardStep) => void
  onSave?: (project: PlanningProject) => void
  onError?: (error: string) => void
}

/**
 * 위저드 상태 관리 Hook
 */
export function usePlanningWizard(
  projectId?: string,
  options: UsePlanningWizardOptions = {}
) {
  const {
    autoSave = true,
    autoSaveInterval = PLANNING_BUSINESS_RULES.DEFAULT_AUTO_SAVE_INTERVAL,
    enableSessionRestore = true,
    onStepChange,
    onSave,
    onError,
  } = options

  const dispatch = useDispatch()
  const currentProject = useSelector(planningSelectors.getCurrentProject)
  const isLoading = useSelector(planningSelectors.getIsLoading)
  const projects = useSelector(planningSelectors.getProjects)

  // 내부 상태
  const [state, setState] = useState<UsePlanningWizardState>({
    currentStep: 'input',
    progress: {
      currentStep: 'input',
      completedSteps: [],
      isGenerating: false,
      inputCompletion: 0,
      storyCompletion: 0,
      shotsCompletion: 0,
    },
    isGenerating: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    error: null,
    sessionId: '',
  })

  // 자동 저장 타이머
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProjectRef = useRef<PlanningProject | null>(null)

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<UsePlanningWizardState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates }

      // 단계 변경 알림
      if (updates.currentStep && updates.currentStep !== prev.currentStep) {
        onStepChange?.(updates.currentStep)
      }

      return newState
    })
  }, [onStepChange])

  /**
   * 프로젝트 변경 감지 및 진행률 계산
   */
  useEffect(() => {
    if (!currentProject) return

    const progress = calculateWizardProgress(currentProject)

    updateState({
      progress,
      currentStep: progress.currentStep,
      isGenerating: currentProject.metadata.status === 'generating',
    })

    // 변경 사항 감지
    if (lastProjectRef.current && lastProjectRef.current !== currentProject) {
      updateState({ hasUnsavedChanges: true })
    }

    lastProjectRef.current = currentProject
  }, [currentProject, updateState])

  /**
   * 자동 저장 설정
   */
  useEffect(() => {
    if (!autoSave || !state.hasUnsavedChanges || !currentProject) return

    // 기존 타이머 클리어
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // 새 타이머 설정 - $300 사건 방지: 1회만 실행
    autoSaveTimerRef.current = setTimeout(() => {
      if (state.hasUnsavedChanges && currentProject) {
        saveProject()
      }
    }, autoSaveInterval * 1000)

    // 클린업
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [autoSave, autoSaveInterval, state.hasUnsavedChanges, currentProject]) // 의존성에 함수 절대 금지

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  /**
   * 새 프로젝트 시작
   */
  const startNewProject = useCallback(async (
    input: PlanningProjectCreateInput
  ): Promise<void> => {
    try {
      dispatch(planningActions.setLoading(true))

      const sessionId = `planning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      updateState({
        sessionId,
        error: null,
        hasUnsavedChanges: true,
      })

      // 프로젝트 생성
      await dispatch(planningActions.createProject(input))

      // 세션 데이터 저장
      if (enableSessionRestore) {
        const sessionData: SessionRestoreData = {
          planningProjectId: sessionId,
          currentStep: 'input',
          lastActivity: new Date(),
        }
        localStorage.setItem(`planning_session_${sessionId}`, JSON.stringify(sessionData))
      }

      logger.info('새 기획 프로젝트 시작', {
        sessionId,
        title: input.title,
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '프로젝트 생성 실패'

      updateState({ error: errorMessage })
      onError?.(errorMessage)

      logger.error('기획 프로젝트 생성 오류', {
        error: errorMessage,
        input,
      })
    } finally {
      dispatch(planningActions.setLoading(false))
    }
  }, [dispatch, enableSessionRestore, updateState, onError])

  /**
   * 기존 프로젝트 로드
   */
  const loadProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      dispatch(planningActions.setLoading(true))
      await dispatch(planningActions.loadProject(projectId))

      updateState({
        hasUnsavedChanges: false,
        error: null,
      })

      logger.info('기획 프로젝트 로드', { projectId })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '프로젝트 로드 실패'

      updateState({ error: errorMessage })
      onError?.(errorMessage)

      logger.error('기획 프로젝트 로드 오류', {
        error: errorMessage,
        projectId,
      })
    } finally {
      dispatch(planningActions.setLoading(false))
    }
  }, [dispatch, updateState, onError])

  /**
   * 프로젝트 저장
   */
  const saveProject = useCallback(async (): Promise<void> => {
    if (!currentProject) return

    try {
      await dispatch(planningActions.saveProject(currentProject))

      updateState({
        hasUnsavedChanges: false,
        lastSavedAt: new Date(),
      })

      onSave?.(currentProject)

      logger.info('기획 프로젝트 저장', {
        projectId: currentProject.metadata.id,
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '저장 실패'

      updateState({ error: errorMessage })
      onError?.(errorMessage)

      logger.error('기획 프로젝트 저장 오류', {
        error: errorMessage,
        projectId: currentProject.metadata.id,
      })
    }
  }, [currentProject, dispatch, updateState, onSave, onError])

  /**
   * 단계 이동
   */
  const goToStep = useCallback((step: WizardStep): void => {
    if (!currentProject) return

    // 현재 단계까지의 검증
    let canProceed = true
    let validationMessage = ''

    switch (step) {
      case 'story':
        const inputValidation = validatePlanningInput(currentProject.inputData)
        if (!inputValidation.isValid) {
          canProceed = false
          validationMessage = inputValidation.errors[0]?.message || '입력 정보를 완성해주세요'
        }
        break

      case 'shots':
        const storyValidation = validateStorySteps(currentProject.storySteps)
        if (!storyValidation.isValid) {
          canProceed = false
          validationMessage = storyValidation.errors[0]?.message || '스토리 단계를 완성해주세요'
        }
        break
    }

    if (!canProceed) {
      updateState({ error: validationMessage })
      onError?.(validationMessage)
      return
    }

    updateState({
      currentStep: step,
      error: null,
    })

    dispatch(planningActions.setCurrentStep(step))
  }, [currentProject, dispatch, updateState, onError])

  /**
   * 입력 데이터 업데이트
   */
  const updateInputData = useCallback((inputData: Partial<PlanningInputData>): void => {
    if (!currentProject) return

    dispatch(planningActions.updateInputData(inputData))
    updateState({ hasUnsavedChanges: true })
  }, [currentProject, dispatch, updateState])

  /**
   * 스토리 스텝 업데이트
   */
  const updateStorySteps = useCallback((storySteps: StoryStep[]): void => {
    if (!currentProject) return

    dispatch(planningActions.updateStorySteps(storySteps))
    updateState({ hasUnsavedChanges: true })
  }, [currentProject, dispatch, updateState])

  /**
   * 숏 시퀀스 업데이트
   */
  const updateShotSequences = useCallback((shotSequences: ShotSequence[]): void => {
    if (!currentProject) return

    dispatch(planningActions.updateShotSequences(shotSequences))
    updateState({ hasUnsavedChanges: true })
  }, [currentProject, dispatch, updateState])

  /**
   * 세션 복원
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (!enableSessionRestore) return false

    try {
      const sessionKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('planning_session_')
      )

      for (const sessionKey of sessionKeys) {
        const sessionData = JSON.parse(localStorage.getItem(sessionKey) || '{}') as SessionRestoreData

        if (canRestoreSession(sessionData)) {
          await loadProject(sessionData.planningProjectId)

          if (sessionData.currentStep) {
            updateState({ currentStep: sessionData.currentStep })
          }

          logger.info('세션 복원 성공', {
            sessionId: sessionData.planningProjectId,
            step: sessionData.currentStep,
          })

          return true
        }
      }

      return false

    } catch (error) {
      logger.error('세션 복원 실패', error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }, [enableSessionRestore, loadProject, updateState])

  /**
   * 에러 클리어
   */
  const clearError = useCallback((): void => {
    updateState({ error: null })
    dispatch(planningActions.clearError())
  }, [updateState, dispatch])

  /**
   * 전체 리셋
   */
  const reset = useCallback((): void => {
    // 타이머 정리
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // 상태 초기화
    setState({
      currentStep: 'input',
      progress: {
        currentStep: 'input',
        completedSteps: [],
        isGenerating: false,
        inputCompletion: 0,
        storyCompletion: 0,
        shotsCompletion: 0,
      },
      isGenerating: false,
      hasUnsavedChanges: false,
      lastSavedAt: null,
      error: null,
      sessionId: '',
    })

    dispatch(planningActions.reset())
  }, [dispatch])

  /**
   * 완료 체크
   */
  const canCompleteStep = useCallback((step: WizardStep): boolean => {
    if (!currentProject) return false

    switch (step) {
      case 'input':
        return validatePlanningInput(currentProject.inputData).isValid

      case 'story':
        return validateStorySteps(currentProject.storySteps).isValid

      case 'shots':
        return validateShotSequences(currentProject.shotSequences, currentProject.storySteps).isValid

      default:
        return false
    }
  }, [currentProject])

  return {
    // 상태
    state,
    currentStep: state.currentStep,
    progress: state.progress,
    isGenerating: state.isGenerating,
    hasUnsavedChanges: state.hasUnsavedChanges,
    lastSavedAt: state.lastSavedAt,
    error: state.error,

    // 프로젝트 데이터
    currentProject,
    isLoading,
    projects,

    // 액션
    startNewProject,
    loadProject,
    saveProject,
    goToStep,
    updateInputData,
    updateStorySteps,
    updateShotSequences,
    restoreSession,
    clearError,
    reset,

    // 유틸리티
    canCompleteStep,
    completionPercentage: currentProject ? calculateCompletionPercentage(currentProject) : 0,
  }
}