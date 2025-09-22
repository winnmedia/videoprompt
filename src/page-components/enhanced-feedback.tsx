/**
 * Enhanced Feedback Page Component - Phase 3.9
 *
 * CLAUDE.md 준수: FSD pages 레이어 컴포넌트
 * FRD.md 명세: 플레이어 컨트롤, 버전 관리, 댓글 시스템, 공유 기능 통합
 * 영상 피드백 수집 UI/UX 구현 - 향상된 기능들 포함
 */

import type { Metadata } from 'next'
import { useState, useCallback, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card } from '../shared/ui'

// Enhanced Widgets (Phase 3.9 새 컴포넌트들)
import { VideoPlayerControls } from '../widgets/feedback/VideoPlayerControls'
import { EnhancedVersionSwitcher } from '../widgets/feedback/EnhancedVersionSwitcher'
import { ImprovedCommentThread } from '../widgets/feedback/ImprovedCommentThread'
import { EnhancedShareModal } from '../widgets/feedback/EnhancedShareModal'

// 기존 위젯들
import { VideoFeedbackViewer } from '../widgets/feedback/VideoFeedbackViewer'
import { FeedbackTimeline } from '../widgets/feedback/FeedbackTimeline'

export const metadata: Metadata = {
  title: '영상 피드백 시스템',
  description: '영상 리뷰 및 협업 피드백 플랫폼 - VideoPlanet',
}

/**
 * 로딩 스켈레톤 컴포넌트
 */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 스켈레톤 */}
        <div className="mb-8">
          <div className="h-8 bg-gray-800 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-800 rounded w-96"></div>
        </div>

        {/* 메인 콘텐츠 스켈레톤 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* 비디오 영역 */}
          <div className="xl:col-span-2 space-y-6">
            <div className="aspect-video bg-gray-800 rounded-lg"></div>
            <div className="h-16 bg-gray-800 rounded-lg"></div>
            <div className="h-32 bg-gray-800 rounded-lg"></div>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            <div className="h-64 bg-gray-800 rounded-lg"></div>
            <div className="h-48 bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 에러 바운더리 컴포넌트
 */
interface ErrorBoundaryProps {
  readonly children: React.ReactNode
  readonly fallback?: React.ReactNode
}

function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <div>
      {fallback || (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-400 mb-4">페이지를 새로고침해주세요.</p>
            <Button onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * 키보드 단축키 도움말 컴포넌트
 */
function KeyboardShortcutsHelp({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  if (!isVisible) return null

  const shortcuts = [
    { key: 'T', description: '현재 타임코드에서 피드백 작성' },
    { key: 'Ctrl+R', description: '영상 교체' },
    { key: 'Ctrl+S', description: '영상 공유' },
    { key: 'Ctrl+Shift+S', description: '스크린샷 캡처' },
    { key: '1/2/3', description: '버전 전환' },
    { key: 'Space', description: '재생/일시정지' },
    { key: '←/→', description: '10초 앞뒤 이동' },
    { key: 'Ctrl+Enter', description: '댓글 작성 완료' },
    { key: 'Esc', description: '모달 닫기' },
    { key: 'H', description: '단축키 도움말 (현재 창)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">키보드 단축키</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {shortcuts.map(({ key, description }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-300">{description}</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm font-mono text-gray-300">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 향상된 피드백 페이지 메인 컴포넌트
 */
function EnhancedFeedbackPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 파라미터에서 비디오 정보 추출
  const videoId = searchParams.get('video') || 'demo-video-1'
  const version = searchParams.get('version') || 'v3'
  const timecode = searchParams.get('t') || undefined

  // 컴포넌트 상태
  const [currentTimecode, setCurrentTimecode] = useState<string | undefined>(timecode)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'timeline' | 'versions'>('comments')

  // 비디오 메타데이터 (실제로는 API에서 가져옴)
  const videoMetadata = {
    id: videoId,
    title: '프로젝트 인트로 영상',
    description: '새로운 제품 소개를 위한 인트로 영상입니다.',
    duration: '2:35',
    uploadedAt: '2024-01-17T09:15:00Z',
    uploader: {
      name: 'Mike Johnson',
      email: 'mike@example.com'
    },
    currentVersion: version,
    versions: ['v1', 'v2', 'v3'],
    project: {
      slug: 'intro-video-2024',
      name: '2024 제품 인트로'
    }
  }

  // 전역 키보드 단축키 핸들러
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 단축키 비활성화
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            setShowKeyboardHelp(true)
          }
          break
        case 'escape':
          if (isShareModalOpen) {
            setIsShareModalOpen(false)
          } else if (showKeyboardHelp) {
            setShowKeyboardHelp(false)
          }
          break
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setIsShareModalOpen(true)
          }
          break
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isShareModalOpen, showKeyboardHelp])

  // 타임코드 업데이트 핸들러
  const handleTimecodeChange = useCallback((timecode: string) => {
    setCurrentTimecode(timecode)
    // URL 업데이트 (선택사항)
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('t', timecode)
    router.replace(`?${newSearchParams.toString()}`, { scroll: false })
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 헤더 */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* 좌측: 네비게이션 */}
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <nav className="text-sm text-gray-400">
                <Link href="/projects" className="hover:text-white transition-colors">
                  프로젝트
                </Link>
                <span className="mx-2">/</span>
                <Link href={`/projects/${videoMetadata.project.slug}`} className="hover:text-white transition-colors">
                  {videoMetadata.project.name}
                </Link>
                <span className="mx-2">/</span>
                <span className="text-white font-medium">피드백</span>
              </nav>
            </div>

            {/* 우측: 액션 버튼들 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="키보드 단축키 (H)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 text-gray-400 hover:text-white transition-colors xl:hidden"
                title="사이드바 토글"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Button
                onClick={() => setIsShareModalOpen(true)}
                variant="outline"
                className="hidden sm:flex"
              >
                공유하기
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid gap-8 transition-all duration-300 ${
          sidebarCollapsed
            ? 'grid-cols-1'
            : 'grid-cols-1 xl:grid-cols-3'
        }`}>
          {/* 비디오 섹션 */}
          <div className={sidebarCollapsed ? 'col-span-1' : 'xl:col-span-2'}>
            <div className="space-y-6">
              {/* 비디오 정보 */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white">
                  {videoMetadata.title}
                </h1>
                <p className="text-gray-400">
                  {videoMetadata.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>업로더: {videoMetadata.uploader.name}</span>
                  <span>•</span>
                  <span>길이: {videoMetadata.duration}</span>
                  <span>•</span>
                  <span>현재 버전: {videoMetadata.currentVersion.toUpperCase()}</span>
                  {currentTimecode && (
                    <>
                      <span>•</span>
                      <span>타임코드: {currentTimecode}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 비디오 플레이어 */}
              <Card className="overflow-hidden">
                <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                  {/* 실제 비디오 플레이어가 여기에 들어감 */}
                  <div className="text-white text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4m0-4h6m-6 4v4m0-4h6m-6 4h6" />
                      </svg>
                    </div>
                    <div className="text-lg font-medium">비디오 플레이어</div>
                    <div className="text-sm text-gray-400">
                      {videoMetadata.title} - {videoMetadata.currentVersion.toUpperCase()}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 플레이어 컨트롤 */}
              <ErrorBoundary>
                <VideoPlayerControls />
              </ErrorBoundary>

              {/* 버전 관리 */}
              <ErrorBoundary>
                <Card className="p-6">
                  <EnhancedVersionSwitcher />
                </Card>
              </ErrorBoundary>
            </div>
          </div>

          {/* 사이드바 */}
          <div className={`space-y-6 ${sidebarCollapsed ? 'hidden xl:block' : ''}`}>
            {/* 탭 네비게이션 */}
            <div className="flex bg-gray-900 rounded-lg p-1">
              {[
                { key: 'comments', label: '댓글', icon: '💬' },
                { key: 'timeline', label: '타임라인', icon: '📊' },
                { key: 'versions', label: '버전', icon: '🔄' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                    ${activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <Card className="p-6 min-h-[500px]">
              <ErrorBoundary>
                {activeTab === 'comments' && (
                  <ImprovedCommentThread
                    versionId={videoMetadata.currentVersion}
                    currentTimecode={currentTimecode}
                  />
                )}

                {activeTab === 'timeline' && (
                  <FeedbackTimeline
                    versionId={videoMetadata.currentVersion}
                    onTimecodeSelect={handleTimecodeChange}
                  />
                )}

                {activeTab === 'versions' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">버전 히스토리</h3>
                    <div className="space-y-3">
                      {videoMetadata.versions.reverse().map((v, index) => (
                        <div
                          key={v}
                          className={`p-3 rounded-lg border transition-colors ${
                            v === videoMetadata.currentVersion
                              ? 'bg-blue-600/20 border-blue-500/30'
                              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-white">{v.toUpperCase()}</div>
                              <div className="text-sm text-gray-400">
                                {index === 0 ? '최신 버전' : `${index + 1}일 전`}
                              </div>
                            </div>
                            {v === videoMetadata.currentVersion && (
                              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                현재
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </Card>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      <ErrorBoundary>
        <EnhancedShareModal
          open={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      </ErrorBoundary>

      <KeyboardShortcutsHelp
        isVisible={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      {/* 실시간 상태 표시 (개발 중) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
          <div className="text-gray-400 font-medium mb-2">개발 모드</div>
          <div className="space-y-1 text-gray-500">
            <div>비디오: {videoId}</div>
            <div>버전: {version}</div>
            <div>타임코드: {currentTimecode || 'N/A'}</div>
            <div>탭: {activeTab}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 향상된 피드백 페이지 컴포넌트 (Suspense 래퍼)
 */
export function EnhancedFeedbackPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSkeleton />}>
        <EnhancedFeedbackPageContent />
      </Suspense>
    </ErrorBoundary>
  )
}