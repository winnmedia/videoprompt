/**
 * PlanningWizard Widget
 *
 * 영상 기획 위저드의 3-Step Wizard UI/UX 컴포넌트
 * FRD.md 명세 구현: Step 1(입력/선택) → Step 2(4단계 검토) → Step 3(12숏 편집)
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

'use client';

import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { usePlanningWizard, useStoryGeneration, useShotBreakdown } from '../../features/planning'
import type { PlanningInputData, WizardStep, PlanningProject } from '../../entities/planning'

import { PlanningInputForm } from './PlanningInputForm'
import { StoryStepEditor } from './StoryStepEditor'
import { ShotGridEditor } from './ShotGridEditor'
import { WizardStepper } from './WizardStepper'
import { WizardProgress } from './WizardProgress'
import { WizardNavigation } from './WizardNavigation'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { ErrorBoundary } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 위저드 속성
 */
export interface PlanningWizardProps {
  projectId?: string
  onComplete?: (projectId: string) => void
  onError?: (error: string) => void
  onStepChange?: (step: WizardStep) => void
  className?: string
  enableAutoSave?: boolean
  enableSessionRestore?: boolean
  // FRD.md 명세 - 3-Step Wizard 설정
  enableKeyboardNavigation?: boolean
  enableAccessibility?: boolean
  enablePerformanceOptimization?: boolean
}

/**
 * 영상 기획 위저드 메인 컴포넌트
 * FRD.md 명세: 3-Step Wizard UI/UX 구현
 */
export const PlanningWizard = memo(function PlanningWizard({
  projectId,
  onComplete,
  onError,
  onStepChange,
  className = '',
  enableAutoSave = true,
  enableSessionRestore = true,
  enableKeyboardNavigation = true,
  enableAccessibility = true,
  enablePerformanceOptimization = true,
}: PlanningWizardProps) {
  // 위저드 상태 관리
  const {
    currentStep,
    currentProject,
    isLoading,
    hasUnsavedChanges,
    lastSavedAt,
    error,
    completionPercentage,
    startNewProject,
    loadProject,
    saveProject,
    goToStep,
    updateInputData,
    updateStorySteps,
    updateShotSequences,
    restoreSession,
    clearError,
    canCompleteStep,
  } = usePlanningWizard(projectId, {
    autoSave: enableAutoSave,
    enableSessionRestore,
    onStepChange: (step) => {
      logger.info('위저드 단계 변경', { step, projectId })
      onStepChange?.(step)
    },
    onSave: (project) => {
      logger.info('프로젝트 자동 저장', {
        projectId: project.metadata.id,
        step: currentStep,
      })
    },
    onError: (error) => {
      logger.error('위저드 오류', { error, projectId, step: currentStep })
      onError?.(error)
    },
  })

  // 스토리 생성 기능
  const {
    isGenerating: isGeneratingStory,
    generateStory,
    useDefaultTemplate,
    error: storyError,
    clearError: clearStoryError,
  } = useStoryGeneration({
    onSuccess: (result) => {
      updateStorySteps(result.storySteps)
      logger.info('스토리 생성 완료', {
        projectId: currentProject?.metadata.id,
        stepsCount: result.storySteps.length,
      })
    },
    onError: (error) => {
      logger.error('스토리 생성 실패', { error, projectId })
      onError?.(error)
    },
  })

  // 숏 분해 기능
  const {
    isGenerating: isGeneratingShots,
    breakdownShots,
    useDefaultBreakdown,
    error: shotError,
    clearError: clearShotError,
  } = useShotBreakdown({
    onSuccess: (result) => {
      updateShotSequences(result.shotSequences)
      logger.info('숏 분해 완료', {
        projectId: currentProject?.metadata.id,
        shotCount: result.shotSequences.length,
      })
    },
    onError: (error) => {
      logger.error('숏 분해 실패', { error, projectId })
      onError?.(error)
    },
  })

  // 전체 로딩 상태
  const isProcessing = isLoading || isGeneratingStory || isGeneratingShots

  // 전체 에러 상태
  const currentError = error || storyError || shotError

  // 프로젝트 로드 (초기 렌더링 시)
  useEffect(() => {
    const initializeProject = async () => {
      try {
        if (projectId) {
          await loadProject(projectId)
        } else if (enableSessionRestore) {
          const restored = await restoreSession()
          if (!restored) {
            logger.info('복원할 세션이 없습니다. 새 프로젝트를 시작하세요.')
          }
        }
      } catch (error) {
        logger.error('프로젝트 초기화 실패', {
          error: error instanceof Error ? error.message : String(error),
          projectId,
        })
      }
    }

    initializeProject()
  }, [projectId]) // projectId만 의존성으로 설정 - $300 사건 방지

  /**
   * 새 프로젝트 시작
   */
  const handleStartNewProject = useCallback(async (inputData: PlanningInputData) => {
    try {
      await startNewProject({
        title: inputData.title,
        description: inputData.description,
        inputData,
      })

      logger.info('새 기획 프로젝트 시작', {
        title: inputData.title,
        toneAndManner: inputData.toneAndManner,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '프로젝트 시작 실패'
      onError?.(errorMessage)
    }
  }, [startNewProject, onError])

  /**
   * 스토리 생성 처리
   */
  const handleGenerateStory = useCallback(async (inputData: PlanningInputData) => {
    if (!currentProject) {
      await handleStartNewProject(inputData)
      return
    }

    try {
      await generateStory(inputData)
    } catch (error) {
      logger.error('스토리 생성 중 오류', {
        error: error instanceof Error ? error.message : String(error),
        projectId: currentProject.metadata.id,
      })
    }
  }, [currentProject, generateStory, handleStartNewProject])

  /**
   * 숏 분해 처리
   */
  const handleBreakdownShots = useCallback(async () => {
    if (!currentProject || currentProject.storySteps.length === 0) {
      onError?.('스토리 단계를 먼저 완성해주세요')
      return
    }

    try {
      await breakdownShots(currentProject.storySteps, currentProject.inputData)
    } catch (error) {
      logger.error('숏 분해 중 오류', {
        error: error instanceof Error ? error.message : String(error),
        projectId: currentProject.metadata.id,
      })
    }
  }, [currentProject, breakdownShots, onError])

  /**
   * 단계 이동 처리
   */
  const handleStepChange = useCallback((step: WizardStep) => {
    if (isProcessing) {
      return // 처리 중일 때는 단계 변경 방지
    }

    goToStep(step)
  }, [isProcessing, goToStep])

  /**
   * 완료 처리
   */
  const handleComplete = useCallback(async () => {
    if (!currentProject) return

    try {
      await saveProject()
      onComplete?.(currentProject.metadata.id)

      logger.info('기획 프로젝트 완료', {
        projectId: currentProject.metadata.id,
        title: currentProject.metadata.title,
        completionPercentage,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '완료 처리 실패'
      onError?.(errorMessage)
    }
  }, [currentProject, saveProject, onComplete, completionPercentage])

  /**
   * 에러 처리
   */
  const handleClearError = useCallback(() => {
    clearError()
    clearStoryError()
    clearShotError()
  }, [clearError, clearStoryError, clearShotError])

  /**
   * 렌더링할 단계 컴포넌트 결정 (FRD.md 명세 구현)
   */
  const renderStepContent = useMemo(() => {
    if (!currentProject && currentStep !== 'input') {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">프로젝트를 시작해주세요</h3>
            <p className="text-gray-600 max-w-sm">새로운 영상 기획 프로젝트를 생성하여 3단계 위저드를 시작하세요.</p>
            <button
              onClick={() => handleStepChange('input')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              data-testid="start-new-project-button"
            >
              새 프로젝트 시작
            </button>
          </div>
        </div>
      )
    }

    switch (currentStep) {
      case 'input':
        return (
          <PlanningInputForm
            defaultValues={currentProject?.inputData}
            onSubmit={handleGenerateStory}
            onUseTemplate={useDefaultTemplate}
            isGenerating={isGeneratingStory}
            disabled={isProcessing}
            enableKeyboardNavigation={enableKeyboardNavigation}
            data-testid="story-input-form"
          />
        )

      case 'story':
        if (!currentProject) return null
        return (
          <StoryStepEditor
            storySteps={currentProject.storySteps}
            inputData={currentProject.inputData}
            onChange={updateStorySteps}
            onGenerateShots={handleBreakdownShots}
            isGenerating={isGeneratingShots}
            disabled={isProcessing}
            enableInlineEditing={true}
            data-testid="story-step-editor"
          />
        )

      case 'shots':
        if (!currentProject) return null
        return (
          <ShotGridEditor
            shotSequences={currentProject.shotSequences}
            storySteps={currentProject.storySteps}
            insertShots={currentProject.insertShots}
            onChange={updateShotSequences}
            onComplete={handleComplete}
            disabled={isProcessing}
            gridLayout="3x4"
            enableVirtualization={enablePerformanceOptimization}
            data-testid="shot-grid-editor"
          />
        )

      default:
        return null
    }
  }, [
    currentStep,
    currentProject,
    isProcessing,
    isGeneratingStory,
    isGeneratingShots,
    enableKeyboardNavigation,
    enablePerformanceOptimization,
    handleStepChange,
    handleGenerateStory,
    useDefaultTemplate,
    updateStorySteps,
    handleBreakdownShots,
    updateShotSequences,
    handleComplete,
  ])

  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <svg className="w-12 h-12 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-red-600">
              위저드 오류가 발생했습니다
            </h2>
            <p className="text-gray-600">
              페이지를 새로고침하거나 고객 지원팀에 문의해주세요.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                data-testid="error-reload-button"
              >
                새로고침
              </button>
              <button
                onClick={handleClearError}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                data-testid="error-retry-button"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      }
    >
      <main
        className={`planning-wizard ${className}`}
        role="main"
        aria-label="영상 기획 위저드"
        data-testid="planning-wizard"
      >
        {/* 헤더: 타이틀 및 스텝퍼 */}
        <header className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">영상 기획</h1>
            <p className="text-gray-600">3단계로 완성하는 영상 기획서</p>
          </div>

          <WizardStepper
            currentStep={currentStep}
            completedSteps={[]}
            onStepClick={handleStepChange}
            disabled={isProcessing}
            data-testid="wizard-stepper"
          />
        </header>

        {/* 진행률 및 자동저장 표시 */}
        <div className="mb-6 space-y-4">
          <WizardProgress
            currentStep={currentStep}
            completionPercentage={completionPercentage}
            isProcessing={isProcessing}
            data-testid="wizard-progress"
          />

          {enableAutoSave && (
            <AutoSaveIndicator
              hasUnsavedChanges={hasUnsavedChanges}
              lastSavedAt={lastSavedAt}
              isLoading={isLoading}
              data-testid="auto-save-indicator"
            />
          )}
        </div>

        {/* 에러 메시지 */}
        {currentError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-1">오류가 발생했습니다</h3>
                <p className="text-sm text-red-700">{currentError}</p>
              </div>
              <button
                onClick={handleClearError}
                className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                aria-label="에러 메시지 닫기"
                data-testid="close-error-button"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 단계별 컨텐츠 */}
        <section className="mb-8">
          <div className="min-h-[600px]">
            {renderStepContent}
          </div>
        </section>

        {/* 하단 네비게이션 */}
        <footer>
          <WizardNavigation
            currentStep={currentStep}
            onStepChange={handleStepChange}
            canCompleteStep={canCompleteStep}
            isProcessing={isProcessing}
            hasProject={!!currentProject}
            enableKeyboardNavigation={enableKeyboardNavigation}
            data-testid="wizard-navigation"
          />
        </footer>
      </main>
    </ErrorBoundary>
  )
})

// 성능 최적화: React.memo 사용
PlanningWizard.displayName = 'PlanningWizard'

export default PlanningWizard