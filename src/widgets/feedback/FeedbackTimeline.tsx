/**
 * FeedbackTimeline Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * 영상 하단 타임라인에 피드백을 시각화하고 클릭으로 해당 시점 이동 지원
 */

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectCurrentTimecode,
  selectSelectedVideoSlot,
  selectCurrentSession,
  selectFilteredComments,
  selectActiveVideo,
  setCurrentTimecode
} from '../../entities/feedback'
import { useTimecodeFeedback } from '../../features/video-feedback/hooks/useTimecodeFeedback'
import type { TimecodeComment, EmotionReaction, EmotionType } from '../../entities/feedback'

/**
 * 타임라인 마커 타입
 */
interface TimelineMarker {
  readonly timecode: number
  readonly comments: TimecodeComment[]
  readonly reactions: EmotionReaction[]
  readonly intensity: number // 피드백 밀도 (1-10)
  readonly type: 'comment' | 'reaction' | 'mixed'
}

/**
 * 감정별 색상 매핑
 */
const EMOTION_COLORS: Record<EmotionType, string> = {
  like: 'bg-green-500',
  dislike: 'bg-red-500',
  confused: 'bg-yellow-500'
} as const

/**
 * FeedbackTimeline Props
 */
interface FeedbackTimelineProps {
  /** 타임라인 높이 */
  readonly height?: number

  /** 마커 클릭 시 자동 이동 */
  readonly autoSeek?: boolean

  /** 현재 시점 표시 */
  readonly showCurrentTime?: boolean

  /** 피드백 타입 필터 */
  readonly filterType?: 'all' | 'comments' | 'reactions'

  /** 마커 그룹화 임계값 (초) */
  readonly groupThreshold?: number

  /** 미니맵 모드 (간소화된 표시) */
  readonly miniMode?: boolean

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 마커 클릭 콜백 */
  readonly onMarkerClick?: (timecode: number, marker: TimelineMarker) => void

  /** 타임라인 클릭 콜백 */
  readonly onTimelineClick?: (timecode: number) => void

  /** 마커 호버 콜백 */
  readonly onMarkerHover?: (marker: TimelineMarker | null) => void
}

/**
 * FeedbackTimeline 컴포넌트
 */
export function FeedbackTimeline(props: FeedbackTimelineProps) {
  const {
    height = 60,
    autoSeek = true,
    showCurrentTime = true,
    filterType = 'all',
    groupThreshold = 2.0,
    miniMode = false,
    className = '',
    'aria-label': ariaLabel = '피드백 타임라인',
    onMarkerClick,
    onTimelineClick,
    onMarkerHover
  } = props

  // Redux 상태
  const dispatch = useDispatch()
  const currentTimecode = useSelector(selectCurrentTimecode)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const currentSession = useSelector(selectCurrentSession)
  const filteredComments = useSelector(selectFilteredComments)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // 훅
  const timecodeFeedback = useTimecodeFeedback()

  // 비디오 지속시간
  const videoDuration = useMemo(() => {
    return activeVideo?.duration || 0
  }, [activeVideo])

  // 피드백 데이터 필터링
  const filteredFeedbacks = useMemo(() => {
    if (!currentSession) return { comments: [], reactions: [] }

    const comments = filteredComments.filter(comment =>
      comment.videoSlot === selectedVideoSlot
    )

    const reactions = currentSession.reactions.filter(reaction =>
      reaction.videoSlot === selectedVideoSlot && reaction.timecode
    )

    switch (filterType) {
      case 'comments':
        return { comments, reactions: [] }
      case 'reactions':
        return { comments: [], reactions }
      default:
        return { comments, reactions }
    }
  }, [currentSession, filteredComments, selectedVideoSlot, filterType])

  // 타임라인 마커 생성
  const timelineMarkers = useMemo(() => {
    const { comments, reactions } = filteredFeedbacks
    const markerMap = new Map<number, TimelineMarker>()

    // 댓글 처리
    comments.forEach(comment => {
      const timecode = Math.floor(comment.timecode.seconds / groupThreshold) * groupThreshold
      const existing = markerMap.get(timecode)

      if (existing) {
        existing.comments.push(comment)
        existing.intensity = Math.min(10, existing.intensity + 1)
        existing.type = existing.reactions.length > 0 ? 'mixed' : 'comment'
      } else {
        markerMap.set(timecode, {
          timecode,
          comments: [comment],
          reactions: [],
          intensity: 1,
          type: 'comment'
        })
      }
    })

    // 감정 반응 처리
    reactions.forEach(reaction => {
      if (!reaction.timecode) return

      const timecode = Math.floor(reaction.timecode.seconds / groupThreshold) * groupThreshold
      const existing = markerMap.get(timecode)

      if (existing) {
        existing.reactions.push(reaction)
        existing.intensity = Math.min(10, existing.intensity + 0.5)
        existing.type = existing.comments.length > 0 ? 'mixed' : 'reaction'
      } else {
        markerMap.set(timecode, {
          timecode,
          comments: [],
          reactions: [reaction],
          intensity: 0.5,
          type: 'reaction'
        })
      }
    })

    return Array.from(markerMap.values()).sort((a, b) => a.timecode - b.timecode)
  }, [filteredFeedbacks, groupThreshold])

  // 현재 시점의 진행률 계산
  const currentProgress = useMemo(() => {
    if (videoDuration === 0) return 0
    return Math.min(100, (currentTimecode / videoDuration) * 100)
  }, [currentTimecode, videoDuration])

  // 마커 위치 계산
  const getMarkerPosition = useCallback((timecode: number) => {
    if (videoDuration === 0) return 0
    return Math.min(100, (timecode / videoDuration) * 100)
  }, [videoDuration])

  // 마커 크기 계산
  const getMarkerSize = useCallback((intensity: number) => {
    if (miniMode) {
      return Math.max(2, Math.min(6, intensity))
    }
    return Math.max(4, Math.min(12, intensity * 2))
  }, [miniMode])

  // 마커 색상 계산
  const getMarkerColor = useCallback((marker: TimelineMarker) => {
    if (marker.type === 'comment') {
      return 'bg-blue-500'
    }

    if (marker.type === 'reaction') {
      // 가장 많은 감정 반응 타입의 색상 사용
      const emotionCounts = marker.reactions.reduce((acc, reaction) => {
        acc[reaction.type] = (acc[reaction.type] || 0) + 1
        return acc
      }, {} as Record<EmotionType, number>)

      const dominantEmotion = Object.entries(emotionCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] as EmotionType

      return EMOTION_COLORS[dominantEmotion] || 'bg-gray-500'
    }

    // mixed 타입
    return 'bg-purple-500'
  }, [])

  // 타임라인 클릭 처리
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current || videoDuration === 0) return

    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickRatio = clickX / rect.width
    const clickTime = clickRatio * videoDuration

    if (autoSeek) {
      dispatch(setCurrentTimecode(clickTime))
    }

    onTimelineClick?.(clickTime)
  }, [videoDuration, autoSeek, dispatch, onTimelineClick])

  // 마커 클릭 처리
  const handleMarkerClick = useCallback((event: React.MouseEvent, marker: TimelineMarker) => {
    event.stopPropagation()

    if (autoSeek) {
      dispatch(setCurrentTimecode(marker.timecode))
    }

    onMarkerClick?.(marker.timecode, marker)
  }, [autoSeek, dispatch, onMarkerClick])

  // 마커 호버 처리
  const handleMarkerHover = useCallback((marker: TimelineMarker | null) => {
    setHoveredMarker(marker)
    onMarkerHover?.(marker)
  }, [onMarkerHover])

  // 드래그 시작
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true)
    handleTimelineClick(event)
  }, [handleTimelineClick])

  // 드래그 중
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging) {
      handleTimelineClick(event)
    }
  }, [isDragging, handleTimelineClick])

  // 드래그 종료
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 타임코드 포맷팅
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

  // 마우스 이벤트 정리
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect()
        const moveX = event.clientX - rect.left
        const moveRatio = Math.max(0, Math.min(1, moveX / rect.width))
        const moveTime = moveRatio * videoDuration

        if (autoSeek) {
          dispatch(setCurrentTimecode(moveTime))
        }
      }
    }

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      document.addEventListener('mousemove', handleGlobalMouseMove)
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDragging, videoDuration, autoSeek, dispatch])

  if (!currentSession || videoDuration === 0) {
    return (
      <div
        className={`bg-gray-100 rounded-md ${className}`}
        style={{ height }}
        data-testid="feedback-timeline-empty"
      >
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          타임라인을 사용할 수 없습니다
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative bg-gray-200 rounded-md cursor-pointer select-none ${className}`}
      style={{ height }}
      aria-label={ariaLabel}
      data-testid="feedback-timeline"
    >
      {/* 타임라인 배경 */}
      <div
        ref={timelineRef}
        className="relative w-full h-full rounded-md overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => handleMarkerHover(null)}
      >
        {/* 진행률 표시 */}
        {showCurrentTime && (
          <div
            className="absolute top-0 bottom-0 bg-blue-400 opacity-30 transition-all duration-100"
            style={{ width: `${currentProgress}%` }}
          />
        )}

        {/* 현재 시점 표시자 */}
        {showCurrentTime && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10"
            style={{ left: `${currentProgress}%` }}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 rounded-full" />
          </div>
        )}

        {/* 피드백 마커들 */}
        {timelineMarkers.map((marker, index) => {
          const position = getMarkerPosition(marker.timecode)
          const size = getMarkerSize(marker.intensity)
          const color = getMarkerColor(marker)

          return (
            <div
              key={`${marker.timecode}-${index}`}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-all hover:scale-125 ${color}`}
              style={{
                left: `${position}%`,
                top: '50%',
                width: size,
                height: size,
                zIndex: hoveredMarker === marker ? 20 : 15
              }}
              onClick={(e) => handleMarkerClick(e, marker)}
              onMouseEnter={() => handleMarkerHover(marker)}
              onMouseLeave={() => handleMarkerHover(null)}
              data-testid={`timeline-marker-${marker.timecode}`}
              title={`${formatTime(marker.timecode)} - ${marker.comments.length}개 댓글, ${marker.reactions.length}개 반응`}
            />
          )
        })}

        {/* 시간 눈금 (미니모드가 아닐 때만) */}
        {!miniMode && (
          <div className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none">
            {Array.from({ length: Math.min(10, Math.floor(videoDuration / 60)) }, (_, i) => {
              const time = (i + 1) * 60
              const position = getMarkerPosition(time)

              return (
                <div
                  key={time}
                  className="absolute bottom-0 text-xs text-gray-600"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                >
                  {formatTime(time)}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 호버 툴팁 */}
      {hoveredMarker && (
        <div
          ref={tooltipRef}
          className="absolute z-30 bg-black text-white text-xs rounded-md px-2 py-1 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${getMarkerPosition(hoveredMarker.timecode)}%`,
            top: -8
          }}
        >
          <div className="font-medium">{formatTime(hoveredMarker.timecode)}</div>
          <div className="text-gray-300">
            {hoveredMarker.comments.length > 0 && `댓글 ${hoveredMarker.comments.length}개`}
            {hoveredMarker.comments.length > 0 && hoveredMarker.reactions.length > 0 && ', '}
            {hoveredMarker.reactions.length > 0 && `반응 ${hoveredMarker.reactions.length}개`}
          </div>
          {/* 툴팁 화살표 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black" />
        </div>
      )}

      {/* 통계 정보 (미니모드가 아닐 때만) */}
      {!miniMode && (
        <div className="absolute top-1 right-2 text-xs text-gray-600">
          총 {timelineMarkers.length}개 피드백
        </div>
      )}
    </div>
  )
}