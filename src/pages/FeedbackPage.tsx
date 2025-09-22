/**
 * Feedback Page Component
 *
 * UserJourneyMap 19-22단계: 영상 피드백 수집 및 프로젝트 완료
 * FSD pages 레이어 - 피드백 워크플로우 오케스트레이션
 * CLAUDE.md 준수: React 19, 접근성, 타입 안전성
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../app/store'

import {
  FeedbackWidgets,
  VideoFeedbackViewer,
  FeedbackDashboard,
  ShareLinkGenerator,
  type FeedbackSession
} from '../widgets/feedback'
import { selectIsAuthenticated } from '../entities/auth/selectors'
import { videoSelectors } from '../entities/video'
import { feedbackSelectors, feedbackActions } from '../entities/feedback'
import { projectSelectors, projectActions } from '../entities/project'
import { logger } from '../shared/lib/logger'

/**
 * 피드백 페이지 상태
 */
type FeedbackPageState =
  | 'loading'           // 초기 로딩
  | 'collecting'        // 피드백 수집 중
  | 'analyzing'         // 피드백 분석 중
  | 'sharing'           // 공유 및 배포
  | 'completed'         // 프로젝트 완료
  | 'error'             // 오류

/**
 * 피드백 페이지 컴포넌트
 * UserJourneyMap 19-22단계 구현
 */
export function FeedbackPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // 상태 관리
  const [pageState, setPageState] = useState<FeedbackPageState>('loading')
  const [feedbackSession, setFeedbackSession] = useState<FeedbackSession | null>(null)
  const [shareLinks, setShareLinks] = useState<string[]>([])
  const [feedbackStats, setFeedbackStats] = useState({
    totalComments: 0,
    totalReactions: 0,
    participants: 0,
    avgSentiment: 0
  })

  // Redux 상태 조회
  const isAuthenticated = useSelector((state: RootState) =>
    selectIsAuthenticated(state)
  )
  const videoGenerations = useSelector((state: RootState) =>
    videoSelectors.selectVideoGenerations(state)
  )
  const currentProject = useSelector((state: RootState) =>
    projectSelectors.getCurrentProject(state)
  )
  const feedbackSessions = useSelector((state: RootState) =>
    feedbackSelectors.selectFeedbackSessions(state)
  )

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('Unauthenticated user accessing feedback page', {
        userJourneyStep: 'feedback-unauthorized',
        redirectTo: '/login'
      })
      router.push('/login')
      return
    }

    // 영상이 생성되지 않은 경우 영상 생성 페이지로 리다이렉트
    if (!videoGenerations.length) {
      logger.warn('No videos found for feedback collection', {
        userJourneyStep: 'feedback-no-videos',
        redirectTo: '/video-generator'
      })
      router.push('/video-generator')
      return
    }

    initializeFeedbackSession()
  }, [isAuthenticated, videoGenerations, router])

  // UserJourneyMap 19단계: 피드백 세션 초기화
  const initializeFeedbackSession = useCallback(async () => {
    if (!currentProject || !videoGenerations.length) return

    try {
      logger.info('Initializing feedback session', {
        userJourneyStep: 'feedback-session-initialized',
        projectId: currentProject.metadata.id,
        videoCount: videoGenerations.length
      })

      // 피드백 세션 생성
      const newSession: FeedbackSession = {
        id: `feedback_${currentProject.metadata.id}_${Date.now()}`,
        projectId: currentProject.metadata.id,
        title: `${currentProject.metadata.title} - 피드백 세션`,
        description: '생성된 영상에 대한 피드백을 수집합니다',
        videoSlots: videoGenerations.map((video, index) => ({
          id: `slot_${video.id}`,
          order: index,
          title: `영상 ${index + 1}`,
          videoUrl: video.outputVideoUrl || '',
          thumbnailUrl: video.outputThumbnailUrl,
          duration: video.metadata.duration || 0,
          isActive: true
        })),
        participants: [],
        settings: {
          allowComments: true,
          allowReactions: true,
          allowAnonymous: false,
          requireModeration: false,
          publicAccess: false
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentProject.metadata.userId,
          status: 'active',
          totalComments: 0,
          totalReactions: 0,
          totalParticipants: 0
        }
      }

      setFeedbackSession(newSession)
      dispatch(feedbackActions.createFeedbackSession(newSession))
      setPageState('collecting')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '피드백 세션 초기화 중 오류가 발생했습니다'
      logger.error('Feedback session initialization failed', {
        userJourneyStep: 'feedback-session-init-failed',
        error: errorMessage
      })
      setPageState('error')
    }
  }, [currentProject, videoGenerations, dispatch])

  // UserJourneyMap 20단계: 피드백 수집 완료
  const handleFeedbackCollectionComplete = useCallback(() => {
    if (!feedbackSession) return

    logger.info('Feedback collection completed', {
      userJourneyStep: 'feedback-collection-completed',
      sessionId: feedbackSession.id,
      totalComments: feedbackStats.totalComments,
      totalReactions: feedbackStats.totalReactions,
      nextStep: 'feedback-analysis'
    })

    setPageState('analyzing')
  }, [feedbackSession, feedbackStats])

  // UserJourneyMap 21단계: 피드백 분석 및 공유
  const handleStartSharing = useCallback(() => {
    if (!feedbackSession) return

    logger.info('Starting feedback sharing', {
      userJourneyStep: 'feedback-sharing-started',
      sessionId: feedbackSession.id,
      nextStep: 'project-completion'
    })

    setPageState('sharing')
  }, [feedbackSession])

  // 공유 링크 생성
  const handleGenerateShareLink = useCallback((permissions: any) => {
    if (!feedbackSession) return

    const shareUrl = `${window.location.origin}/share/${feedbackSession.id}`
    const newShareLinks = [...shareLinks, shareUrl]
    setShareLinks(newShareLinks)

    logger.info('Share link generated', {
      userJourneyStep: 'share-link-generated',
      sessionId: feedbackSession.id,
      shareUrl,
      permissions
    })
  }, [feedbackSession, shareLinks])

  // UserJourneyMap 22단계: 프로젝트 완료
  const handleProjectCompletion = useCallback(async () => {
    if (!currentProject || !feedbackSession) return

    try {
      logger.info('Completing project', {
        userJourneyStep: 'project-completion-started',
        projectId: currentProject.metadata.id,
        feedbackSessionId: feedbackSession.id
      })

      // 프로젝트 상태를 완료로 업데이트
      dispatch(projectActions.updateProjectStatus({
        projectId: currentProject.metadata.id,
        status: 'completed',
        completedAt: new Date()
      }))

      setPageState('completed')

      logger.info('UserJourneyMap completed successfully', {
        userJourneyStep: 'user-journey-completed',
        projectId: currentProject.metadata.id,
        totalSteps: 22,
        finalOutcome: 'success'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '프로젝트 완료 중 오류가 발생했습니다'
      logger.error('Project completion failed', {
        userJourneyStep: 'project-completion-failed',
        error: errorMessage
      })
      setPageState('error')
    }
  }, [currentProject, feedbackSession, dispatch])

  // 피드백 통계 업데이트
  const updateFeedbackStats = useCallback((stats: typeof feedbackStats) => {
    setFeedbackStats(stats)
  }, [])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">피드백 환경을 준비 중입니다...</p>
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
              피드백 수집 중 오류가 발생했습니다
            </h2>
            <button
              onClick={() => router.push('/video-generator')}
              className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              영상 생성으로 돌아가기
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
              {pageState === 'collecting' && '영상 피드백 수집'}
              {pageState === 'analyzing' && '피드백 분석'}
              {pageState === 'sharing' && '피드백 공유'}
              {pageState === 'completed' && '프로젝트 완료'}
            </h1>

            {/* UserJourneyMap 진행 상황 */}
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <div className="w-3 h-3 rounded-full bg-success-500"></div>
              <span>15-18단계 완료</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className={`w-3 h-3 rounded-full ${
                pageState === 'completed'
                  ? 'bg-success-500'
                  : 'bg-primary-500'
              }`}></div>
              <span>19-22단계</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* UserJourneyMap 19-20단계: 피드백 수집 */}
        {pageState === 'collecting' && feedbackSession && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                영상 피드백 수집
              </h2>
              <p className="text-neutral-600">
                생성된 영상들에 대한 피드백을 수집하고 있습니다
              </p>
            </div>

            {/* 피드백 통계 */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-soft p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{feedbackStats.totalComments}</div>
                <div className="text-sm text-neutral-600">댓글</div>
              </div>
              <div className="bg-white rounded-lg shadow-soft p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{feedbackStats.totalReactions}</div>
                <div className="text-sm text-neutral-600">반응</div>
              </div>
              <div className="bg-white rounded-lg shadow-soft p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{feedbackStats.participants}</div>
                <div className="text-sm text-neutral-600">참여자</div>
              </div>
              <div className="bg-white rounded-lg shadow-soft p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{Math.round(feedbackStats.avgSentiment * 100)}%</div>
                <div className="text-sm text-neutral-600">만족도</div>
              </div>
            </div>

            {/* 피드백 뷰어 */}
            <VideoFeedbackViewer
              sessionId={feedbackSession.id}
              onStatsUpdate={updateFeedbackStats}
              onCollectionComplete={handleFeedbackCollectionComplete}
            />

            {/* 수집 완료 버튼 */}
            <div className="text-center pt-8">
              <button
                onClick={handleFeedbackCollectionComplete}
                className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                disabled={feedbackStats.totalComments === 0 && feedbackStats.totalReactions === 0}
              >
                피드백 수집 완료
              </button>
            </div>
          </div>
        )}

        {/* UserJourneyMap 21단계: 피드백 분석 */}
        {pageState === 'analyzing' && feedbackSession && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                피드백 분석 결과
              </h2>
              <p className="text-neutral-600">
                수집된 피드백을 분석한 결과입니다
              </p>
            </div>

            {/* 피드백 대시보드 */}
            <FeedbackDashboard
              sessionId={feedbackSession.id}
              showDetailed={true}
            />

            {/* 다음 단계 버튼 */}
            <div className="text-center pt-8">
              <button
                onClick={handleStartSharing}
                className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                공유 및 배포로 이동
              </button>
            </div>
          </div>
        )}

        {/* UserJourneyMap 21-22단계: 공유 및 프로젝트 완료 */}
        {pageState === 'sharing' && feedbackSession && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                피드백 공유 및 배포
              </h2>
              <p className="text-neutral-600">
                피드백 결과를 공유하고 프로젝트를 완료하세요
              </p>
            </div>

            {/* 공유 링크 생성기 */}
            <div className="bg-white rounded-lg shadow-soft p-6">
              <ShareLinkGenerator
                sessionId={feedbackSession.id}
                onLinkGenerated={handleGenerateShareLink}
              />
            </div>

            {/* 생성된 공유 링크들 */}
            {shareLinks.length > 0 && (
              <div className="bg-white rounded-lg shadow-soft p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">생성된 공유 링크</h3>
                <div className="space-y-2">
                  {shareLinks.map((link, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                      <span className="text-sm text-neutral-600 truncate">{link}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(link)}
                        className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                      >
                        복사
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 프로젝트 완료 */}
            <div className="text-center pt-8">
              <button
                onClick={handleProjectCompletion}
                className="px-8 py-4 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors font-medium"
              >
                프로젝트 완료하기 🎉
              </button>
            </div>
          </div>
        )}

        {/* UserJourneyMap 완료 */}
        {pageState === 'completed' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-soft p-8">
              <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-3xl font-bold text-neutral-900 mb-4">
                🎉 프로젝트 완료!
              </h2>

              <p className="text-lg text-neutral-600 mb-8">
                UserJourneyMap 22단계가 모두 성공적으로 완료되었습니다.<br />
                AI 영상 제작 프로젝트가 완성되었습니다.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div className="text-left">
                  <span className="font-medium text-neutral-900">생성된 영상:</span>
                  <span className="ml-2 text-neutral-600">{videoGenerations.length}개</span>
                </div>
                <div className="text-left">
                  <span className="font-medium text-neutral-900">수집된 피드백:</span>
                  <span className="ml-2 text-neutral-600">{feedbackStats.totalComments + feedbackStats.totalReactions}개</span>
                </div>
                <div className="text-left">
                  <span className="font-medium text-neutral-900">참여자:</span>
                  <span className="ml-2 text-neutral-600">{feedbackStats.participants}명</span>
                </div>
                <div className="text-left">
                  <span className="font-medium text-neutral-900">평균 만족도:</span>
                  <span className="ml-2 text-neutral-600">{Math.round(feedbackStats.avgSentiment * 100)}%</span>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push('/planning')}
                  className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  새 프로젝트 시작
                </button>
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  관리자 대시보드
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default FeedbackPage