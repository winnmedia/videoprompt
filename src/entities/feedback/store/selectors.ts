/**
 * Feedback Entity Selectors
 *
 * CLAUDE.md 준수: entities 레이어 상태 셀렉터
 * 피드백 도메인 상태에 대한 파생 데이터 계산 및 최적화된 선택자
 */

import { createSelector } from '@reduxjs/toolkit'

// FSD 준수: entities는 app을 import하지 않음
export interface StateWithFeedback {
  feedback: any // 실제 FeedbackState 타입으로 변경 필요
}
import type {
  FeedbackSession,
  TimecodeComment,
  EmotionReaction,
  FeedbackParticipant,
  VideoSlot,
  TimecodeHotspot
} from '../model/types'

/**
 * 기본 상태 선택자
 */
export const selectFeedbackState = (state: StateWithFeedback) => state.feedback

export const selectCurrentSession = (state: StateWithFeedback) => state.feedback.currentSession

export const selectIsLoading = (state: StateWithFeedback) => state.feedback.isLoading

export const selectIsSubmitting = (state: StateWithFeedback) => state.feedback.isSubmitting

export const selectError = (state: StateWithFeedback) => state.feedback.error

export const selectUI = (state: StateWithFeedback) => state.feedback.ui

export const selectRealtime = (state: StateWithFeedback) => state.feedback.realtime

/**
 * UI 상태 선택자
 */
export const selectSelectedVideoSlot = (state: StateWithFeedback) => state.feedback.ui.selectedVideoSlot

export const selectCurrentTimecode = (state: StateWithFeedback) => state.feedback.ui.currentTimecode

export const selectIsPlaying = (state: StateWithFeedback) => state.feedback.ui.isPlaying

export const selectShowResolvedComments = (state: StateWithFeedback) => state.feedback.ui.showResolvedComments

export const selectParticipantFilter = (state: StateWithFeedback) => state.feedback.ui.filterByParticipant

export const selectCommentFormOpen = (state: StateWithFeedback) => state.feedback.ui.commentFormOpen

export const selectReactionPanelOpen = (state: StateWithFeedback) => state.feedback.ui.reactionPanelOpen

/**
 * 실시간 상태 선택자
 */
export const selectIsRealtimeConnected = (state: StateWithFeedback) => state.feedback.realtime.isConnected

export const selectLastRealtimeEvent = (state: StateWithFeedback) => state.feedback.realtime.lastEvent

export const selectPendingEvents = (state: StateWithFeedback) => state.feedback.realtime.pendingEvents

/**
 * 세션 데이터 선택자
 */
export const selectSessionMetadata = createSelector(
  [selectCurrentSession],
  (session) => session?.metadata
)

export const selectVideoSlots = createSelector(
  [selectCurrentSession],
  (session) => session?.videoSlots || []
)

export const selectParticipants = createSelector(
  [selectCurrentSession],
  (session) => session?.participants || []
)

export const selectComments = createSelector(
  [selectCurrentSession],
  (session) => session?.comments || []
)

export const selectReactions = createSelector(
  [selectCurrentSession],
  (session) => session?.reactions || []
)

export const selectSessionStats = createSelector(
  [selectCurrentSession],
  (session) => session?.stats
)

/**
 * 활성 비디오 슬롯 선택자
 */
export const selectActiveVideoSlot = createSelector(
  [selectVideoSlots, selectSelectedVideoSlot],
  (videoSlots, selectedSlot) =>
    videoSlots.find(slot => slot.slot === selectedSlot)
)

export const selectActiveVideo = createSelector(
  [selectActiveVideoSlot],
  (activeSlot) => activeSlot?.video
)

/**
 * 필터링된 댓글 선택자
 */
export const selectFilteredComments = createSelector(
  [selectComments, selectSelectedVideoSlot, selectShowResolvedComments, selectParticipantFilter],
  (comments, selectedSlot, showResolved, participantFilter) => {
    return comments.filter(comment => {
      // 선택된 비디오 슬롯 필터
      if (comment.videoSlot !== selectedSlot) return false

      // 해결된 댓글 필터
      if (!showResolved && comment.isResolved) return false

      // 참여자 필터
      if (participantFilter && comment.authorId !== participantFilter) return false

      return true
    })
  }
)

/**
 * 타임코드별 댓글 그룹화
 */
export const selectCommentsByTimecode = createSelector(
  [selectFilteredComments],
  (comments) => {
    const grouped = new Map<number, TimecodeComment[]>()

    comments.forEach(comment => {
      const timecode = comment.timecode.seconds
      if (!grouped.has(timecode)) {
        grouped.set(timecode, [])
      }
      grouped.get(timecode)!.push(comment)
    })

    return grouped
  }
)

/**
 * 현재 타임코드의 댓글
 */
export const selectCommentsAtCurrentTime = createSelector(
  [selectCommentsByTimecode, selectCurrentTimecode],
  (commentsByTimecode, currentTime) => {
    // 현재 시간 ±2초 범위의 댓글 반환
    const timeRange = 2
    const comments: TimecodeComment[] = []

    for (const [timecode, timeComments] of commentsByTimecode) {
      if (Math.abs(timecode - currentTime) <= timeRange) {
        comments.push(...timeComments)
      }
    }

    return comments.sort((a, b) => a.timecode.seconds - b.timecode.seconds)
  }
)

/**
 * 온라인 참여자 선택자
 */
export const selectOnlineParticipants = createSelector(
  [selectParticipants],
  (participants) => participants.filter(p => p.isOnline)
)

/**
 * 참여자별 통계
 */
export const selectParticipantStats = createSelector(
  [selectParticipants, selectComments, selectReactions],
  (participants, comments, reactions) => {
    return participants.map(participant => {
      const participantComments = comments.filter(c => c.authorId === participant.id)
      const participantReactions = reactions.filter(r => r.authorId === participant.id)

      return {
        participant,
        commentCount: participantComments.length,
        reactionCount: participantReactions.length,
        lastActivity: Math.max(
          ...participantComments.map(c => c.createdAt.getTime()),
          ...participantReactions.map(r => r.createdAt.getTime()),
          participant.lastSeenAt.getTime()
        )
      }
    })
  }
)

/**
 * 핫스팟 계산 (피드백이 집중된 구간)
 */
export const selectTimecodeHotspots = createSelector(
  [selectFilteredComments, selectReactions, selectSelectedVideoSlot, selectActiveVideo],
  (comments, reactions, selectedSlot, activeVideo): TimecodeHotspot[] => {
    if (!activeVideo) return []

    const duration = activeVideo.duration
    const windowSize = 5 // 5초 윈도우
    const hotspots: TimecodeHotspot[] = []

    // 5초 간격으로 구간 나누기
    for (let start = 0; start < duration; start += windowSize) {
      const end = Math.min(start + windowSize, duration)

      // 해당 구간의 댓글과 반응 계산
      const windowComments = comments.filter(c =>
        c.timecode.seconds >= start && c.timecode.seconds < end
      )

      const windowReactions = reactions.filter(r =>
        r.videoSlot === selectedSlot &&
        r.timecode &&
        r.timecode.seconds >= start &&
        r.timecode.seconds < end
      )

      const intensity = windowComments.length + windowReactions.length

      // 최소 강도 이상인 경우만 핫스팟으로 등록
      if (intensity >= 3) {
        hotspots.push({
          startTime: start,
          endTime: end,
          intensity,
          commentCount: windowComments.length,
          reactionCount: windowReactions.length
        })
      }
    }

    return hotspots.sort((a, b) => b.intensity - a.intensity)
  }
)

/**
 * 미해결 댓글 수
 */
export const selectUnresolvedCommentCount = createSelector(
  [selectFilteredComments],
  (comments) => comments.filter(c => !c.isResolved).length
)

/**
 * 세션의 전반적인 활동 점수
 */
export const selectSessionEngagement = createSelector(
  [selectComments, selectReactions, selectParticipants],
  (comments, reactions, participants) => {
    if (participants.length === 0) return 0

    const totalActivity = comments.length + reactions.length
    const activeParticipants = participants.filter(p => p.isOnline).length

    // 참여자당 평균 활동도 계산
    return totalActivity / participants.length
  }
)

/**
 * 댓글 트리 구조 (대댓글 포함)
 */
export const selectCommentTree = createSelector(
  [selectFilteredComments],
  (comments) => {
    // 최상위 댓글들 (parentId가 없는 것들)
    const rootComments = comments.filter(c => !c.parentId)

    // 대댓글들을 부모에 연결
    const buildTree = (parentId: string): TimecodeComment[] => {
      return comments
        .filter(c => c.parentId === parentId)
        .map(comment => ({
          ...comment,
          replies: buildTree(comment.id)
        }))
    }

    return rootComments.map(comment => ({
      ...comment,
      replies: buildTree(comment.id)
    }))
  }
)

/**
 * 특정 댓글의 반응들
 */
export const selectCommentReactions = (commentId: string) =>
  createSelector(
    [selectReactions],
    (reactions) => reactions.filter(r => r.commentId === commentId)
  )

/**
 * 현재 사용자가 참여 가능한지 확인
 */
export const selectCanCurrentUserParticipate = createSelector(
  [selectSessionMetadata, selectOnlineParticipants],
  (sessionMetadata, onlineParticipants) => {
    if (!sessionMetadata) return false

    // 세션 만료 확인
    if (sessionMetadata.expiresAt && new Date(sessionMetadata.expiresAt) <= new Date()) {
      return false
    }

    // 참여자 수 제한 확인
    if (onlineParticipants.length >= 50) { // FeedbackConstants.MAX_PARTICIPANTS
      return false
    }

    return true
  }
)