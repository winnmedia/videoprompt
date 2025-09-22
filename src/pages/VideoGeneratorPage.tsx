/**
 * Video Generator Page Component
 *
 * UserJourneyMap 15-18단계: 영상 생성 및 재생
 * FSD pages 레이어 - 영상 생성 워크플로우 오케스트레이션
 * CLAUDE.md 준수: React 19, 접근성, 타입 안전성
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../app/store'

import { VideoGenerator, GenerationProgress, VideoPlayer, VideoControls } from '../widgets/video'
import { selectIsAuthenticated } from '../entities/auth/selectors'
import {
  videoSelectors,
  generateVideo,
  updateVideoProgress,
  type VideoGeneration,
  type VideoGenerationParams
} from '../entities/video'
import { planningSelectors } from '../entities/planning'
import { logger } from '../shared/lib/logger'

/**
 * 영상 생성 페이지 상태
 */
type VideoGeneratorPageState =
  | 'loading'           // 초기 로딩
  | 'ready'            // 생성 준비
  | 'generating'       // 생성 중
  | 'completed'        // 생성 완료
  | 'reviewing'        // 영상 검토
  | 'error'            // 오류

/**
 * 영상 생성 페이지 컴포넌트
 * UserJourneyMap 15-18단계 구현
 */
export function VideoGeneratorPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // 상태 관리
  const [pageState, setPageState] = useState<VideoGeneratorPageState>('loading')
  const [currentVideoGenerations, setCurrentVideoGenerations] = useState<VideoGeneration[]>([])
  const [generationProgress, setGenerationProgress] = useState<number>(0)
  const [currentStep, setCurrentStep] = useState<string>('')

  // Redux 상태 조회
  const isAuthenticated = useSelector((state: RootState) =>
    selectIsAuthenticated(state)
  )
  const currentPlanningProject = useSelector((state: RootState) =>
    planningSelectors.getCurrentProject(state)
  )
  const videoGenerations = useSelector((state: RootState) =>
    videoSelectors.selectVideoGenerations(state)
  )
  const videoGenerationStatus = useSelector((state: RootState) =>
    videoSelectors.selectGenerationStatus(state)
  )

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('Unauthenticated user accessing video generator page', {
        userJourneyStep: 'video-generator-unauthorized',
        redirectTo: '/login'
      })
      router.push('/login')
      return
    }

    // 기획이 완료되지 않은 경우 기획 페이지로 리다이렉트
    if (!currentPlanningProject || currentPlanningProject.completionPercentage < 100) {
      logger.warn('Incomplete planning project for video generation', {
        userJourneyStep: 'video-generator-incomplete-planning',
        planningCompletion: currentPlanningProject?.completionPercentage || 0,
        redirectTo: '/planning'
      })
      router.push('/planning')
      return
    }

    setPageState('ready')
  }, [isAuthenticated, currentPlanningProject, router])

  // UserJourneyMap 15단계: 영상 생성 시작
  const handleVideoGenerationStart = useCallback(async () => {
    if (!currentPlanningProject) return

    logger.info('Video generation started', {
      userJourneyStep: 'video-generation-started',
      planningProjectId: currentPlanningProject.metadata.id,
      shotCount: currentPlanningProject.shotSequences.length
    })

    setPageState('generating')
    setGenerationProgress(0)
    setCurrentStep('영상 생성을 준비하고 있습니다...')

    try {
      // 12숏을 기반으로 영상 생성 요청들 생성
      const videoRequests = currentPlanningProject.shotSequences.map((shot, index) => {
        const params: VideoGenerationParams = {
          prompt: shot.description,
          imageUrl: shot.contiImageUrl,
          duration: shot.duration,
          aspectRatio: '16:9'
        }

        return dispatch(generateVideo({
          scenarioId: currentPlanningProject.metadata.id,
          projectId: currentPlanningProject.metadata.projectId || '',
          userId: currentPlanningProject.metadata.userId,
          inputPrompt: shot.description,
          inputImageUrl: shot.contiImageUrl,
          inputParams: params,
          provider: 'seedance'
        }))
      })

      // 모든 생성 요청 시작
      const results = await Promise.allSettled(videoRequests)
      const successfulGenerations = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)

      setCurrentVideoGenerations(successfulGenerations)
      setCurrentStep(`${successfulGenerations.length}개 영상 생성 중...`)

      // 진행 상황 모니터링 시작
      startProgressMonitoring(successfulGenerations)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다'
      logger.error('Video generation failed', {
        userJourneyStep: 'video-generation-failed',
        error: errorMessage
      })
      setPageState('error')
    }
  }, [currentPlanningProject, dispatch])

  // UserJourneyMap 16-17단계: 진행 상황 모니터링
  const startProgressMonitoring = useCallback((generations: VideoGeneration[]) => {
    const interval = setInterval(async () => {
      try {
        let totalProgress = 0
        let completedCount = 0
        let processingCount = 0

        for (const generation of generations) {
          // 개별 영상 상태 확인 (실제 구현에서는 API 호출)
          const progress = Math.min(generationProgress + Math.random() * 5, 100)
          totalProgress += progress

          if (progress >= 100) {
            completedCount++
          } else {
            processingCount++
          }
        }

        const averageProgress = totalProgress / generations.length
        setGenerationProgress(averageProgress)

        if (completedCount === generations.length) {
          setCurrentStep('모든 영상 생성이 완료되었습니다!')
          setPageState('completed')
          clearInterval(interval)

          logger.info('All video generations completed', {
            userJourneyStep: 'video-generation-completed',
            completedCount,
            nextStep: 'video-review'
          })
        } else {
          setCurrentStep(`${processingCount}개 영상 생성 중... (${completedCount}/${generations.length} 완료)`)
        }

      } catch (error) {
        logger.error('Progress monitoring failed', { error })
        clearInterval(interval)
        setPageState('error')
      }
    }, 2000) // 2초마다 업데이트

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(interval)
  }, [generationProgress])

  // UserJourneyMap 18단계: 영상 검토 시작
  const handleVideoReview = useCallback(() => {
    logger.info('Video review started', {
      userJourneyStep: 'video-review-started',
      videoCount: currentVideoGenerations.length
    })
    setPageState('reviewing')
  }, [currentVideoGenerations.length])

  // 피드백 수집 완료 후 다음 단계로 이동
  const handleProceedToFeedback = useCallback(() => {
    logger.info('Proceeding to feedback collection', {
      userJourneyStep: 'video-to-feedback',
      videoCount: currentVideoGenerations.length,
      nextStep: 'feedback-collection'
    })
    router.push('/feedback')
  }, [currentVideoGenerations.length, router])

  // 영상 재생성 요청
  const handleRegenerateVideo = useCallback((videoId: string) => {
    logger.info('Video regeneration requested', {
      userJourneyStep: 'video-regeneration-requested',
      videoId
    })
    // 재생성 로직 구현
    setPageState('generating')
  }, [])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">영상 생성 환경을 준비 중입니다...</p>
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
              영상 생성 중 오류가 발생했습니다
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleVideoGenerationStart}
                className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={() => router.push('/planning')}
                className="w-full px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                기획으로 돌아가기
              </button>
            </div>
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
              AI 영상 생성
            </h1>

            {/* UserJourneyMap 진행 상황 */}
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <div className="w-3 h-3 rounded-full bg-success-500"></div>
              <span>6-11단계 완료</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className={`w-3 h-3 rounded-full ${
                pageState === 'completed' || pageState === 'reviewing'
                  ? 'bg-success-500'
                  : 'bg-primary-500'
              }`}></div>
              <span>15-18단계</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-300"></div>
              <span>19-22단계</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* UserJourneyMap 15단계: 영상 생성 준비 */}
        {pageState === 'ready' && currentPlanningProject && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-soft p-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-6">
                영상 생성 준비
              </h2>

              <div className="space-y-6 mb-8">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-neutral-900">프로젝트:</span>
                    <span className="ml-2 text-neutral-600">{currentPlanningProject.metadata.title}</span>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900">생성할 영상:</span>
                    <span className="ml-2 text-neutral-600">{currentPlanningProject.shotSequences.length}개</span>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900">예상 시간:</span>
                    <span className="ml-2 text-neutral-600">약 {Math.ceil(currentPlanningProject.shotSequences.length * 2)}분</span>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900">총 길이:</span>
                    <span className="ml-2 text-neutral-600">{Math.round((currentPlanningProject.totalDuration || 0) / 60)}분</span>
                  </div>
                </div>

                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="font-medium text-neutral-900 mb-3">생성될 숏 시퀀스</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentPlanningProject.shotSequences.map((shot, index) => (
                      <div key={shot.id} className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded">
                        <span className="text-sm text-neutral-700">
                          {index + 1}. {shot.title}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {shot.duration}초
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleVideoGenerationStart}
                className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                AI 영상 생성 시작 🎬
              </button>
            </div>
          </div>
        )}

        {/* UserJourneyMap 16-17단계: 영상 생성 중 */}
        {pageState === 'generating' && (
          <div className="max-w-2xl mx-auto">
            <GenerationProgress
              progress={generationProgress}
              currentStep={currentStep}
              totalSteps={currentVideoGenerations.length}
              completedSteps={Math.floor(generationProgress / 100 * currentVideoGenerations.length)}
            />
          </div>
        )}

        {/* UserJourneyMap 18단계: 영상 완료 및 검토 */}
        {pageState === 'completed' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-soft p-8">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                영상 생성 완료!
              </h2>

              <p className="text-neutral-600 mb-8">
                총 {currentVideoGenerations.length}개의 영상이 성공적으로 생성되었습니다.<br />
                이제 생성된 영상들을 확인해보세요.
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleVideoReview}
                  className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                >
                  생성된 영상 확인하기 📹
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 영상 검토 및 피드백 */}
        {pageState === 'reviewing' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                생성된 영상 검토
              </h2>
              <p className="text-neutral-600">
                각 영상을 확인하고 피드백을 남겨주세요
              </p>
            </div>

            {/* 영상 목록 */}
            <div className="grid gap-6">
              {currentVideoGenerations.map((video, index) => (
                <div key={video.id} className="bg-white rounded-lg shadow-soft p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                    영상 {index + 1}: {video.inputPrompt.substring(0, 50)}...
                  </h3>

                  {video.outputVideoUrl && (
                    <div className="space-y-4">
                      <VideoPlayer
                        src={video.outputVideoUrl}
                        poster={video.outputThumbnailUrl}
                      />

                      <VideoControls
                        videoUrl={video.outputVideoUrl}
                        onFeedbackSubmit={(feedback) => {
                          logger.info('Video feedback submitted', {
                            userJourneyStep: 'video-feedback-submitted',
                            videoId: video.id,
                            feedback
                          })
                        }}
                        onRegenerateRequest={() => handleRegenerateVideo(video.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 다음 단계로 진행 */}
            <div className="text-center pt-8">
              <button
                onClick={handleProceedToFeedback}
                className="px-8 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                피드백 수집으로 이동 →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default VideoGeneratorPage