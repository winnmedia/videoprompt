/**
 * VideoFeedbackViewer Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * 영상 플레이어와 타임코드 기반 피드백 UI를 통합한 메인 뷰어
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectCurrentTimecode,
  selectIsPlaying,
  selectActiveVideo,
  setCurrentTimecode,
  setPlayingState,
  setSelectedVideoSlot
} from '../../entities/feedback'
import { useTimecodeFeedback } from '../../features/video-feedback/hooks/useTimecodeFeedback'
import { useFeedbackRealtime } from '../../shared/hooks/useFeedbackRealtime'
import type { VideoSlot } from '../../entities/feedback'

/**
 * VideoFeedbackViewer Props
 */
interface VideoFeedbackViewerProps {
  /** 세션 ID */
  readonly sessionId: string

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 커스텀 비디오 컨트롤 비활성화 */
  readonly hideControls?: boolean

  /** 자동 재생 */
  readonly autoPlay?: boolean

  /** 음소거 상태 */
  readonly muted?: boolean

  /** 피드백 오버레이 표시 */
  readonly showFeedbackOverlay?: boolean

  /** 타임라인 표시 */
  readonly showTimeline?: boolean

  /** 실시간 업데이트 활성화 */
  readonly enableRealtime?: boolean

  /** 비디오 변경 콜백 */
  readonly onVideoChange?: (slot: VideoSlot) => void

  /** 타임코드 변경 콜백 */
  readonly onTimecodeChange?: (seconds: number) => void

  /** 오류 콜백 */
  readonly onError?: (error: string) => void
}

/**
 * VideoFeedbackViewer 컴포넌트
 */
export function VideoFeedbackViewer(props: VideoFeedbackViewerProps) {
  const {
    sessionId,
    className = '',
    'aria-label': ariaLabel = '영상 피드백 뷰어',
    hideControls = false,
    autoPlay = false,
    muted = false,
    showFeedbackOverlay = true,
    showTimeline = true,
    enableRealtime = true,
    onVideoChange,
    onTimecodeChange,
    onError
  } = props

  // Redux 상태
  const dispatch = useDispatch()
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const currentTimecode = useSelector(selectCurrentTimecode)
  const isPlaying = useSelector(selectIsPlaying)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [volume, setVolume] = useState(1.0)
  const [playbackRate, setPlaybackRate] = useState(1.0)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 훅
  const timecodeFeedback = useTimecodeFeedback({
    autoSeekToComments: true,
    highlightActiveComments: true,
    snapToNearestComment: false,
    snapThreshold: 1.0
  })

  const realtime = useFeedbackRealtime({
    projectId: sessionId,
    videoSlotId: selectedVideoSlot,
    enablePresence: enableRealtime,
    enableActivityLog: true,
    onFeedbackEvent: (event) => {
      // 실시간 피드백 이벤트 처리
      console.log('Realtime feedback event:', event)
    },
    onConnectionStateChange: (connected) => {
      if (!connected) {
        onError?.('실시간 연결이 끊어졌습니다')
      }
    }
  })

  // 비디오 슬롯 목록
  const availableSlots = useMemo(() => {
    if (!currentSession) return []
    return currentSession.videoSlots.filter(slot => slot.video && slot.isActive)
  }, [currentSession])

  // 현재 비디오 URL
  const currentVideoUrl = useMemo(() => {
    if (!activeVideo) return null
    return `/api/videos/${activeVideo.id}/stream` // 스트리밍 엔드포인트
  }, [activeVideo])

  /**
   * 비디오 로드 처리
   */
  const handleVideoLoad = useCallback(() => {
    setIsLoading(false)
    setLoadError(null)

    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.playbackRate = playbackRate
      videoRef.current.muted = muted
    }
  }, [volume, playbackRate, muted])

  /**
   * 비디오 로드 오류 처리
   */
  const handleVideoError = useCallback(() => {
    const error = '비디오를 로드할 수 없습니다'
    setLoadError(error)
    setIsLoading(false)
    onError?.(error)
  }, [onError])

  /**
   * 타임코드 업데이트 처리
   */
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return

    const currentTime = videoRef.current.currentTime
    dispatch(setCurrentTimecode(currentTime))
    onTimecodeChange?.(currentTime)
  }, [dispatch, onTimecodeChange])

  /**
   * 재생 상태 변경 처리
   */
  const handlePlayStateChange = useCallback(() => {
    if (!videoRef.current) return

    const playing = !videoRef.current.paused
    dispatch(setPlayingState(playing))
  }, [dispatch])

  /**
   * 비디오 슬롯 변경
   */
  const handleSlotChange = useCallback((slot: VideoSlot) => {
    dispatch(setSelectedVideoSlot(slot))
    onVideoChange?.(slot)
    setIsLoading(true)
    setLoadError(null)
  }, [dispatch, onVideoChange])

  /**
   * 키보드 단축키 처리
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!videoRef.current) return

    const video = videoRef.current

    switch (event.code) {
      case 'Space':
        event.preventDefault()
        if (video.paused) {
          video.play()
        } else {
          video.pause()
        }
        break

      case 'ArrowLeft':
        event.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - 5)
        break

      case 'ArrowRight':
        event.preventDefault()
        video.currentTime = Math.min(video.duration, video.currentTime + 5)
        break

      case 'ArrowUp':
        event.preventDefault()
        setVolume(prev => Math.min(1, prev + 0.1))
        break

      case 'ArrowDown':
        event.preventDefault()
        setVolume(prev => Math.max(0, prev - 0.1))
        break

      case 'KeyM':
        event.preventDefault()
        video.muted = !video.muted
        break

      case 'KeyF':
        event.preventDefault()
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          containerRef.current?.requestFullscreen()
        }
        break
    }
  }, [])

  /**
   * 비디오 플레이어 동기화
   */
  useEffect(() => {
    if (videoRef.current) {
      const cleanup = timecodeFeedback.syncWithVideoPlayer?.(videoRef.current)
      return cleanup
    }
  }, [timecodeFeedback])

  /**
   * 키보드 이벤트 등록
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  /**
   * 볼륨 변경 적용
   */
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
    }
  }, [volume])

  /**
   * 재생 속도 변경 적용
   */
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  if (!currentSession) {
    return (
      <div
        className="flex items-center justify-center h-96 bg-gray-100 rounded-lg"
        data-testid="video-feedback-viewer-loading"
      >
        <p className="text-gray-500">세션을 로드하는 중...</p>
      </div>
    )
  }

  if (availableSlots.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-96 bg-gray-100 rounded-lg"
        data-testid="video-feedback-viewer-empty"
      >
        <p className="text-gray-500 mb-4">업로드된 영상이 없습니다</p>
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="upload-video-button"
        >
          영상 업로드
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      aria-label={ariaLabel}
      data-testid="video-feedback-viewer"
    >
      {/* 비디오 슬롯 선택 */}
      {availableSlots.length > 1 && (
        <div className="absolute top-4 left-4 z-20">
          <div className="flex space-x-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.slot}
                type="button"
                onClick={() => handleSlotChange(slot.slot)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedVideoSlot === slot.slot
                    ? 'bg-blue-600 text-white'
                    : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
                }`}
                data-testid={`video-slot-${slot.slot}`}
                aria-pressed={selectedVideoSlot === slot.slot}
              >
                {slot.slot.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 실시간 연결 상태 */}
      {enableRealtime && (
        <div className="absolute top-4 right-4 z-20">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm ${
            realtime.isConnected
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              realtime.isConnected ? 'bg-white' : 'bg-white animate-pulse'
            }`} />
            <span>{realtime.isConnected ? '실시간 연결됨' : '연결 중...'}</span>
            {realtime.userCount > 0 && (
              <span className="ml-2 text-xs">
                {realtime.userCount}명 접속
              </span>
            )}
          </div>
        </div>
      )}

      {/* 비디오 플레이어 */}
      <div className="relative aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-white">로딩 중...</div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <p className="mb-2">영상 로드 오류</p>
              <p className="text-sm text-gray-300">{loadError}</p>
            </div>
          </div>
        )}

        {currentVideoUrl && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls={!hideControls}
            autoPlay={autoPlay}
            muted={muted}
            preload="metadata"
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlayStateChange}
            onPause={handlePlayStateChange}
            data-testid="video-player"
            aria-label={`${activeVideo?.originalName || '영상'} 플레이어`}
          >
            <source src={currentVideoUrl} type="video/mp4" />
            <p>브라우저가 비디오 재생을 지원하지 않습니다.</p>
          </video>
        )}

        {/* 피드백 오버레이 */}
        {showFeedbackOverlay && timecodeFeedback.commentsAtCurrentTime.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4 z-10">
            <div className="bg-black bg-opacity-75 rounded-lg p-4 text-white">
              <h3 className="text-sm font-medium mb-2">
                현재 시점 피드백 ({timecodeFeedback.commentsAtCurrentTime.length}개)
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {timecodeFeedback.commentsAtCurrentTime.map((comment) => (
                  <div
                    key={comment.id}
                    className="text-sm"
                    data-comment-id={comment.id}
                  >
                    <p>{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 재생 정보 */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="bg-black bg-opacity-50 rounded-md px-3 py-1 text-white text-sm">
          {timecodeFeedback.formatCurrentTimecode()} / {
            activeVideo
              ? Math.floor(activeVideo.duration / 60).toString().padStart(2, '0') +
                ':' +
                Math.floor(activeVideo.duration % 60).toString().padStart(2, '0')
              : '00:00'
          }
        </div>
      </div>

      {/* 재생 속도 조절 */}
      <div className="absolute bottom-4 right-4 z-20">
        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="bg-black bg-opacity-50 text-white text-sm rounded-md px-2 py-1 border-none outline-none"
          data-testid="playback-rate-selector"
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1.0}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2.0}>2x</option>
        </select>
      </div>
    </div>
  )
}