/**
 * Enhanced Comments Hook - Phase 3.9
 *
 * CLAUDE.md 준수: features 레이어 비즈니스 로직
 * 스레드 댓글, 대댓글, 감정표현 관리를 위한 React 훅
 */

import { useCallback, useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectFilteredComments,
  selectCurrentTimecode,
  type ThreadedComment,
  type EmotionReactionExtended,
  type CommentAttachment,
  type ThreadStats,
  type EmotionType,
  type VideoSlot,
  ThreadConstants
} from '../../../entities/feedback'

/**
 * 댓글 스레드 구조
 */
export interface CommentThread {
  readonly rootComment: ThreadedComment
  readonly replies: ThreadedComment[]
  readonly stats: ThreadStats
  readonly isExpanded: boolean
  readonly isHighlighted: boolean
}

/**
 * 댓글 작성 옵션
 */
export interface CommentCreationOptions {
  readonly parentId?: string
  readonly versionId?: string
  readonly mentionUserIds?: string[]
  readonly attachments?: File[]
  readonly isPrivate?: boolean
  readonly autoResolve?: boolean
}

/**
 * 댓글 필터 옵션
 */
export interface CommentFilterOptions {
  readonly showResolved: boolean
  readonly participantType?: 'all' | 'owner' | 'member' | 'guest'
  readonly timeRange?: {
    readonly start: number
    readonly end: number
  }
  readonly versionId?: string
  readonly hasAttachments?: boolean
  readonly hasReactions?: boolean
  readonly searchQuery?: string
}

/**
 * 대댓글 정렬 옵션
 */
export type CommentSortOption = 'newest' | 'oldest' | 'most_reactions' | 'threaded'

/**
 * 향상된 댓글 시스템 결과
 */
export interface EnhancedCommentsReturn {
  // 댓글 스레드
  readonly commentThreads: CommentThread[]
  readonly flatComments: ThreadedComment[]
  readonly totalComments: number
  readonly totalThreads: number

  // 현재 상태
  readonly isLoading: boolean
  readonly isSubmitting: boolean
  readonly error: string | null

  // 댓글 CRUD
  readonly createComment: (
    content: string,
    options?: CommentCreationOptions
  ) => Promise<ThreadedComment>
  readonly replyToComment: (
    parentId: string,
    content: string,
    options?: Omit<CommentCreationOptions, 'parentId'>
  ) => Promise<ThreadedComment>
  readonly editComment: (commentId: string, content: string) => Promise<void>
  readonly deleteComment: (commentId: string) => Promise<void>
  readonly resolveComment: (commentId: string) => Promise<void>
  readonly unresolveComment: (commentId: string) => Promise<void>

  // 감정 반응
  readonly addReaction: (
    commentId: string,
    type: EmotionType
  ) => Promise<EmotionReactionExtended>
  readonly removeReaction: (
    commentId: string,
    type: EmotionType
  ) => Promise<void>
  readonly getCommentReactions: (commentId: string) => EmotionReactionExtended[]

  // 스레드 관리
  readonly expandThread: (threadId: string) => void
  readonly collapseThread: (threadId: string) => void
  readonly highlightThread: (threadId: string) => void
  readonly jumpToThread: (threadId: string) => void

  // 필터링 및 정렬
  readonly applyFilter: (options: Partial<CommentFilterOptions>) => void
  readonly setSortOption: (option: CommentSortOption) => void
  readonly searchComments: (query: string) => void
  readonly clearFilters: () => void

  // 첨부 파일
  readonly uploadAttachment: (file: File, commentId?: string) => Promise<CommentAttachment>
  readonly removeAttachment: (attachmentId: string) => Promise<void>

  // 멘션
  readonly mentionUser: (userId: string, commentId: string) => Promise<void>
  readonly getMentionSuggestions: (query: string) => Promise<Array<{
    id: string
    name: string
    avatar?: string
  }>>

  // 유틸리티
  readonly getThreadDepth: (commentId: string) => number
  readonly canReply: (commentId: string) => boolean
  readonly canEdit: (commentId: string) => boolean
  readonly canDelete: (commentId: string) => boolean
  readonly exportComments: (format: 'json' | 'csv' | 'pdf') => Promise<Blob>
}

/**
 * 향상된 댓글 시스템 훅
 */
export function useEnhancedComments(
  initialFilter: Partial<CommentFilterOptions> = {},
  initialSort: CommentSortOption = 'threaded'
): EnhancedCommentsReturn {
  const dispatch = useDispatch()

  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const baseComments = useSelector(selectFilteredComments)
  const currentTimecode = useSelector(selectCurrentTimecode)

  // 로컬 상태
  const [threadedComments, setThreadedComments] = useState<ThreadedComment[]>([])
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([])
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [highlightedThread, setHighlightedThread] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<CommentFilterOptions>({
    showResolved: true,
    ...initialFilter
  })
  const [sortOption, setSortOption] = useState<CommentSortOption>(initialSort)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 댓글을 스레드 구조로 변환
   */
  const buildCommentThreads = useCallback((comments: ThreadedComment[]): CommentThread[] => {
    const threadsMap = new Map<string, CommentThread>()
    const rootComments = comments.filter(c => c.depth === 0)

    // 루트 댓글 기준으로 스레드 생성
    rootComments.forEach(rootComment => {
      const replies = comments
        .filter(c => c.threadId === rootComment.id && c.depth > 0)
        .sort((a, b) => {
          switch (sortOption) {
            case 'newest':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            case 'oldest':
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            case 'most_reactions':
              return b.reactions.length - a.reactions.length
            case 'threaded':
            default:
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          }
        })

      const stats: ThreadStats = {
        threadId: rootComment.id,
        totalComments: replies.length + 1,
        totalReactions: rootComment.reactions.length + replies.reduce((sum, r) => sum + r.reactions.length, 0),
        participantCount: new Set([
          rootComment.author.id,
          ...replies.map(r => r.author.id)
        ]).size,
        lastActivity: replies.length > 0
          ? new Date(Math.max(...replies.map(r => new Date(r.createdAt).getTime())))
          : rootComment.createdAt,
        isResolved: rootComment.isResolved,
        resolvedAt: rootComment.isResolved ? rootComment.updatedAt : undefined,
        resolvedBy: rootComment.isResolved ? rootComment.author.id : undefined
      }

      threadsMap.set(rootComment.id, {
        rootComment,
        replies,
        stats,
        isExpanded: expandedThreads.has(rootComment.id),
        isHighlighted: highlightedThread === rootComment.id
      })
    })

    return Array.from(threadsMap.values()).sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.stats.lastActivity).getTime() - new Date(a.stats.lastActivity).getTime()
        case 'oldest':
          return new Date(a.stats.lastActivity).getTime() - new Date(b.stats.lastActivity).getTime()
        case 'most_reactions':
          return b.stats.totalReactions - a.stats.totalReactions
        case 'threaded':
        default:
          return a.rootComment.timecode.seconds - b.rootComment.timecode.seconds
      }
    })
  }, [sortOption, expandedThreads, highlightedThread])

  /**
   * 필터링된 댓글 계산
   */
  const filteredComments = useMemo(() => {
    let filtered = [...threadedComments]

    // 해결됨 상태 필터
    if (!filterOptions.showResolved) {
      filtered = filtered.filter(c => !c.isResolved)
    }

    // 참여자 타입 필터
    if (filterOptions.participantType && filterOptions.participantType !== 'all') {
      filtered = filtered.filter(c => c.author.type === filterOptions.participantType)
    }

    // 시간 범위 필터
    if (filterOptions.timeRange) {
      const { start, end } = filterOptions.timeRange
      filtered = filtered.filter(c =>
        c.timecode.seconds >= start && c.timecode.seconds <= end
      )
    }

    // 버전 필터
    if (filterOptions.versionId) {
      filtered = filtered.filter(c => c.versionId === filterOptions.versionId)
    }

    // 첨부 파일 필터
    if (filterOptions.hasAttachments) {
      filtered = filtered.filter(c => c.attachments.length > 0)
    }

    // 반응 필터
    if (filterOptions.hasReactions) {
      filtered = filtered.filter(c => c.reactions.length > 0)
    }

    // 검색 쿼리 필터
    if (filterOptions.searchQuery) {
      const query = filterOptions.searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.content.toLowerCase().includes(query) ||
        c.author.name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [threadedComments, filterOptions])

  /**
   * 댓글 스레드 빌드
   */
  useEffect(() => {
    const threads = buildCommentThreads(filteredComments)
    setCommentThreads(threads)
  }, [filteredComments, buildCommentThreads])

  /**
   * 댓글 생성
   */
  const createComment = useCallback(async (
    content: string,
    options: CommentCreationOptions = {}
  ): Promise<ThreadedComment> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    if (content.trim().length === 0) {
      throw new Error('댓글 내용을 입력해주세요')
    }

    if (content.length > ThreadConstants.MAX_CONTENT_LENGTH) {
      throw new Error(`댓글은 최대 ${ThreadConstants.MAX_CONTENT_LENGTH}자까지 입력 가능합니다`)
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/feedback/comments/threaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          videoSlot: selectedVideoSlot,
          content: content.trim(),
          timecode: { seconds: currentTimecode },
          parentId: options.parentId,
          versionId: options.versionId,
          mentionUserIds: options.mentionUserIds || [],
          isPrivate: options.isPrivate || false,
          autoResolve: options.autoResolve || false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '댓글 작성에 실패했습니다')
      }

      const newComment: ThreadedComment = await response.json()

      // 첨부 파일 업로드
      if (options.attachments && options.attachments.length > 0) {
        for (const file of options.attachments) {
          await uploadAttachment(file, newComment.id)
        }
      }

      // 로컬 상태 업데이트
      setThreadedComments(prev => [...prev, newComment])

      // 새 스레드인 경우 자동 확장
      if (!options.parentId) {
        setExpandedThreads(prev => new Set(prev).add(newComment.id))
      }

      return newComment

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 작성에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [currentSession, selectedVideoSlot, currentTimecode])

  /**
   * 대댓글 작성
   */
  const replyToComment = useCallback(async (
    parentId: string,
    content: string,
    options: Omit<CommentCreationOptions, 'parentId'> = {}
  ): Promise<ThreadedComment> => {
    const parentComment = threadedComments.find(c => c.id === parentId)
    if (!parentComment) {
      throw new Error('부모 댓글을 찾을 수 없습니다')
    }

    // 깊이 제한 확인
    if (parentComment.depth >= ThreadConstants.MAX_DEPTH) {
      throw new Error(`최대 ${ThreadConstants.MAX_DEPTH}단계까지만 대댓글을 작성할 수 있습니다`)
    }

    return createComment(content, { ...options, parentId })
  }, [threadedComments, createComment])

  /**
   * 댓글 수정
   */
  const editComment = useCallback(async (commentId: string, content: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    const comment = threadedComments.find(c => c.id === commentId)
    if (!comment) {
      throw new Error('댓글을 찾을 수 없습니다')
    }

    // 수정 권한 확인
    if (!canEdit(commentId)) {
      throw new Error('댓글을 수정할 권한이 없습니다')
    }

    try {
      const response = await fetch(`/api/feedback/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          content: content.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '댓글 수정에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setThreadedComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, content: content.trim(), updatedAt: new Date() }
            : c
        )
      )

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 수정에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession, threadedComments])

  /**
   * 댓글 삭제
   */
  const deleteComment = useCallback(async (commentId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    // 삭제 권한 확인
    if (!canDelete(commentId)) {
      throw new Error('댓글을 삭제할 권한이 없습니다')
    }

    try {
      const response = await fetch(`/api/feedback/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '댓글 삭제에 실패했습니다')
      }

      // 로컬 상태 업데이트 (연관된 대댓글도 함께 삭제)
      const comment = threadedComments.find(c => c.id === commentId)
      if (comment) {
        const threadId = comment.depth === 0 ? comment.id : comment.threadId
        setThreadedComments(prev =>
          prev.filter(c => c.id !== commentId && c.threadId !== threadId)
        )
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 삭제에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 댓글 해결
   */
  const resolveComment = useCallback(async (commentId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '댓글 해결에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setThreadedComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, isResolved: true, updatedAt: new Date() }
            : c
        )
      )

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 해결에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 댓글 해결 취소
   */
  const unresolveComment = useCallback(async (commentId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/comments/${commentId}/unresolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '댓글 해결 취소에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setThreadedComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, isResolved: false, updatedAt: new Date() }
            : c
        )
      )

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 해결 취소에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 감정 반응 추가
   */
  const addReaction = useCallback(async (
    commentId: string,
    type: EmotionType
  ): Promise<EmotionReactionExtended> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch('/api/feedback/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          commentId,
          type
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '반응 추가에 실패했습니다')
      }

      const newReaction: EmotionReactionExtended = await response.json()

      // 로컬 상태 업데이트
      setThreadedComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, reactions: [...c.reactions, newReaction] }
            : c
        )
      )

      return newReaction

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '반응 추가에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 감정 반응 제거
   */
  const removeReaction = useCallback(async (
    commentId: string,
    type: EmotionType
  ): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/reactions/${commentId}/${type}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '반응 제거에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setThreadedComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, reactions: c.reactions.filter(r => r.type !== type) }
            : c
        )
      )

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '반응 제거에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 댓글의 반응 조회
   */
  const getCommentReactions = useCallback((commentId: string): EmotionReactionExtended[] => {
    const comment = threadedComments.find(c => c.id === commentId)
    return comment ? comment.reactions : []
  }, [threadedComments])

  /**
   * 스레드 확장/축소
   */
  const expandThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => new Set(prev).add(threadId))
  }, [])

  const collapseThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev)
      newSet.delete(threadId)
      return newSet
    })
  }, [])

  /**
   * 스레드 하이라이트
   */
  const highlightThread = useCallback((threadId: string) => {
    setHighlightedThread(threadId)
    setTimeout(() => setHighlightedThread(null), 3000) // 3초 후 자동 해제
  }, [])

  /**
   * 스레드로 이동
   */
  const jumpToThread = useCallback((threadId: string) => {
    const element = document.querySelector(`[data-thread-id="${threadId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightThread(threadId)
    }
  }, [highlightThread])

  /**
   * 필터 적용
   */
  const applyFilter = useCallback((options: Partial<CommentFilterOptions>) => {
    setFilterOptions(prev => ({ ...prev, ...options }))
  }, [])

  /**
   * 검색
   */
  const searchComments = useCallback((query: string) => {
    setFilterOptions(prev => ({ ...prev, searchQuery: query }))
  }, [])

  /**
   * 필터 초기화
   */
  const clearFilters = useCallback(() => {
    setFilterOptions({ showResolved: true })
  }, [])

  /**
   * 첨부 파일 업로드
   */
  const uploadAttachment = useCallback(async (
    file: File,
    commentId?: string
  ): Promise<CommentAttachment> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('sessionId', currentSession.id)
    if (commentId) formData.append('commentId', commentId)

    try {
      const response = await fetch('/api/feedback/attachments', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '첨부 파일 업로드에 실패했습니다')
      }

      return await response.json()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '첨부 파일 업로드에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 첨부 파일 제거
   */
  const removeAttachment = useCallback(async (attachmentId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '첨부 파일 삭제에 실패했습니다')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '첨부 파일 삭제에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 사용자 멘션
   */
  const mentionUser = useCallback(async (userId: string, commentId: string): Promise<void> => {
    // TODO: 멘션 알림 전송 구현
  }, [])

  /**
   * 멘션 제안 조회
   */
  const getMentionSuggestions = useCallback(async (query: string) => {
    if (!currentSession) return []

    try {
      const response = await fetch(`/api/feedback/sessions/${currentSession.id}/participants?search=${encodeURIComponent(query)}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (err) {
      console.error('멘션 제안 조회 실패:', err)
    }

    return []
  }, [currentSession])

  /**
   * 유틸리티 함수들
   */
  const getThreadDepth = useCallback((commentId: string): number => {
    const comment = threadedComments.find(c => c.id === commentId)
    return comment ? comment.depth : 0
  }, [threadedComments])

  const canReply = useCallback((commentId: string): boolean => {
    const depth = getThreadDepth(commentId)
    return depth < ThreadConstants.MAX_DEPTH
  }, [getThreadDepth])

  const canEdit = useCallback((commentId: string): boolean => {
    const comment = threadedComments.find(c => c.id === commentId)
    if (!comment) return false

    // 작성자만 수정 가능
    // TODO: 현재 사용자 ID 확인 로직 추가
    return true
  }, [threadedComments])

  const canDelete = useCallback((commentId: string): boolean => {
    const comment = threadedComments.find(c => c.id === commentId)
    if (!comment) return false

    // 작성자 또는 관리자만 삭제 가능
    // TODO: 권한 확인 로직 추가
    return true
  }, [threadedComments])

  /**
   * 댓글 내보내기
   */
  const exportComments = useCallback(async (format: 'json' | 'csv' | 'pdf'): Promise<Blob> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/sessions/${currentSession.id}/export?format=${format}`)

      if (!response.ok) {
        throw new Error('댓글 내보내기에 실패했습니다')
      }

      return await response.blob()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '댓글 내보내기에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 세션 변경 시 댓글 로드
   */
  useEffect(() => {
    if (currentSession) {
      loadThreadedComments(currentSession.id)
    }
  }, [currentSession])

  /**
   * 스레드 댓글 로드 (비동기)
   */
  const loadThreadedComments = async (sessionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/feedback/sessions/${sessionId}/comments/threaded`)
      if (response.ok) {
        const comments: ThreadedComment[] = await response.json()
        setThreadedComments(comments)
      }
    } catch (err) {
      setError('댓글 로드에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    // 댓글 스레드
    commentThreads,
    flatComments: filteredComments,
    totalComments: threadedComments.length,
    totalThreads: commentThreads.length,

    // 현재 상태
    isLoading,
    isSubmitting,
    error,

    // 댓글 CRUD
    createComment,
    replyToComment,
    editComment,
    deleteComment,
    resolveComment,
    unresolveComment,

    // 감정 반응
    addReaction,
    removeReaction,
    getCommentReactions,

    // 스레드 관리
    expandThread,
    collapseThread,
    highlightThread,
    jumpToThread,

    // 필터링 및 정렬
    applyFilter,
    setSortOption,
    searchComments,
    clearFilters,

    // 첨부 파일
    uploadAttachment,
    removeAttachment,

    // 멘션
    mentionUser,
    getMentionSuggestions,

    // 유틸리티
    getThreadDepth,
    canReply,
    canEdit,
    canDelete,
    exportComments
  }
}