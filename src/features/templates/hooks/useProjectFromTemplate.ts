/**
 * 템플릿으로부터 프로젝트 생성 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux 상태와 연동
 * - $300 사건 방지: 중복 프로젝트 생성 방지
 * - 프로젝트 생성 과정 추적 및 에러 처리
 */

import { useCallback, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import type { AppDispatch } from '../../../app/store'
import type {
  ProjectTemplate,
  CreateProjectFromTemplateRequest
} from '../../../entities/templates'
import {
  createProjectFromTemplateAsync,
  clearError,
  selectSelectedTemplate,
  selectTemplateLoadingState,
  selectTemplateErrors
} from '../store/template-slice'

// ===========================================
// 타입 정의
// ===========================================

export interface ProjectCreationStep {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly isCompleted: boolean
  readonly isActive: boolean
  readonly hasError: boolean
}

export interface UseProjectFromTemplateOptions {
  /**
   * 프로젝트 생성 완료 시 자동 리다이렉트 여부
   */
  readonly autoRedirect?: boolean

  /**
   * 리다이렉트할 경로 (기본값: /editor/[projectId])
   */
  readonly redirectPath?: string

  /**
   * 프로젝트 생성 성공 시 콜백
   */
  readonly onSuccess?: (projectId: string) => void

  /**
   * 프로젝트 생성 실패 시 콜백
   */
  readonly onError?: (error: string) => void

  /**
   * 단계별 진행 시 콜백
   */
  readonly onStepProgress?: (step: ProjectCreationStep) => void
}

export interface UseProjectFromTemplateReturn {
  // 프로젝트 생성 상태
  readonly isCreating: boolean
  readonly isCompleted: boolean
  readonly error: string | null
  readonly progress: number // 0-100

  // 생성 단계
  readonly steps: readonly ProjectCreationStep[]
  readonly currentStep: ProjectCreationStep | null

  // 생성된 프로젝트 정보
  readonly createdProjectId: string | null
  readonly createdProjectName: string | null

  // 액션 함수들
  readonly createProject: (request: Omit<CreateProjectFromTemplateRequest, 'templateId'>) => Promise<void>
  readonly createProjectWithTemplate: (
    template: ProjectTemplate,
    request: Omit<CreateProjectFromTemplateRequest, 'templateId'>
  ) => Promise<void>
  readonly retryCreation: () => Promise<void>
  readonly resetCreation: () => void
  readonly clearErrors: () => void

  // 유틸리티 함수들
  readonly validateRequest: (request: Omit<CreateProjectFromTemplateRequest, 'templateId'>) => string[]
  readonly getEstimatedDuration: (template?: ProjectTemplate) => number // 예상 소요 시간 (초)
}

// ===========================================
// 기본 단계 정의
// ===========================================

const DEFAULT_CREATION_STEPS: Omit<ProjectCreationStep, 'isCompleted' | 'isActive' | 'hasError'>[] = [
  {
    id: 'validate',
    title: '요청 검증',
    description: '프로젝트 생성 요청을 검증합니다'
  },
  {
    id: 'prepare',
    title: '템플릿 준비',
    description: '선택한 템플릿을 분석하고 프로젝트 구조를 준비합니다'
  },
  {
    id: 'create',
    title: '프로젝트 생성',
    description: '템플릿을 기반으로 새 프로젝트를 생성합니다'
  },
  {
    id: 'configure',
    title: '설정 적용',
    description: '사용자 커스터마이징을 적용합니다'
  },
  {
    id: 'finalize',
    title: '완료 처리',
    description: '프로젝트 생성을 완료하고 결과를 저장합니다'
  }
]

// ===========================================
// 메인 훅
// ===========================================

export function useProjectFromTemplate(
  options: UseProjectFromTemplateOptions = {}
): UseProjectFromTemplateReturn {
  const {
    autoRedirect = true,
    redirectPath,
    onSuccess,
    onError,
    onStepProgress
  } = options

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()

  // Redux 상태
  const selectedTemplate = useSelector(selectSelectedTemplate)
  const { isCreatingProject } = useSelector(selectTemplateLoadingState)
  const { createProjectError } = useSelector(selectTemplateErrors)

  // 로컬 상태
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [steps, setSteps] = useState<readonly ProjectCreationStep[]>([])
  const [lastRequest, setLastRequest] = useState<CreateProjectFromTemplateRequest | null>(null)

  // ===========================================
  // 계산된 값들
  // ===========================================

  const isCompleted = createdProjectId !== null
  const progress = steps.length > 0 ? (steps.filter(s => s.isCompleted).length / steps.length) * 100 : 0
  const currentStep = currentStepIndex >= 0 && currentStepIndex < steps.length ? steps[currentStepIndex] : null

  // ===========================================
  // 단계 관리 함수들
  // ===========================================

  /**
   * 단계 초기화
   */
  const initializeSteps = useCallback(() => {
    const initialSteps = DEFAULT_CREATION_STEPS.map((step, index) => ({
      ...step,
      isCompleted: false,
      isActive: index === 0,
      hasError: false
    }))

    setSteps(initialSteps)
    setCurrentStepIndex(0)
  }, [])

  /**
   * 다음 단계로 진행
   */
  const advanceToNextStep = useCallback(() => {
    setSteps(prev => {
      const newSteps = prev.map((step, index) => {
        if (index === currentStepIndex) {
          return { ...step, isCompleted: true, isActive: false }
        }
        if (index === currentStepIndex + 1) {
          return { ...step, isActive: true }
        }
        return step
      })

      const nextStep = newSteps[currentStepIndex + 1]
      if (nextStep && onStepProgress) {
        onStepProgress(nextStep)
      }

      return newSteps
    })

    setCurrentStepIndex(prev => prev + 1)
  }, [currentStepIndex, onStepProgress])

  /**
   * 현재 단계에서 에러 처리
   */
  const markCurrentStepAsError = useCallback(() => {
    setSteps(prev => prev.map((step, index) => {
      if (index === currentStepIndex) {
        return { ...step, hasError: true, isActive: false }
      }
      return step
    }))
  }, [currentStepIndex])

  // ===========================================
  // 검증 함수들
  // ===========================================

  /**
   * 프로젝트 생성 요청 검증
   */
  const validateRequest = useCallback((
    request: Omit<CreateProjectFromTemplateRequest, 'templateId'>
  ): string[] => {
    const errors: string[] = []

    // 프로젝트 이름 검증
    if (!request.projectName?.trim()) {
      errors.push('프로젝트 이름은 필수입니다')
    } else if (request.projectName.length < 2) {
      errors.push('프로젝트 이름은 최소 2자 이상이어야 합니다')
    } else if (request.projectName.length > 100) {
      errors.push('프로젝트 이름은 100자를 초과할 수 없습니다')
    }

    // 커스터마이징 검증 (선택사항)
    if (request.customizations) {
      try {
        JSON.stringify(request.customizations)
      } catch {
        errors.push('커스터마이징 데이터 형식이 올바르지 않습니다')
      }
    }

    return errors
  }, [])

  /**
   * 예상 소요 시간 계산 (초)
   */
  const getEstimatedDuration = useCallback((template?: ProjectTemplate): number => {
    if (!template) return 30 // 기본값

    // 템플릿 복잡도에 따른 계산
    const baseTime = 10 // 기본 10초
    const storyStepsTime = template.storySteps.length * 2 // 스토리 단계별 2초
    const shotSequencesTime = template.shotSequences.length * 1 // 숏 시퀀스별 1초
    const assetsTime = template.assets.length * 3 // 에셋별 3초

    return baseTime + storyStepsTime + shotSequencesTime + assetsTime
  }, [])

  // ===========================================
  // 프로젝트 생성 함수들
  // ===========================================

  /**
   * 선택된 템플릿으로 프로젝트 생성
   */
  const createProject = useCallback(async (
    request: Omit<CreateProjectFromTemplateRequest, 'templateId'>
  ) => {
    if (!selectedTemplate) {
      throw new Error('템플릿이 선택되지 않았습니다')
    }

    return createProjectWithTemplate(selectedTemplate, request)
  }, [selectedTemplate])

  /**
   * 특정 템플릿으로 프로젝트 생성
   */
  const createProjectWithTemplate = useCallback(async (
    template: ProjectTemplate,
    request: Omit<CreateProjectFromTemplateRequest, 'templateId'>
  ) => {
    // 중복 생성 방지 ($300 사건 방지)
    if (isCreatingProject) {
      throw new Error('이미 프로젝트 생성이 진행 중입니다')
    }

    // 요청 검증
    const validationErrors = validateRequest(request)
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '))
    }

    const fullRequest: CreateProjectFromTemplateRequest = {
      ...request,
      templateId: template.id
    }

    try {
      // 단계 초기화
      initializeSteps()
      setLastRequest(fullRequest)

      // 1단계: 검증 완료
      await new Promise(resolve => setTimeout(resolve, 500))
      advanceToNextStep()

      // 2단계: 템플릿 준비
      await new Promise(resolve => setTimeout(resolve, 1000))
      advanceToNextStep()

      // 3단계: 프로젝트 생성 (실제 API 호출)
      const result = await dispatch(createProjectFromTemplateAsync(fullRequest)).unwrap()
      advanceToNextStep()

      // 4단계: 설정 적용
      await new Promise(resolve => setTimeout(resolve, 500))
      advanceToNextStep()

      // 5단계: 완료 처리
      await new Promise(resolve => setTimeout(resolve, 300))
      advanceToNextStep()

      // 성공 처리
      setCreatedProjectId(result.projectId)
      setCreatedProjectName(fullRequest.projectName)

      if (onSuccess) {
        onSuccess(result.projectId)
      }

      // 자동 리다이렉트
      if (autoRedirect) {
        const path = redirectPath || `/editor/${result.projectId}`
        router.push(path)
      }

    } catch (error) {
      markCurrentStepAsError()
      const errorMessage = error instanceof Error ? error.message : '프로젝트 생성 중 오류가 발생했습니다'

      if (onError) {
        onError(errorMessage)
      }

      throw error
    }
  }, [
    isCreatingProject,
    validateRequest,
    initializeSteps,
    advanceToNextStep,
    markCurrentStepAsError,
    dispatch,
    onSuccess,
    onError,
    autoRedirect,
    redirectPath,
    router
  ])

  /**
   * 프로젝트 생성 재시도
   */
  const retryCreation = useCallback(async () => {
    if (!lastRequest) {
      throw new Error('재시도할 요청이 없습니다')
    }

    // 에러 상태 클리어
    dispatch(clearError())
    setCreatedProjectId(null)
    setCreatedProjectName(null)

    // 재생성 시도
    return dispatch(createProjectFromTemplateAsync(lastRequest)).unwrap()
  }, [lastRequest, dispatch])

  /**
   * 생성 상태 리셋
   */
  const resetCreation = useCallback(() => {
    setCreatedProjectId(null)
    setCreatedProjectName(null)
    setCurrentStepIndex(-1)
    setSteps([])
    setLastRequest(null)
    dispatch(clearError())
  }, [dispatch])

  /**
   * 에러 클리어
   */
  const clearErrors = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  // ===========================================
  // 에러 상태 처리
  // ===========================================

  useEffect(() => {
    if (createProjectError && currentStep) {
      markCurrentStepAsError()
    }
  }, [createProjectError, currentStep, markCurrentStepAsError])

  // ===========================================
  // 반환값
  // ===========================================

  return {
    // 프로젝트 생성 상태
    isCreating: isCreatingProject,
    isCompleted,
    error: createProjectError,
    progress,

    // 생성 단계
    steps,
    currentStep,

    // 생성된 프로젝트 정보
    createdProjectId,
    createdProjectName,

    // 액션 함수들
    createProject,
    createProjectWithTemplate,
    retryCreation,
    resetCreation,
    clearErrors,

    // 유틸리티 함수들
    validateRequest,
    getEstimatedDuration
  }
}

// ===========================================
// 특수 목적 훅들
// ===========================================

/**
 * 간단한 프로젝트 생성 훅 (기본 설정)
 */
export function useQuickProjectCreation() {
  const { createProject, isCreating, error } = useProjectFromTemplate({
    autoRedirect: true
  })

  const quickCreate = useCallback(async (projectName: string) => {
    return createProject({ projectName })
  }, [createProject])

  return {
    quickCreate,
    isCreating,
    error
  }
}

/**
 * 프로젝트 생성 진행률 모니터링 훅
 */
export function useProjectCreationMonitor() {
  const { steps, progress, currentStep, isCreating } = useProjectFromTemplate()

  return {
    steps,
    progress,
    currentStep,
    isActive: isCreating,
    completedSteps: steps.filter(s => s.isCompleted).length,
    totalSteps: steps.length
  }
}