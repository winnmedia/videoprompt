/**
 * FeedbackDashboard Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * 피드백 데이터를 시각화하고 감정 분석 차트, 시점별 피드백 분포를 제공
 */

import React, { useMemo, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectFilteredComments,
  selectActiveVideo
} from '../../entities/feedback'
import type { EmotionType, TimecodeComment, EmotionReaction, TimecodeHotspot } from '../../entities/feedback'

/**
 * 차트 데이터 인터페이스
 */
interface ChartData {
  readonly labels: string[]
  readonly datasets: Array<{
    readonly label: string
    readonly data: number[]
    readonly backgroundColor: string[]
    readonly borderColor?: string[]
  }>
}

/**
 * 통계 카드 데이터
 */
interface StatCard {
  readonly title: string
  readonly value: string | number
  readonly change?: {
    readonly percentage: number
    readonly trend: 'up' | 'down' | 'neutral'
  }
  readonly icon: string
  readonly color: string
}

/**
 * 감정별 색상 매핑
 */
const EMOTION_COLORS: Record<EmotionType, string> = {
  like: '#10B981',     // green-500
  dislike: '#EF4444',  // red-500
  confused: '#F59E0B'  // yellow-500
} as const

/**
 * FeedbackDashboard Props
 */
interface FeedbackDashboardProps {
  /** 시간 범위 필터 (시간) */
  readonly timeRange?: 1 | 6 | 12 | 24 | 168 // 1시간, 6시간, 12시간, 1일, 1주일

  /** 비교 기간 표시 */
  readonly showComparison?: boolean

  /** 실시간 업데이트 */
  readonly realTimeUpdate?: boolean

  /** 내보내기 기능 */
  readonly allowExport?: boolean

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 데이터 내보내기 콜백 */
  readonly onExport?: (data: any) => void

  /** 시간 범위 변경 콜백 */
  readonly onTimeRangeChange?: (range: number) => void
}

/**
 * FeedbackDashboard 컴포넌트
 */
export function FeedbackDashboard(props: FeedbackDashboardProps) {
  const {
    timeRange = 24,
    showComparison = false,
    realTimeUpdate = true,
    allowExport = true,
    className = '',
    'aria-label': ariaLabel = '피드백 대시보드',
    onExport,
    onTimeRangeChange
  } = props

  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const filteredComments = useSelector(selectFilteredComments)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [selectedView, setSelectedView] = useState<'overview' | 'timeline' | 'emotions' | 'engagement'>('overview')

  // 피터링된 데이터
  const sessionData = useMemo(() => {
    if (!currentSession) return null

    const now = new Date()
    const cutoffTime = new Date(now.getTime() - timeRange * 60 * 60 * 1000)

    const comments = filteredComments.filter(comment =>
      comment.videoSlot === selectedVideoSlot &&
      new Date(comment.createdAt) >= cutoffTime
    )

    const reactions = currentSession.reactions.filter(reaction =>
      reaction.videoSlot === selectedVideoSlot &&
      new Date(reaction.createdAt) >= cutoffTime
    )

    return { comments, reactions }
  }, [currentSession, filteredComments, selectedVideoSlot, timeRange])

  // 통계 카드 데이터
  const statCards = useMemo((): StatCard[] => {
    if (!sessionData) return []

    const { comments, reactions } = sessionData
    const totalFeedbacks = comments.length + reactions.length

    return [
      {
        title: '총 피드백',
        value: totalFeedbacks,
        change: showComparison ? { percentage: 12, trend: 'up' } : undefined,
        icon: '💬',
        color: 'bg-blue-500'
      },
      {
        title: '댓글',
        value: comments.length,
        change: showComparison ? { percentage: 8, trend: 'up' } : undefined,
        icon: '📝',
        color: 'bg-green-500'
      },
      {
        title: '감정 반응',
        value: reactions.length,
        change: showComparison ? { percentage: 15, trend: 'up' } : undefined,
        icon: '❤️',
        color: 'bg-purple-500'
      },
      {
        title: '참여자',
        value: currentSession?.participants.length || 0,
        change: showComparison ? { percentage: 5, trend: 'up' } : undefined,
        icon: '👥',
        color: 'bg-yellow-500'
      }
    ]
  }, [sessionData, showComparison, currentSession])

  // 감정 분석 차트 데이터
  const emotionChartData = useMemo((): ChartData => {
    if (!sessionData) {
      return { labels: [], datasets: [] }
    }

    const emotionCounts: Record<EmotionType, number> = {
      like: 0,
      dislike: 0,
      confused: 0
    }

    sessionData.reactions.forEach(reaction => {
      emotionCounts[reaction.type]++
    })

    const labels = Object.keys(emotionCounts).map(emotion => {
      switch (emotion) {
        case 'like': return '좋아요'
        case 'dislike': return '싫어요'
        case 'confused': return '혼란스러움'
        default: return emotion
      }
    })

    const data = Object.values(emotionCounts)
    const colors = Object.keys(emotionCounts).map(emotion => EMOTION_COLORS[emotion as EmotionType])

    return {
      labels,
      datasets: [{
        label: '감정 반응',
        data,
        backgroundColor: colors,
        borderColor: colors
      }]
    }
  }, [sessionData])

  // 시간대별 활동 데이터
  const timelineData = useMemo(() => {
    if (!sessionData || !activeVideo) return []

    const duration = activeVideo.duration
    const bucketSize = Math.max(1, Math.floor(duration / 20)) // 20개 구간으로 나누기
    const buckets: Array<{ time: number; comments: number; reactions: number }> = []

    for (let i = 0; i < 20; i++) {
      buckets.push({
        time: i * bucketSize,
        comments: 0,
        reactions: 0
      })
    }

    sessionData.comments.forEach(comment => {
      const bucketIndex = Math.floor(comment.timecode.seconds / bucketSize)
      if (buckets[bucketIndex]) {
        buckets[bucketIndex].comments++
      }
    })

    sessionData.reactions.forEach(reaction => {
      if (reaction.timecode) {
        const bucketIndex = Math.floor(reaction.timecode.seconds / bucketSize)
        if (buckets[bucketIndex]) {
          buckets[bucketIndex].reactions++
        }
      }
    })

    return buckets
  }, [sessionData, activeVideo])

  // 핫스팟 계산
  const hotspots = useMemo((): TimecodeHotspot[] => {
    if (!sessionData || !activeVideo) return []

    const duration = activeVideo.duration
    const windowSize = 10 // 10초 윈도우
    const spots: TimecodeHotspot[] = []

    for (let start = 0; start < duration; start += windowSize) {
      const end = Math.min(start + windowSize, duration)

      const commentsInWindow = sessionData.comments.filter(comment =>
        comment.timecode.seconds >= start && comment.timecode.seconds < end
      ).length

      const reactionsInWindow = sessionData.reactions.filter(reaction =>
        reaction.timecode &&
        reaction.timecode.seconds >= start &&
        reaction.timecode.seconds < end
      ).length

      const intensity = commentsInWindow + reactionsInWindow

      if (intensity >= 3) { // 최소 3개 피드백
        spots.push({
          startTime: start,
          endTime: end,
          intensity,
          commentCount: commentsInWindow,
          reactionCount: reactionsInWindow
        })
      }
    }

    return spots.sort((a, b) => b.intensity - a.intensity)
  }, [sessionData, activeVideo])

  // 시간 포맷팅
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

  // 데이터 내보내기
  const handleExport = useCallback(() => {
    if (!sessionData) return

    const exportData = {
      session: currentSession?.metadata,
      statistics: statCards,
      emotions: emotionChartData,
      timeline: timelineData,
      hotspots,
      generatedAt: new Date().toISOString()
    }

    onExport?.(exportData)

    // 기본 동작: JSON 파일 다운로드
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feedback-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sessionData, currentSession, statCards, emotionChartData, timelineData, hotspots, onExport])

  if (!currentSession || !sessionData) {
    return (
      <div className={`text-center text-gray-500 py-12 ${className}`}>
        <p>대시보드 데이터를 로드할 수 없습니다</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
      aria-label={ariaLabel}
      data-testid="feedback-dashboard"
    >
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">피드백 대시보드</h3>
            <p className="text-sm text-gray-500 mt-1">
              최근 {timeRange}시간 동안의 피드백 분석
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* 시간 범위 선택 */}
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange?.(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              data-testid="time-range-selector"
            >
              <option value={1}>최근 1시간</option>
              <option value={6}>최근 6시간</option>
              <option value={12}>최근 12시간</option>
              <option value={24}>최근 24시간</option>
              <option value={168}>최근 1주일</option>
            </select>

            {/* 내보내기 버튼 */}
            {allowExport && (
              <button
                type="button"
                onClick={handleExport}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="export-button"
              >
                내보내기
              </button>
            )}
          </div>
        </div>

        {/* 뷰 선택 탭 */}
        <div className="flex space-x-4 mt-4">
          {[
            { key: 'overview', label: '개요' },
            { key: 'timeline', label: '타임라인' },
            { key: 'emotions', label: '감정 분석' },
            { key: 'engagement', label: '참여도' }
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedView(key as any)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                selectedView === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`view-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* 개요 뷰 */}
        {selectedView === 'overview' && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                  data-testid={`stat-card-${index}`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-md ${card.color}`}>
                      <span className="text-white text-lg">{card.icon}</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">{card.title}</p>
                      <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                      {card.change && (
                        <p className={`text-sm ${
                          card.change.trend === 'up' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {card.change.trend === 'up' ? '↑' : '↓'} {card.change.percentage}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 핫스팟 목록 */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">피드백 집중 구간</h4>
              {hotspots.length > 0 ? (
                <div className="space-y-2">
                  {hotspots.slice(0, 5).map((hotspot, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`hotspot-${index}`}
                    >
                      <div>
                        <span className="font-medium">
                          {formatTime(hotspot.startTime)} - {formatTime(hotspot.endTime)}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          댓글 {hotspot.commentCount}개, 반응 {hotspot.reactionCount}개
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          hotspot.intensity >= 7 ? 'bg-red-100 text-red-800' :
                          hotspot.intensity >= 5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          강도 {hotspot.intensity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">집중된 피드백 구간이 없습니다</p>
              )}
            </div>
          </div>
        )}

        {/* 타임라인 뷰 */}
        {selectedView === 'timeline' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">시간대별 활동</h4>
            <div className="space-y-4">
              {timelineData.map((bucket, index) => {
                const total = bucket.comments + bucket.reactions
                const maxTotal = Math.max(...timelineData.map(b => b.comments + b.reactions))
                const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0

                return (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="w-16 text-sm text-gray-600">
                      {formatTime(bucket.time)}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                        {total > 0 && `${total}`}
                      </div>
                    </div>
                    <div className="w-20 text-sm text-gray-600">
                      {bucket.comments}개 댓글, {bucket.reactions}개 반응
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 감정 분석 뷰 */}
        {selectedView === 'emotions' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">감정 반응 분석</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 감정별 통계 */}
              <div className="space-y-4">
                {emotionChartData.labels.map((label, index) => {
                  const count = emotionChartData.datasets[0].data[index]
                  const total = emotionChartData.datasets[0].data.reduce((a, b) => a + b, 0)
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: emotionChartData.datasets[0].backgroundColor[index] }}
                        />
                        <span className="font-medium">{label}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{count}개</div>
                        <div className="text-sm text-gray-600">{percentage}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 간단한 원형 차트 표현 */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">
                    {emotionChartData.datasets[0].data.reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-sm text-gray-600">총 감정 반응</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 참여도 뷰 */}
        {selectedView === 'engagement' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">참여도 분석</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 참여자별 활동 */}
              <div>
                <h5 className="font-medium text-gray-900 mb-3">참여자별 활동</h5>
                <div className="space-y-2">
                  {currentSession.participants.slice(0, 5).map((participant, index) => {
                    const userComments = sessionData.comments.filter(c => c.authorId === participant.id).length
                    const userReactions = sessionData.reactions.filter(r => r.authorId === participant.id).length

                    return (
                      <div key={participant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">
                            {participant.guestName || `사용자 ${index + 1}`}
                          </div>
                          <div className="text-sm text-gray-600">
                            {participant.type === 'guest' ? '게스트' : '멤버'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{userComments + userReactions}</div>
                          <div className="text-sm text-gray-600">
                            댓글 {userComments}, 반응 {userReactions}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 활동 시간 분포 */}
              <div>
                <h5 className="font-medium text-gray-900 mb-3">시간대별 참여도</h5>
                <div className="text-center text-gray-500">
                  <p>시간대별 참여도 차트</p>
                  <p className="text-sm">(차트 라이브러리 연동 필요)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}