/**
 * Planning Page Component
 *
 * UserJourneyMap 6-11단계: 12숏 기획 및 콘티 생성
 * FSD pages 레이어 - 기획 워크플로우 오케스트레이션
 * CLAUDE.md 준수: React 19, 접근성, 타입 안전성
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../app/store'

import { PlanningWizard, WizardProgress } from '../widgets/planning'
import { selectIsAuthenticated } from '../entities/auth/selectors'
import { scenarioSelectors } from '../entities/scenario'
import type {
  PlanningProject,
  WizardStep,
  PlanningInputData,
  StoryStep,
  ShotSequence
} from '../entities/planning/types'
import { logger } from '../shared/lib/logger'

/**
 * 기획 페이지 상태
 */
type PlanningPageState = 'loading' | 'wizard' | 'completed' | 'error'

/**
 * 기획 페이지 컴포넌트
 * UserJourneyMap 6-11단계 구현
 */
export function PlanningPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // 상태 관리
  const [pageState, setPageState] = useState<PlanningPageState>('loading')
  const [currentPlanningProject, setCurrentPlanningProject] = useState<PlanningProject | null>(null)
  const [wizardStep, setWizardStep] = useState<WizardStep>('input')

  // Redux 상태 조회
  const isAuthenticated = useSelector((state: RootState) =>
    selectIsAuthenticated(state)
  )
  const currentScenario = useSelector((state: RootState) =>
    scenarioSelectors.getCurrentScenario(state)
  )

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('Unauthenticated user accessing planning page', {
        userJourneyStep: 'planning-unauthorized',
        redirectTo: '/login'
      })
      router.push('/login')
      return
    }

    // 시나리오가 완료되지 않은 경우 시나리오 페이지로 리다이렉트
    if (!currentScenario) {
      logger.warn('No scenario found for planning', {
        userJourneyStep: 'planning-no-scenario',
        redirectTo: '/scenario'
      })
      router.push('/scenario')
      return
    }

    setPageState('wizard')
  }, [isAuthenticated, currentScenario, router])

  // UserJourneyMap 6단계: 기획 프로젝트 초기화
  const initializePlanningProject = useCallback((inputData: PlanningInputData) => {
    if (!currentScenario) return

    logger.info('Planning project initialized', {
      userJourneyStep: 'planning-initialized',
      scenarioId: currentScenario.metadata.id,
      inputData: { title: inputData.title, toneAndManner: inputData.toneAndManner }
    })

    const newProject: PlanningProject = {
      metadata: {
        id: `planning_${currentScenario.metadata.id}_${Date.now()}`,
        title: inputData.title,
        description: inputData.logline,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: currentScenario.metadata.userId,
        projectId: currentScenario.metadata.projectId,
        status: 'draft'
      },
      inputData,
      storySteps: [], // 시나리오에서 가져올 예정
      shotSequences: [],
      insertShots: [],
      completionPercentage: 10,
      currentStep: 'input'
    }

    setCurrentPlanningProject(newProject)
    setWizardStep('story')
  }, [currentScenario])

  // UserJourneyMap 7-8단계: 4단계 스토리 → 12숏 분해
  const handleStoryStepsGenerated = useCallback((storySteps: StoryStep[]) => {
    if (!currentPlanningProject) return

    logger.info('Story steps generated for planning', {
      userJourneyStep: 'planning-story-generated',
      stepCount: storySteps.length,
      nextPhase: 'shot-breakdown'
    })

    const updatedProject: PlanningProject = {
      ...currentPlanningProject,
      storySteps,
      completionPercentage: 40,
      currentStep: 'story',
      metadata: {
        ...currentPlanningProject.metadata,
        updatedAt: new Date()
      }
    }

    setCurrentPlanningProject(updatedProject)
    setWizardStep('shots')
  }, [currentPlanningProject])

  // UserJourneyMap 9-10단계: 12숏 시퀀스 생성 및 편집
  const handleShotSequencesGenerated = useCallback((shotSequences: ShotSequence[]) => {
    if (!currentPlanningProject) return

    logger.info('Shot sequences generated', {
      userJourneyStep: 'planning-shots-generated',
      shotCount: shotSequences.length,
      totalDuration: shotSequences.reduce((sum, shot) => sum + shot.duration, 0)
    })

    const updatedProject: PlanningProject = {
      ...currentPlanningProject,
      shotSequences,
      completionPercentage: 80,
      currentStep: 'shots',
      totalDuration: shotSequences.reduce((sum, shot) => sum + shot.duration, 0),
      metadata: {
        ...currentPlanningProject.metadata,
        updatedAt: new Date()
      }
    }

    setCurrentPlanningProject(updatedProject)
  }, [currentPlanningProject])

  // UserJourneyMap 11단계: 기획 완료 및 다음 단계로 이동
  const handlePlanningCompleted = useCallback(() => {
    if (!currentPlanningProject) return

    logger.info('Planning phase completed', {
      userJourneyStep: 'planning-completed',
      planningProjectId: currentPlanningProject.metadata.id,
      shotCount: currentPlanningProject.shotSequences.length,
      nextStep: 'video-generation'
    })

    const completedProject: PlanningProject = {
      ...currentPlanningProject,
      completionPercentage: 100,
      metadata: {
        ...currentPlanningProject.metadata,
        status: 'completed',
        updatedAt: new Date()
      }
    }

    setCurrentPlanningProject(completedProject)
    setPageState('completed')
  }, [currentPlanningProject])

  // UserJourneyMap 12단계로 이동: 영상 생성
  const handleProceedToVideoGeneration = useCallback(() => {
    if (!currentPlanningProject) {
      logger.error('Cannot proceed to video generation without planning project', {
        userJourneyStep: 'video-generation-blocked'
      })
      return
    }

    logger.info('Proceeding to video generation', {
      userJourneyStep: 'planning-to-video-generation',
      planningProjectId: currentPlanningProject.metadata.id,
      shotSequenceCount: currentPlanningProject.shotSequences.length,
      nextStep: 'video-generation'
    })

    router.push('/video-generator')
  }, [currentPlanningProject, router])

  // 오류 처리
  const handlePlanningError = useCallback((error: string) => {
    logger.error('Planning error occurred', {
      userJourneyStep: 'planning-error',
      error
    })
    setPageState('error')
  }, [])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">기획 환경을 준비 중입니다...</p>
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-soft p-8 text-center">
            <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">
              기획 중 오류가 발생했습니다
            </h2>
            <button
              onClick={() => router.push('/scenario')}
              className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              시나리오로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-neutral-900">
              12숏 기획
            </h1>

            {/* UserJourneyMap 진행 상황 */}
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <div className="w-3 h-3 rounded-full bg-success-500"></div>
              <span>2-5단계 완료</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className={`w-3 h-3 rounded-full ${
                pageState === 'completed'
                  ? 'bg-success-500'
                  : 'bg-primary-500'
              }`}></div>
              <span>6-11단계</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-300"></div>
              <span>12-22단계</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 위저드 진행 상황 표시 */}
        {currentPlanningProject && (
          <div className="mb-8">
            <WizardProgress
              currentStep={wizardStep}
              completedSteps={currentPlanningProject.completionPercentage >= 100 ? ['input', 'story', 'shots'] : []}
              isGenerating={false}
              lastSavedAt={currentPlanningProject.metadata.updatedAt}
              inputCompletion={currentPlanningProject.completionPercentage >= 10 ? 100 : 0}
              storyCompletion={currentPlanningProject.completionPercentage >= 40 ? 100 : 0}
              shotsCompletion={currentPlanningProject.completionPercentage >= 80 ? 100 : 0}
            />
          </div>
        )}

        {/* UserJourneyMap 6-11단계: 기획 위저드 */}
        {pageState === 'wizard' && (
          <PlanningWizard
            scenario={currentScenario}
            onPlanningInitialized={initializePlanningProject}
            onStoryStepsGenerated={handleStoryStepsGenerated}
            onShotSequencesGenerated={handleShotSequencesGenerated}
            onPlanningCompleted={handlePlanningCompleted}
            onError={handlePlanningError}
            initialProject={currentPlanningProject}
          />
        )}

        {/* 기획 완료 */}
        {pageState === 'completed' && currentPlanningProject && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-soft p-8">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                12숏 기획 완료!
              </h2>

              <p className="text-neutral-600 mb-8">
                총 {currentPlanningProject.shotSequences.length}개의 숏 시퀀스가 생성되었습니다.<br />
                예상 영상 길이: {Math.round((currentPlanningProject.totalDuration || 0) / 60)}분
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div className="text-left">
                  <span className="font-medium text-neutral-900">생성된 숏:</span>
                  <span className="ml-2 text-neutral-600">{currentPlanningProject.shotSequences.length}개</span>
                </div>
                <div className="text-left">
                  <span className="font-medium text-neutral-900">스토리 단계:</span>
                  <span className="ml-2 text-neutral-600">{currentPlanningProject.storySteps.length}단계</span>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleProceedToVideoGeneration}
                  className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                >
                  영상 생성으로 이동 →
                </button>

                <button
                  onClick={() => setPageState('wizard')}
                  className="w-full px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  기획 수정하기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default PlanningPage