/**
 * VideoActionBar Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * 스크린샷 캡처, 영상 교체/삭제, URL 복사, 다운로드 등의 액션을 제공
 */

import React, { useState, useCallback, useRef, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectCurrentTimecode,
  selectActiveVideo,
  updateVideoSlot
} from '../../entities/feedback'
import type { VideoSlot, UploadVideoRequest } from '../../entities/feedback'

/**
 * 액션 버튼 구성
 */
interface ActionButton {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly color: string
  readonly disabled?: boolean
  readonly tooltip?: string
}

/**
 * VideoActionBar Props
 */
interface VideoActionBarProps {
  /** 액션 바 위치 */
  readonly position?: 'top' | 'bottom' | 'floating'

  /** 간소화된 UI (필수 액션만) */
  readonly compact?: boolean

  /** 비활성화할 액션들 */
  readonly disabledActions?: string[]

  /** 추가 커스텀 액션들 */
  readonly customActions?: ActionButton[]

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 스크린샷 캡처 완료 콜백 */
  readonly onScreenshotCapture?: (imageData: string, timecode: number) => void

  /** 영상 업로드 완료 콜백 */
  readonly onVideoUpload?: (videoData: File, slot: VideoSlot) => void

  /** 영상 삭제 완료 콜백 */
  readonly onVideoDelete?: (slot: VideoSlot) => void

  /** URL 복사 완료 콜백 */
  readonly onUrlCopy?: (url: string) => void

  /** 다운로드 시작 콜백 */
  readonly onDownloadStart?: (url: string, filename: string) => void

  /** 오류 콜백 */
  readonly onError?: (error: string) => void
}

/**
 * VideoActionBar 컴포넌트
 */
export function VideoActionBar(props: VideoActionBarProps) {
  const {
    position = 'bottom',
    compact = false,
    disabledActions = [],
    customActions = [],
    className = '',
    'aria-label': ariaLabel = '영상 액션 바',
    onScreenshotCapture,
    onVideoUpload,
    onVideoDelete,
    onUrlCopy,
    onDownloadStart,
    onError
  } = props

  // Redux 상태
  const dispatch = useDispatch()
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const currentTimecode = useSelector(selectCurrentTimecode)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [isCapturing, setIsCapturing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  // 현재 비디오 URL
  const videoUrl = useMemo(() => {
    if (!activeVideo) return null
    return `/api/videos/${activeVideo.id}/stream`
  }, [activeVideo])

  // 공유 URL
  const shareUrl = useMemo(() => {
    if (!currentSession) return null
    return `${window.location.origin}/feedback/share/${currentSession.metadata.shareToken}`
  }, [currentSession])

  // 기본 액션 버튼들
  const defaultActions = useMemo((): ActionButton[] => {
    const actions: ActionButton[] = [
      {
        id: 'screenshot',
        label: '스크린샷',
        icon: '📸',
        color: 'bg-blue-600 hover:bg-blue-700',
        disabled: !activeVideo || isCapturing,
        tooltip: '현재 시점의 스크린샷을 캡처합니다'
      },
      {
        id: 'upload',
        label: '영상 교체',
        icon: '📁',
        color: 'bg-green-600 hover:bg-green-700',
        disabled: isUploading,
        tooltip: '새로운 영상을 업로드합니다'
      },
      {
        id: 'delete',
        label: '영상 삭제',
        icon: '🗑️',
        color: 'bg-red-600 hover:bg-red-700',
        disabled: !activeVideo || isDeleting,
        tooltip: '현재 영상을 삭제합니다'
      },
      {
        id: 'copy-url',
        label: 'URL 복사',
        icon: copySuccess ? '✅' : '🔗',
        color: copySuccess ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700',
        disabled: !shareUrl,
        tooltip: '공유 링크를 클립보드에 복사합니다'
      },
      {
        id: 'download',
        label: '다운로드',
        icon: '⬇️',
        color: 'bg-yellow-600 hover:bg-yellow-700',
        disabled: !activeVideo,
        tooltip: '영상을 다운로드합니다'
      }
    ]

    // compact 모드에서는 필수 액션만 표시
    if (compact) {
      return actions.filter(action => ['screenshot', 'copy-url', 'download'].includes(action.id))
    }

    return actions
  }, [activeVideo, isCapturing, isUploading, isDeleting, shareUrl, copySuccess, compact])

  // 비활성화된 액션 필터링
  const availableActions = useMemo(() => {
    return [...defaultActions, ...customActions].filter(action =>
      !disabledActions.includes(action.id)
    )
  }, [defaultActions, customActions, disabledActions])

  // 스크린샷 캡처
  const captureScreenshot = useCallback(async () => {
    if (!activeVideo || !videoElementRef.current) {
      onError?.('비디오를 찾을 수 없습니다')
      return
    }

    setIsCapturing(true)

    try {
      const video = videoElementRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Canvas context를 생성할 수 없습니다')
      }

      // 캔버스 크기를 비디오 크기에 맞춤
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // 현재 프레임을 캔버스에 그리기
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // 이미지 데이터 추출
      const imageData = canvas.toDataURL('image/png')

      onScreenshotCapture?.(imageData, currentTimecode)

      // 자동 다운로드
      const link = document.createElement('a')
      link.download = `screenshot-${formatTimecode(currentTimecode)}.png`
      link.href = imageData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스크린샷 캡처에 실패했습니다'
      onError?.(errorMessage)
    } finally {
      setIsCapturing(false)
    }
  }, [activeVideo, currentTimecode, onScreenshotCapture, onError])

  // 영상 업로드
  const handleVideoUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentSession) return

    // 파일 유효성 검증
    const maxSize = 300 * 1024 * 1024 // 300MB
    const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi']

    if (file.size > maxSize) {
      onError?.('파일 크기가 300MB를 초과합니다')
      return
    }

    if (!allowedTypes.includes(file.type)) {
      onError?.('지원하지 않는 파일 형식입니다')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sessionId', currentSession.metadata.id)
      formData.append('slot', selectedVideoSlot)
      formData.append('replaceExisting', 'true')

      const response = await fetch('/api/feedback/videos/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('업로드에 실패했습니다')
      }

      const videoData = await response.json()

      // Redux 상태 업데이트
      dispatch(updateVideoSlot({
        slot: selectedVideoSlot,
        video: videoData,
        isActive: true
      }))

      onVideoUpload?.(file, selectedVideoSlot)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '영상 업로드에 실패했습니다'
      onError?.(errorMessage)
    } finally {
      setIsUploading(false)
      // input 값 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [currentSession, selectedVideoSlot, dispatch, onVideoUpload, onError])

  // 영상 삭제
  const handleVideoDelete = useCallback(async () => {
    if (!activeVideo || !currentSession) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/feedback/videos/${activeVideo.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다')
      }

      // Redux 상태 업데이트
      dispatch(updateVideoSlot({
        slot: selectedVideoSlot,
        video: undefined,
        isActive: false
      }))

      onVideoDelete?.(selectedVideoSlot)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '영상 삭제에 실패했습니다'
      onError?.(errorMessage)
    } finally {
      setIsDeleting(false)
      setShowConfirmDelete(false)
    }
  }, [activeVideo, currentSession, selectedVideoSlot, dispatch, onVideoDelete, onError])

  // URL 복사
  const copyUrl = useCallback(async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopySuccess(true)
      onUrlCopy?.(shareUrl)

      // 3초 후 상태 초기화
      setTimeout(() => setCopySuccess(false), 3000)
    } catch (error) {
      onError?.('URL 복사에 실패했습니다')
    }
  }, [shareUrl, onUrlCopy, onError])

  // 영상 다운로드
  const downloadVideo = useCallback(() => {
    if (!activeVideo || !videoUrl) return

    const filename = activeVideo.originalName || `video-${selectedVideoSlot}.mp4`
    onDownloadStart?.(videoUrl, filename)

    // 다운로드 링크 생성
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [activeVideo, videoUrl, selectedVideoSlot, onDownloadStart])

  // 액션 실행
  const handleAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'screenshot':
        captureScreenshot()
        break
      case 'upload':
        handleVideoUpload()
        break
      case 'delete':
        setShowConfirmDelete(true)
        break
      case 'copy-url':
        copyUrl()
        break
      case 'download':
        downloadVideo()
        break
      default:
        // 커스텀 액션은 onError로 알림
        onError?.(`알 수 없는 액션: ${actionId}`)
    }
  }, [captureScreenshot, handleVideoUpload, copyUrl, downloadVideo, onError])

  // 타임코드 포맷팅
  const formatTimecode = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}-${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

  // 비디오 엘리먼트 참조 설정
  const setVideoRef = useCallback((video: HTMLVideoElement | null) => {
    videoElementRef.current = video
  }, [])

  // 포지션에 따른 클래스 설정
  const positionClasses = useMemo(() => {
    switch (position) {
      case 'top':
        return 'justify-center'
      case 'floating':
        return 'absolute top-4 right-4 z-20 bg-black bg-opacity-50 rounded-lg'
      default: // bottom
        return 'justify-center'
    }
  }, [position])

  if (!currentSession) {
    return null
  }

  return (
    <>
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="video-file-input"
      />

      {/* 액션 바 */}
      <div
        className={`flex items-center space-x-2 ${positionClasses} ${className}`}
        aria-label={ariaLabel}
        data-testid="video-action-bar"
      >
        {availableActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action.id)}
            disabled={action.disabled}
            className={`flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${action.color}`}
            title={action.tooltip}
            data-testid={`action-${action.id}`}
          >
            <span>{action.icon}</span>
            {!compact && <span>{action.label}</span>}
          </button>
        ))}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">영상 삭제 확인</h3>
            <p className="text-gray-600 mb-6">
              정말로 이 영상을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                data-testid="cancel-delete"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleVideoDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                data-testid="confirm-delete"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비디오 참조를 위한 숨겨진 요소 (실제 비디오는 VideoFeedbackViewer에서 관리) */}
      {videoUrl && (
        <video
          ref={setVideoRef}
          src={videoUrl}
          className="hidden"
          preload="metadata"
          data-testid="hidden-video-ref"
        />
      )}
    </>
  )
}