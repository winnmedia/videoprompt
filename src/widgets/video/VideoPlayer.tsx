/**
 * VideoPlayer Widget
 *
 * 생성된 영상 재생 컴포넌트 (18단계 UserJourneyMap)
 * - HTML5 비디오 플레이어 with 커스텀 컨트롤
 * - 접근성 WCAG 2.1 AA 준수
 * - 키보드 네비게이션 지원
 */

import { useRef, useState, useEffect } from 'react'

export interface VideoPlayerProps {
  /** 비디오 소스 URL */
  src: string
  /** 비디오 제목 (접근성용) */
  title?: string
  /** 포스터 이미지 URL */
  poster?: string
  /** 자동 재생 여부 */
  autoPlay?: boolean
  /** 루프 재생 여부 */
  loop?: boolean
  /** 음소거 여부 */
  muted?: boolean
  /** 컨트롤 표시 여부 */
  controls?: boolean
  /** 플레이어 크기 */
  size?: 'small' | 'medium' | 'large' | 'full'
  /** 에러 콜백 */
  onError?: (error: string) => void
  /** 로딩 완료 콜백 */
  onLoad?: () => void
  /** 재생 시작 콜백 */
  onPlay?: () => void
  /** 재생 정지 콜백 */
  onPause?: () => void
  /** 재생 완료 콜백 */
  onEnded?: () => void
}

interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  isLoading: boolean
  isMuted: boolean
  volume: number
  isFullscreen: boolean
  hasError: boolean
  errorMessage: string
}

export function VideoPlayer({
  src,
  title = '생성된 영상',
  poster,
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  size = 'medium',
  onError,
  onLoad,
  onPlay,
  onPause,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showControls, setShowControls] = useState(false)
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout>()

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: true,
    isMuted: muted,
    volume: 1,
    isFullscreen: false,
    hasError: false,
    errorMessage: '',
  })

  // 비디오 이벤트 핸들러
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedData = () => {
      setState(prev => ({
        ...prev,
        duration: video.duration,
        isLoading: false,
      }))
      onLoad?.()
    }

    const handleTimeUpdate = () => {
      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
      }))
    }

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true }))
      onPlay?.()
    }

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }))
      onPause?.()
    }

    const handleEnded = () => {
      setState(prev => ({ ...prev, isPlaying: false }))
      onEnded?.()
    }

    const handleError = () => {
      const errorMessage = '비디오를 재생할 수 없습니다.'
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage,
        isLoading: false,
      }))
      onError?.(errorMessage)
    }

    const handleVolumeChange = () => {
      setState(prev => ({
        ...prev,
        isMuted: video.muted,
        volume: video.volume,
      }))
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('volumechange', handleVolumeChange)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [onLoad, onPlay, onPause, onEnded, onError])

  // 키보드 컨트롤
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(state.currentTime - 10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(state.currentTime + 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(1, state.volume + 0.1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(0, state.volume - 0.1))
          break
        case 'KeyM':
          e.preventDefault()
          toggleMute()
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.currentTime, state.volume])

  // 컨트롤 자동 숨김
  const handleMouseMove = () => {
    setShowControls(true)

    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
    }

    const timeout = setTimeout(() => {
      if (state.isPlaying) {
        setShowControls(false)
      }
    }, 3000)

    setControlsTimeout(timeout)
  }

  // 플레이어 컨트롤 함수들
  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (state.isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = Math.max(0, Math.min(state.duration, time))
  }

  const setVolume = (volume: number) => {
    const video = videoRef.current
    if (!video) return

    video.volume = volume
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
  }

  const toggleFullscreen = async () => {
    const container = containerRef.current
    if (!container) return

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen()
        setState(prev => ({ ...prev, isFullscreen: true }))
      } else {
        await document.exitFullscreen()
        setState(prev => ({ ...prev, isFullscreen: false }))
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 크기별 클래스
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'max-w-sm'
      case 'medium':
        return 'max-w-2xl'
      case 'large':
        return 'max-w-4xl'
      case 'full':
        return 'w-full'
      default:
        return 'max-w-2xl'
    }
  }

  if (state.hasError) {
    return (
      <div className={`relative mx-auto ${getSizeClasses()}`}>
        <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center border">
          <div className="text-center space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-error-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-error-800">재생 오류</h3>
              <p className="text-sm text-error-600">{state.errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto ${getSizeClasses()} bg-video-player-bg rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-500`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      tabIndex={0}
      role="region"
      aria-label={`비디오 플레이어: ${title}`}
    >
      {/* 비디오 엘리먼트 */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        className="w-full h-full aspect-video object-contain"
        aria-label={title}
        controls={false} // 커스텀 컨트롤 사용
      />

      {/* 로딩 스피너 */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-video-player-overlay">
          <div className="text-center space-y-2">
            <svg
              className="mx-auto h-8 w-8 text-white animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-white text-sm">로딩 중...</p>
          </div>
        </div>
      )}

      {/* 커스텀 컨트롤 */}
      {controls && !state.isLoading && (
        <div
          className={`
            absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4 transition-opacity duration-300
            ${showControls || !state.isPlaying ? 'opacity-100' : 'opacity-0'}
          `}
        >
          {/* 진행바 */}
          <div className="mb-4">
            <div
              className="w-full h-1 bg-white/20 rounded-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const percent = (e.clientX - rect.left) / rect.width
                seek(percent * state.duration)
              }}
              role="slider"
              aria-label="영상 진행률 조절"
              aria-valuemin={0}
              aria-valuemax={state.duration}
              aria-valuenow={state.currentTime}
              tabIndex={0}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
              />
            </div>
          </div>

          {/* 컨트롤 버튼들 */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              {/* 재생/정지 버튼 */}
              <button
                onClick={togglePlayPause}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label={state.isPlaying ? '정지' : '재생'}
              >
                {state.isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* 음량 조절 */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-1 hover:bg-white/20 rounded"
                  aria-label={state.isMuted ? '음소거 해제' : '음소거'}
                >
                  {state.isMuted || state.volume === 0 ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.787l-4.414-3.511H2a1 1 0 01-1-1V7a1 1 0 011-1h1.969l4.414-3.511a1 1 0 011.617.787zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.787l-4.414-3.511H2a1 1 0 01-1-1V7a1 1 0 011-1h1.969l4.414-3.511a1 1 0 011.617.787zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={state.isMuted ? 0 : state.volume}
                  onChange={(e) => {
                    const volume = parseFloat(e.target.value)
                    setVolume(volume)
                    if (volume > 0 && state.isMuted) {
                      toggleMute()
                    }
                  }}
                  className="w-16 h-1 bg-white/20 rounded-full appearance-none slider"
                  aria-label="음량 조절"
                />
              </div>

              {/* 시간 표시 */}
              <div className="text-sm">
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
              </div>
            </div>

            {/* 전체화면 버튼 */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label={state.isFullscreen ? '전체화면 해제' : '전체화면'}
            >
              {state.isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 키보드 도움말 (접근성) */}
      <div className="sr-only">
        <p>키보드 단축키: 스페이스바(재생/정지), 왼쪽/오른쪽 화살표(10초 이동), 위/아래 화살표(음량 조절), M(음소거), F(전체화면)</p>
      </div>
    </div>
  )
}