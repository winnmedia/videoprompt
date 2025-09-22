/**
 * Scenario Page Component
 *
 * UserJourneyMap 2-5단계: 시나리오 생성 → 4단계 스토리 → 썸네일 생성
 * FSD pages 레이어 - 시나리오 워크플로우 오케스트레이션
 * CLAUDE.md 준수: React 19, 접근성, 타입 안전성
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../app/store'

import { ScenarioForm, StoryGenerator, ThumbnailGrid } from '../widgets/scenario'
import { authSelectors } from '../entities/auth'
import { scenarioSelectors } from '../entities/scenario'
import type { Scenario, StoryStep } from '../entities/scenario'
import { logger } from '../shared/lib/logger'

/**
 * 시나리오 생성 상태
 */
type ScenarioState = 'form' | 'story-generation' | 'story-editing' | 'thumbnail-generation' | 'completed'

/**
 * 시나리오 페이지 컴포넌트
 * UserJourneyMap 2-5단계 구현
 */
export function ScenarioPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // 상태 관리
  const [currentState, setCurrentState] = useState<ScenarioState>('form')
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [storySteps, setStorySteps] = useState<StoryStep[]>([])
  const [thumbnails, setThumbnails] = useState<string[]>([])

  // Redux 상태 조회
  const isAuthenticated = useSelector((state: RootState) =>
    authSelectors.isAuthenticated(state)
  )
  const currentScenario = useSelector((state: RootState) =>
    scenarioSelectors.getCurrentScenario(state)
  )

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('Unauthenticated user accessing scenario page', {
        userJourneyStep: 'scenario-unauthorized',
        redirectTo: '/login'
      })
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // UserJourneyMap 2단계: 시나리오 생성 완료
  const handleScenarioCreated = useCallback((newScenario: Scenario) => {
    logger.info('Scenario created, moving to story generation', {
      userJourneyStep: 'scenario-created',
      scenarioId: newScenario.id,
      nextStep: 'story-generation'
    })

    setScenario(newScenario)
    setCurrentState('story-generation')
  }, [])

  // UserJourneyMap 3단계: 4단계 스토리 생성 완료
  const handleStoryGenerated = useCallback((steps: StoryStep[]) => {
    logger.info('4-step story generated', {
      userJourneyStep: 'story-generated',
      stepCount: steps.length,
      nextStep: 'story-editing'
    })

    setStorySteps(steps)
    setCurrentState('story-editing')
  }, [])

  // UserJourneyMap 4단계: 스토리 편집 완료
  const handleStoryEditingComplete = useCallback((editedSteps: StoryStep[]) => {
    logger.info('Story editing completed, generating thumbnails', {
      userJourneyStep: 'story-editing-completed',
      nextStep: 'thumbnail-generation'
    })

    setStorySteps(editedSteps)
    setCurrentState('thumbnail-generation')
  }, [])

  // UserJourneyMap 5단계: 썸네일 생성 완료
  const handleThumbnailsGenerated = useCallback((generatedThumbnails: string[]) => {
    logger.info('Thumbnails generated, scenario workflow completed', {
      userJourneyStep: 'thumbnails-generated',
      thumbnailCount: generatedThumbnails.length,
      nextStep: 'planning-phase'
    })

    setThumbnails(generatedThumbnails)
    setCurrentState('completed')
  }, [])

  // UserJourneyMap 6단계로 이동: 12숏 기획
  const handleProceedToPlanning = useCallback(() => {
    if (!scenario || storySteps.length === 0) {
      logger.error('Cannot proceed to planning without scenario and story', {
        userJourneyStep: 'planning-blocked',
        hasScenario: !!scenario,
        storyStepCount: storySteps.length
      })
      return
    }

    logger.info('Proceeding to planning phase', {
      userJourneyStep: 'scenario-to-planning',
      scenarioId: scenario.id,
      storyStepCount: storySteps.length,
      nextStep: 'planning'
    })

    router.push('/planning')
  }, [scenario, storySteps, router])

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-neutral-900">
              시나리오 생성
            </h1>

            {/* UserJourneyMap 진행 상황 */}
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <div className={`w-3 h-3 rounded-full ${
                ['form', 'story-generation'].includes(currentState)
                  ? 'bg-primary-500'
                  : 'bg-success-500'
              }`}></div>
              <span>2-3단계</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className={`w-3 h-3 rounded-full ${
                currentState === 'completed'
                  ? 'bg-success-500'
                  : currentState === 'thumbnail-generation'
                  ? 'bg-primary-500'
                  : 'bg-neutral-300'
              }`}></div>
              <span>4-5단계</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* UserJourneyMap 2단계: 시나리오 입력 폼 */}
        {currentState === 'form' && (
          <ScenarioForm
            onScenarioCreated={handleScenarioCreated}
          />
        )}

        {/* UserJourneyMap 3단계: 4단계 스토리 생성 */}
        {currentState === 'story-generation' && scenario && (
          <StoryGenerator
            scenario={scenario}
            onStoryGenerated={handleStoryGenerated}
          />
        )}

        {/* UserJourneyMap 4단계: 스토리 편집 */}
        {currentState === 'story-editing' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-soft p-6">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                4단계 스토리 편집
              </h2>
              <div className="space-y-6">
                {storySteps.map((step, index) => (
                  <div key={step.id} className="border border-neutral-200 rounded-lg p-4">
                    <h3 className="font-medium text-neutral-900 mb-2">
                      {index + 1}단계: {step.title}
                    </h3>
                    <textarea
                      className="w-full p-3 border border-neutral-300 rounded-md"
                      rows={3}
                      value={step.content}
                      onChange={(e) => {
                        const updatedSteps = [...storySteps]
                        updatedSteps[index] = { ...step, content: e.target.value }
                        setStorySteps(updatedSteps)
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => handleStoryEditingComplete(storySteps)}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  편집 완료
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UserJourneyMap 5단계: 썸네일 생성 */}
        {currentState === 'thumbnail-generation' && (
          <ThumbnailGrid
            storySteps={storySteps}
            onThumbnailsGenerated={handleThumbnailsGenerated}
          />
        )}

        {/* 워크플로우 완료 */}
        {currentState === 'completed' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-soft p-8">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                시나리오 단계 완료!
              </h2>

              <p className="text-neutral-600 mb-8">
                4단계 스토리와 썸네일이 성공적으로 생성되었습니다.<br />
                이제 12숏 기획 단계로 넘어가세요.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div className="text-left">
                  <span className="font-medium text-neutral-900">생성된 스토리:</span>
                  <span className="ml-2 text-neutral-600">{storySteps.length}단계</span>
                </div>
                <div className="text-left">
                  <span className="font-medium text-neutral-900">생성된 썸네일:</span>
                  <span className="ml-2 text-neutral-600">{thumbnails.length}개</span>
                </div>
              </div>

              <button
                onClick={handleProceedToPlanning}
                className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                12숏 기획으로 이동 →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ScenarioPage