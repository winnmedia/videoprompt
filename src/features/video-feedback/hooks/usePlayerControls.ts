/**
 * Player Controls Hook - Phase 3.9
 *
 * CLAUDE.md 준수: features 레이어 비즈니스 로직
 * 플레이어 하부 툴바 액션 (Replace/Share/Snapshot/Feedback@TC) 통합 관리
 */

import { useCallback, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectCurrentTimecode,
  selectActiveVideo,
  type VideoSlot,
  type Timecode,
  type ScreenshotRequest,
  type ScreenshotResult
} from '../../../entities/feedback'
import { useVersionManager } from './useVersionManager'
import { useAdvancedSharing } from './useAdvancedSharing'
import { useTimecodeFeedback } from './useTimecodeFeedback'
import { secondsToTimecode } from '../../../shared/lib/timecode-utils'

/**
 * 스크린샷 옵션
 */
export interface ScreenshotOptions {
  readonly quality: number // 1-100
  readonly format: 'jpg' | 'png' | 'webp'
  readonly includeTimestamp: boolean
  readonly includeProjectInfo: boolean
  readonly autoDownload: boolean
}

/**
 * 영상 교체 옵션
 */
export interface VideoReplaceOptions {
  readonly replaceReason?: string
  readonly autoActivate: boolean
  readonly notifyParticipants: boolean
  readonly backupPrevious: boolean
}

/**
 * 플레이어 컨트롤 액션 결과
 */
export interface PlayerControlsReturn {
  // 현재 상태
  readonly isProcessing: boolean
  readonly lastAction: string | null
  readonly error: string | null

  // 영상 교체 (Replace)
  readonly replaceVideo: (
    file: File,
    options?: Partial<VideoReplaceOptions>
  ) => Promise<void>
  readonly selectFromVersions: () => Promise<void>

  // 영상 공유 (Share)
  readonly openShareModal: () => void
  readonly quickShare: (accessLevel?: 'view' | 'comment') => Promise<string>
  readonly copyShareLink: (tokenId?: string) => Promise<void>

  // 스크린샷 (Snapshot)
  readonly captureScreenshot: (
    options?: Partial<ScreenshotOptions>
  ) => Promise<ScreenshotResult>
  readonly downloadScreenshot: (screenshotId: string) => Promise<void>

  // 현재 시점 피드백 (Feedback @TC)
  readonly startFeedbackAtCurrentTime: () => void
  readonly quickReaction: (type: 'like' | 'dislike' | 'confused') => Promise<void>

  // 키보드 단축키
  readonly registerShortcuts: () => () => void
  readonly unregisterShortcuts: () => void

  // 유틸리티
  readonly getCurrentTimecodeString: () => string
  readonly getProjectSlug: () => string
  readonly formatFilename: (
    type: 'screenshot' | 'video',
    extension: string
  ) => string
}

/**
 * 플레이어 컨트롤 훅
 */
export function usePlayerControls(): PlayerControlsReturn {
  // 의존성 훅들
  const versionManager = useVersionManager()
  const sharingManager = useAdvancedSharing()
  const timecodeFeedback = useTimecodeFeedback()

  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const currentTimecode = useSelector(selectCurrentTimecode)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 파일 입력 참조
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 프로젝트 슬러그 조회
   */
  const getProjectSlug = useCallback((): string => {
    if (!currentSession) return 'unknown-project'

    // 세션에서 프로젝트 슬러그 추출 (URL이나 이름에서)
    const slug = currentSession.metadata?.projectSlug ||
                 currentSession.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                 'project'
    return slug
  }, [currentSession])

  /**
   * 현재 타임코드 문자열 조회
   */
  const getCurrentTimecodeString = useCallback((): string => {
    const timecode = secondsToTimecode(currentTimecode)
    return timecode.formatted.replace(/:/g, '')
  }, [currentTimecode])

  /**
   * 파일명 포맷팅
   */
  const formatFilename = useCallback((
    type: 'screenshot' | 'video',
    extension: string
  ): string => {
    const projectSlug = getProjectSlug()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)

    if (type === 'screenshot') {
      const timecodeStr = getCurrentTimecodeString()
      // project-{slug}_TC{mmssfff}_{YYYY-MM-DD}T{HHmmss}.jpg
      return `${projectSlug}_TC${timecodeStr}_${timestamp}.${extension}`
    } else {
      // video-{slug}_{version}_{timestamp}.{extension}
      const version = selectedVideoSlot || 'v1'
      return `${projectSlug}_${version}_${timestamp}.${extension}`
    }
  }, [getProjectSlug, getCurrentTimecodeString, selectedVideoSlot])

  /**
   * 영상 교체
   */
  const replaceVideo = useCallback(async (
    file: File,
    options: Partial<VideoReplaceOptions> = {}
  ): Promise<void> => {
    if (!currentSession || !activeVideo) {
      throw new Error('세션 또는 활성 영상이 없습니다')
    }

    const opts: VideoReplaceOptions = {
      autoActivate: true,
      notifyParticipants: true,
      backupPrevious: true,
      ...options
    }

    setIsProcessing(true)
    setLastAction('replace')
    setError(null)

    try {
      // 파일 검증
      const validation = versionManager.validateFile(file)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // 새 버전으로 업로드
      await versionManager.uploadVersion(selectedVideoSlot, file, {
        replaceReason: opts.replaceReason || '영상 교체',
        autoActivate: opts.autoActivate,
        notifyParticipants: opts.notifyParticipants
      })

      // 성공 알림
      // TODO: 토스트 알림 구현

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '영상 교체에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [currentSession, activeVideo, selectedVideoSlot, versionManager])

  /**
   * 버전에서 선택
   */
  const selectFromVersions = useCallback(async (): Promise<void> => {
    // 버전 선택 모달 열기
    // TODO: 모달 구현 및 버전 목록 표시
    console.log('버전 선택 모달 열기')
  }, [])

  /**
   * 공유 모달 열기
   */
  const openShareModal = useCallback(() => {
    // 고급 공유 모달 열기
    // TODO: 모달 구현
    console.log('공유 모달 열기')
  }, [])

  /**
   * 빠른 공유
   */
  const quickShare = useCallback(async (
    accessLevel: 'view' | 'comment' = 'view'
  ): Promise<string> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    setIsProcessing(true)
    setLastAction('quick-share')
    setError(null)

    try {
      const shareLink = await sharingManager.createShareLink({
        accessLevel,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후 만료
        enableQrCode: false,
        notifyOnAccess: false,
        description: `빠른 공유 - ${accessLevel}`
      })

      return shareLink.shortUrl || shareLink.fullUrl

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '빠른 공유에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [currentSession, sharingManager])

  /**
   * 공유 링크 복사
   */
  const copyShareLink = useCallback(async (tokenId?: string): Promise<void> => {
    try {
      let urlToCopy: string

      if (tokenId) {
        urlToCopy = sharingManager.getShareableUrl(tokenId)
      } else {
        urlToCopy = await quickShare('view')
      }

      if (!urlToCopy) {
        throw new Error('복사할 링크가 없습니다')
      }

      await navigator.clipboard.writeText(urlToCopy)

      // 성공 알림
      // TODO: 토스트 알림 구현

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '링크 복사에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [sharingManager, quickShare])

  /**
   * 스크린샷 캡처
   */
  const captureScreenshot = useCallback(async (
    options: Partial<ScreenshotOptions> = {}
  ): Promise<ScreenshotResult> => {
    if (!currentSession || !activeVideo) {
      throw new Error('세션 또는 활성 영상이 없습니다')
    }

    const opts: ScreenshotOptions = {
      quality: 90,
      format: 'jpg',
      includeTimestamp: true,
      includeProjectInfo: true,
      autoDownload: true,
      ...options
    }

    setIsProcessing(true)
    setLastAction('screenshot')
    setError(null)

    try {
      const screenshotRequest: ScreenshotRequest = {
        sessionId: currentSession.id,
        videoSlot: selectedVideoSlot,
        versionId: activeVideo.id,
        timecode: secondsToTimecode(currentTimecode),
        format: opts.format,
        quality: opts.quality,
        includeTimestamp: opts.includeTimestamp,
        includeProjectInfo: opts.includeProjectInfo
      }

      const response = await fetch('/api/feedback/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(screenshotRequest)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '스크린샷 캡처에 실패했습니다')
      }

      const screenshotResult: ScreenshotResult = await response.json()

      // 자동 다운로드
      if (opts.autoDownload) {
        await downloadScreenshot(screenshotResult.id)
      }

      return screenshotResult

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '스크린샷 캡처에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [currentSession, activeVideo, selectedVideoSlot, currentTimecode])

  /**
   * 스크린샷 다운로드
   */
  const downloadScreenshot = useCallback(async (screenshotId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/feedback/screenshot/${screenshotId}/download`)

      if (!response.ok) {
        throw new Error('스크린샷 다운로드에 실패했습니다')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // 임시 링크 생성 및 다운로드
      const a = document.createElement('a')
      a.href = url
      a.download = formatFilename('screenshot', 'jpg')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '스크린샷 다운로드에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [formatFilename])

  /**
   * 현재 시점에서 피드백 시작
   */
  const startFeedbackAtCurrentTime = useCallback(() => {
    setLastAction('feedback-at-tc')
    timecodeFeedback.startComment()
  }, [timecodeFeedback])

  /**
   * 빠른 감정 반응
   */
  const quickReaction = useCallback(async (
    type: 'like' | 'dislike' | 'confused'
  ): Promise<void> => {
    setIsProcessing(true)
    setLastAction(`quick-reaction-${type}`)
    setError(null)

    try {
      await timecodeFeedback.addTimecodeReaction(type)

      // 성공 피드백
      // TODO: 시각적 피드백 구현

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '감정 반응 추가에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [timecodeFeedback])

  /**
   * 키보드 단축키 등록
   */
  const registerShortcuts = useCallback((): (() => void) => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + R: 영상 교체
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault()
        fileInputRef.current?.click()
      }

      // Ctrl/Cmd + S: 빠른 공유
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        quickShare('view').catch(console.error)
      }

      // Ctrl/Cmd + Shift + S: 스크린샷
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
        event.preventDefault()
        captureScreenshot().catch(console.error)
      }

      // T: 현재 시점 피드백
      if (event.key === 't' || event.key === 'T') {
        const target = event.target as HTMLElement

        // 입력 필드가 아닌 경우에만 실행
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          event.preventDefault()
          startFeedbackAtCurrentTime()
        }
      }

      // 숫자 키 1-3: 감정 반응
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement

        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          if (event.key === '1') {
            event.preventDefault()
            quickReaction('like').catch(console.error)
          } else if (event.key === '2') {
            event.preventDefault()
            quickReaction('dislike').catch(console.error)
          } else if (event.key === '3') {
            event.preventDefault()
            quickReaction('confused').catch(console.error)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [quickShare, captureScreenshot, startFeedbackAtCurrentTime, quickReaction])

  /**
   * 키보드 단축키 해제
   */
  const unregisterShortcuts = useCallback(() => {
    // registerShortcuts에서 반환된 cleanup 함수를 사용
  }, [])

  return {
    // 현재 상태
    isProcessing,
    lastAction,
    error,

    // 영상 교체 (Replace)
    replaceVideo,
    selectFromVersions,

    // 영상 공유 (Share)
    openShareModal,
    quickShare,
    copyShareLink,

    // 스크린샷 (Snapshot)
    captureScreenshot,
    downloadScreenshot,

    // 현재 시점 피드백 (Feedback @TC)
    startFeedbackAtCurrentTime,
    quickReaction,

    // 키보드 단축키
    registerShortcuts,
    unregisterShortcuts,

    // 유틸리티
    getCurrentTimecodeString,
    getProjectSlug,
    formatFilename
  }
}