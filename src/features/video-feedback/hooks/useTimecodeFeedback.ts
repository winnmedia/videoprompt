/**
 * Timecode Feedback Hook
 *
 * CLAUDE.md 준수: features 레이어 비즈니스 로직
 * 타임코드 기반 피드백 기능을 위한 React 훅
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectCurrentTimecode,
  selectSelectedVideoSlot,
  selectFilteredComments,
  selectCommentsAtCurrentTime,
  selectActiveVideo,
  createComment,
  createReaction,
  setCurrentTimecode
} from '../../../entities/feedback'
import {
  secondsToTimecode,
  findClosestTimecode,
  isValidTimecodeForVideo,
  type Timecode
} from '../../../shared/lib/timecode-utils'
import type {
  CreateCommentRequest,
  CreateReactionRequest,
  EmotionType,
  TimecodeComment
} from '../../../entities/feedback'

/**
 * 타임코드 피드백 옵션
 */
export interface TimecodeFeedbackOptions {
  readonly autoSeekToComments: boolean
  readonly highlightActiveComments: boolean
  readonly snapToNearestComment: boolean
  readonly snapThreshold: number // 초 단위
}

/**
 * 댓글 작성 상태
 */
export interface CommentDraft {
  readonly content: string
  readonly timecode: Timecode
  readonly parentId?: string
}

/**
 * 타임코드 피드백 결과
 */
export interface TimecodeFeedbackReturn {
  // 현재 상태
  readonly currentTimecode: Timecode
  readonly commentsAtCurrentTime: TimecodeComment[]
  readonly isCommentFormOpen: boolean
  readonly commentDraft: CommentDraft | null

  // 댓글 관련
  readonly addComment: (content: string, parentId?: string) => Promise<void>
  readonly startComment: (customTimecode?: Timecode) => void
  readonly cancelComment: () => void
  readonly updateCommentDraft: (content: string) => void

  // 감정 반응 관련
  readonly addReaction: (type: EmotionType, commentId?: string) => Promise<void>
  readonly addTimecodeReaction: (type: EmotionType, timecode?: Timecode) => Promise<void>

  // 타임코드 네비게이션
  readonly seekToTimecode: (timecode: Timecode) => void
  readonly jumpToNextComment: () => void
  readonly jumpToPreviousComment: () => void
  readonly jumpToComment: (commentId: string) => void

  // 유틸리티
  readonly formatCurrentTimecode: () => string
  readonly getCommentsInRange: (startSeconds: number, endSeconds: number) => TimecodeComment[]
  readonly findNearestComment: (targetSeconds?: number) => TimecodeComment | null

  // 상태
  readonly isLoading: boolean
  readonly error: string | null
}

/**
 * 타임코드 기반 피드백 훅
 */
export function useTimecodeFeedback(
  options: Partial<TimecodeFeedbackOptions> = {}
): TimecodeFeedbackReturn {
  const dispatch = useDispatch()

  // Redux 상태
  const currentTimecode = useSelector(selectCurrentTimecode)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const filteredComments = useSelector(selectFilteredComments)
  const commentsAtCurrentTime = useSelector(selectCommentsAtCurrentTime)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [isCommentFormOpen, setIsCommentFormOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 옵션 기본값
  const opts: TimecodeFeedbackOptions = {
    autoSeekToComments: true,
    highlightActiveComments: true,
    snapToNearestComment: false,
    snapThreshold: 2.0,
    ...options
  }

  // 비디오 플레이어 참조 (외부에서 설정)
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null)

  /**
   * 비디오 플레이어 시간 동기화
   */
  const syncWithVideoPlayer = useCallback((player: HTMLVideoElement) => {
    videoPlayerRef.current = player

    const handleTimeUpdate = () => {
      const newTimecode = secondsToTimecode(player.currentTime)
      dispatch(setCurrentTimecode(newTimecode.seconds))
    }

    player.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      player.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [dispatch])

  /**
   * 특정 타임코드로 이동
   */
  const seekToTimecode = useCallback((timecode: Timecode) => {
    if (!activeVideo) return

    // 유효성 검증
    if (!isValidTimecodeForVideo(timecode, activeVideo.duration)) {
      setError('유효하지 않은 타임코드입니다')
      return
    }

    // 스냅 기능
    if (opts.snapToNearestComment) {
      const nearest = findClosestTimecode(timecode.seconds, filteredComments.map(c => c.timecode))
      if (nearest && Math.abs(nearest.seconds - timecode.seconds) <= opts.snapThreshold) {
        timecode = nearest
      }
    }

    // Redux 상태 업데이트
    dispatch(setCurrentTimecode(timecode.seconds))

    // 비디오 플레이어 시크
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = timecode.seconds
    }

    setError(null)
  }, [activeVideo, opts.snapToNearestComment, opts.snapThreshold, filteredComments, dispatch])

  /**
   * 댓글 작성 시작
   */
  const startComment = useCallback((customTimecode?: Timecode) => {
    if (!activeVideo) return

    const timecode = customTimecode || secondsToTimecode(currentTimecode)

    setCommentDraft({
      content: '',
      timecode,
      parentId: undefined
    })
    setIsCommentFormOpen(true)
    setError(null)
  }, [activeVideo, currentTimecode])

  /**
   * 댓글 작성 취소
   */
  const cancelComment = useCallback(() => {
    setCommentDraft(null)
    setIsCommentFormOpen(false)
    setError(null)
  }, [])

  /**
   * 댓글 초안 업데이트
   */
  const updateCommentDraft = useCallback((content: string) => {
    if (commentDraft) {
      setCommentDraft({
        ...commentDraft,
        content
      })
    }
  }, [commentDraft])

  /**
   * 댓글 추가
   */
  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!commentDraft && !parentId) return

    const timecode = commentDraft?.timecode || secondsToTimecode(currentTimecode)

    const request: CreateCommentRequest = {
      sessionId: 'current-session', // TODO: 실제 세션 ID 가져오기
      videoSlot: selectedVideoSlot,
      timecode,
      content: content.trim(),
      parentId
    }

    setIsLoading(true)
    setError(null)

    try {
      await dispatch(createComment(request)).unwrap()
      cancelComment()
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 작성에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [commentDraft, currentTimecode, selectedVideoSlot, dispatch, cancelComment])

  /**
   * 감정 반응 추가 (댓글용)
   */
  const addReaction = useCallback(async (type: EmotionType, commentId?: string) => {
    if (!commentId) return

    const request: CreateReactionRequest = {
      sessionId: 'current-session', // TODO: 실제 세션 ID 가져오기
      commentId,
      type
    }

    setIsLoading(true)
    setError(null)

    try {
      await dispatch(createReaction(request)).unwrap()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반응 추가에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [dispatch])

  /**
   * 타임코드 감정 반응 추가
   */
  const addTimecodeReaction = useCallback(async (type: EmotionType, timecode?: Timecode) => {
    const targetTimecode = timecode || secondsToTimecode(currentTimecode)

    const request: CreateReactionRequest = {
      sessionId: 'current-session', // TODO: 실제 세션 ID 가져오기
      videoSlot: selectedVideoSlot,
      timecode: targetTimecode,
      type
    }

    setIsLoading(true)
    setError(null)

    try {
      await dispatch(createReaction(request)).unwrap()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반응 추가에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [currentTimecode, selectedVideoSlot, dispatch])

  /**
   * 다음 댓글로 이동
   */
  const jumpToNextComment = useCallback(() => {
    const futureComments = filteredComments
      .filter(comment => comment.timecode.seconds > currentTimecode)
      .sort((a, b) => a.timecode.seconds - b.timecode.seconds)

    if (futureComments.length > 0) {
      seekToTimecode(futureComments[0].timecode)
    }
  }, [filteredComments, currentTimecode, seekToTimecode])

  /**
   * 이전 댓글로 이동
   */
  const jumpToPreviousComment = useCallback(() => {
    const pastComments = filteredComments
      .filter(comment => comment.timecode.seconds < currentTimecode)
      .sort((a, b) => b.timecode.seconds - a.timecode.seconds)

    if (pastComments.length > 0) {
      seekToTimecode(pastComments[0].timecode)
    }
  }, [filteredComments, currentTimecode, seekToTimecode])

  /**
   * 특정 댓글로 이동
   */
  const jumpToComment = useCallback((commentId: string) => {
    const comment = filteredComments.find(c => c.id === commentId)
    if (comment) {
      seekToTimecode(comment.timecode)
    }
  }, [filteredComments, seekToTimecode])

  /**
   * 현재 타임코드 포맷팅
   */
  const formatCurrentTimecode = useCallback(() => {
    return secondsToTimecode(currentTimecode).formatted
  }, [currentTimecode])

  /**
   * 범위 내 댓글 가져오기
   */
  const getCommentsInRange = useCallback((startSeconds: number, endSeconds: number) => {
    return filteredComments.filter(comment =>
      comment.timecode.seconds >= startSeconds &&
      comment.timecode.seconds <= endSeconds
    )
  }, [filteredComments])

  /**
   * 가장 가까운 댓글 찾기
   */
  const findNearestComment = useCallback((targetSeconds?: number) => {
    const target = targetSeconds ?? currentTimecode
    return findClosestTimecode(target, filteredComments.map(c => c.timecode))
      ? filteredComments.find(c => c.timecode.seconds === findClosestTimecode(target, filteredComments.map(c => c.timecode))!.seconds) || null
      : null
  }, [currentTimecode, filteredComments])

  /**
   * 키보드 단축키 처리
   */
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: 댓글 작성 시작
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        startComment()
      }

      // Ctrl/Cmd + J: 다음 댓글로 이동
      if ((event.ctrlKey || event.metaKey) && event.key === 'j') {
        event.preventDefault()
        jumpToNextComment()
      }

      // Ctrl/Cmd + K: 이전 댓글로 이동
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        jumpToPreviousComment()
      }

      // Escape: 댓글 작성 취소
      if (event.key === 'Escape' && isCommentFormOpen) {
        event.preventDefault()
        cancelComment()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [startComment, jumpToNextComment, jumpToPreviousComment, isCommentFormOpen, cancelComment])

  /**
   * 자동 하이라이트 효과
   */
  useEffect(() => {
    if (opts.highlightActiveComments && commentsAtCurrentTime.length > 0) {
      // CSS 클래스 추가 등의 하이라이트 로직
      const commentElements = document.querySelectorAll('[data-comment-id]')
      commentElements.forEach(el => el.classList.remove('highlight-active'))

      commentsAtCurrentTime.forEach(comment => {
        const element = document.querySelector(`[data-comment-id="${comment.id}"]`)
        element?.classList.add('highlight-active')
      })
    }
  }, [opts.highlightActiveComments, commentsAtCurrentTime])

  return {
    // 현재 상태
    currentTimecode: secondsToTimecode(currentTimecode),
    commentsAtCurrentTime,
    isCommentFormOpen,
    commentDraft,

    // 댓글 관련
    addComment,
    startComment,
    cancelComment,
    updateCommentDraft,

    // 감정 반응 관련
    addReaction,
    addTimecodeReaction,

    // 타임코드 네비게이션
    seekToTimecode,
    jumpToNextComment,
    jumpToPreviousComment,
    jumpToComment,

    // 유틸리티
    formatCurrentTimecode,
    getCommentsInRange,
    findNearestComment,

    // 상태
    isLoading,
    error
  }
}