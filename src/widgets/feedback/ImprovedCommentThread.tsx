/**
 * Improved Comment Thread Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * FRD.md 명세: 스레드 댓글 (3단계), 감정표현 3종, 해결/수정/삭제
 * 스레드 댓글, 대댓글, 감정표현을 지원하는 개선된 댓글 시스템 UI
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
// Hook imports removed - making component pure with props

// 타입 정의
interface Comment {
  id: string
  content: string
  author: {
    id: string
    name: string
    email: string
    avatar?: string
    type: 'owner' | 'member' | 'guest'
  }
  timecode: string
  createdAt: string
  updatedAt: string
  reactions: {
    thumbsUp: { count: number; userReacted: boolean }
    thumbsDown: { count: number; userReacted: boolean }
    confused: { count: number; userReacted: boolean }
  }
  status: 'open' | 'resolved'
  replies: Comment[]
  depth: number
  parentId?: string
}

type EmotionType = 'thumbsUp' | 'thumbsDown' | 'confused'
type SortBy = 'newest' | 'oldest' | 'reactions'
type FilterBy = 'all' | 'unresolved' | 'resolved'

/**
 * 감정 반응 버튼 컴포넌트
 */
interface EmotionButtonProps {
  readonly type: EmotionType
  readonly count: number
  readonly isActive: boolean
  readonly onClick: () => void
  readonly disabled?: boolean
}

function EmotionButton({ type, count, isActive, onClick, disabled = false }: EmotionButtonProps) {
  const getEmotionIcon = (type: EmotionType) => {
    switch (type) {
      case 'thumbsUp':
        return '👍'
      case 'thumbsDown':
        return '👎'
      case 'confused':
        return '🤔'
    }
  }

  const getEmotionLabel = (type: EmotionType) => {
    switch (type) {
      case 'thumbsUp':
        return '좋아요'
      case 'thumbsDown':
        return '싫어요'
      case 'confused':
        return '모호해요'
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-full text-xs
        transition-all duration-150
        ${isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={getEmotionLabel(type)}
      aria-label={`${getEmotionLabel(type)} ${count}개`}
    >
      <span>{getEmotionIcon(type)}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

/**
 * 댓글 입력 폼 컴포넌트
 */
interface CommentFormProps {
  readonly parentId?: string
  readonly onSubmit: (content: string) => void
  readonly onCancel: () => void
  readonly placeholder?: string
  readonly autoFocus?: boolean
  readonly disabled?: boolean
}

function CommentForm({
  parentId,
  onSubmit,
  onCancel,
  placeholder = '댓글을 입력하세요...',
  autoFocus = false,
  disabled = false
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(content.trim())
      setContent('')
    } catch (error) {
      console.error('댓글 작성 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [content, onSubmit, isSubmitting])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e as any)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }, [handleSubmit, onCancel])

  // 자동 높이 조절
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [content])

  // 자동 포커스
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className="
          w-full min-h-[80px] max-h-[200px] resize-none
          bg-gray-800 border border-gray-700 rounded-lg
          px-3 py-2 text-white text-sm
          placeholder-gray-400
          focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        maxLength={1000}
        data-testid={parentId ? "reply-textarea" : "comment-textarea"}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {content.length}/1000
          {parentId && ' • 대댓글'}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="
              px-3 py-1.5 text-sm text-gray-400 hover:text-white
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            취소
          </button>

          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="
              px-4 py-1.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-lg
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
            data-testid={parentId ? "reply-submit" : "comment-submit"}
          >
            {isSubmitting && (
              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{parentId ? '답글' : '댓글'} 작성</span>
            <span className="text-xs text-blue-200">Ctrl+Enter</span>
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * 단일 댓글 컴포넌트
 */
interface CommentItemProps {
  readonly comment: Comment
  readonly currentUserId: string
  readonly onReply: (parentId: string, content: string) => void
  readonly onEdit: (commentId: string, content: string) => void
  readonly onDelete: (commentId: string) => void
  readonly onResolve: (commentId: string) => void
  readonly onUnresolve: (commentId: string) => void
  readonly onReaction: (commentId: string, type: EmotionType) => void
  readonly isHighlighted?: boolean
  readonly maxDepth?: number
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReaction,
  isHighlighted = false,
  maxDepth = 3
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)

  // 권한 계산
  const canReply = comment.depth < maxDepth - 1
  const canEdit = comment.author.id === currentUserId
  const canDelete = comment.author.id === currentUserId
  const canResolve = true // 모든 사용자가 댓글을 해결할 수 있음

  const handleReplySubmit = useCallback(async (content: string) => {
    await onReply(comment.id, content)
    setIsReplying(false)
  }, [comment.id, onReply])

  const handleEditSubmit = useCallback(async (content: string) => {
    await onEdit(comment.id, content)
    setIsEditing(false)
  }, [comment.id, onEdit])

  const handleReaction = useCallback((type: EmotionType) => {
    onReaction(comment.id, type)
  }, [comment.id, onReaction])

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return '방금 전'
    if (diffMinutes < 60) return `${diffMinutes}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString()
  }, [])

  const getAuthorTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'owner':
        return 'text-yellow-400'
      case 'member':
        return 'text-blue-400'
      case 'guest':
        return 'text-gray-400'
      default:
        return 'text-gray-400'
    }
  }, [])

  return (
    <div
      className={`
        border-l-2 transition-all duration-300
        ${isHighlighted ? 'border-blue-500 bg-blue-600/10' : 'border-transparent'}
      `}
      style={{ marginLeft: `${Math.min(comment.depth * 2, 12)}rem` }}
      data-testid={`comment-${comment.depth > 0 ? 'reply' : 'item'}-${comment.id}`}
    >
      <div className="pl-4 py-3">
        {/* 댓글 헤더 */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 작성자 아바타 */}
            {comment.author.avatar ? (
              <img
                src={comment.author.avatar}
                alt={`${comment.author.name} 아바타`}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
                {comment.author.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* 작성자 정보 */}
            <span className={`font-medium ${getAuthorTypeColor(comment.author.type)}`}>
              {comment.author.name}
            </span>
            <span className="text-xs text-gray-500">
              {comment.author.type}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">
              {formatTimeAgo(comment.createdAt)}
            </span>

            {/* 타임코드 */}
            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs font-mono text-blue-300">
              {comment.timecode}
            </span>

            {/* 해결됨 표시 */}
            {comment.status === 'resolved' && (
              <span className="px-2 py-0.5 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400">
                해결됨
              </span>
            )}

            {/* 수정됨 표시 */}
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <span className="text-xs text-gray-500">
                (수정됨)
              </span>
            )}
          </div>

          {/* 액션 메뉴 */}
          <div className="relative">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-1 text-gray-400 hover:text-white transition-colors duration-150"
              title="더보기"
              aria-label={`${comment.author.name} 댓글 더보기`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>

            {/* 드롭다운 메뉴 */}
            {showMoreActions && (
              <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                <div className="py-1">
                  {comment.status === 'resolved' ? (
                    <button
                      onClick={() => {
                        onUnresolve(comment.id)
                        setShowMoreActions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      해결 취소
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onResolve(comment.id)
                        setShowMoreActions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      data-testid="resolve-comment"
                    >
                      해결됨으로 표시
                    </button>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsEditing(!isEditing)
                        setShowMoreActions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      수정
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm('정말로 이 댓글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                          onDelete(comment.id)
                        }
                        setShowMoreActions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                      data-testid="delete-comment"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 댓글 내용 */}
        {isEditing ? (
          <CommentForm
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditing(false)}
            placeholder="댓글을 수정하세요..."
            autoFocus
          />
        ) : (
          <div className="text-white text-sm mb-3 whitespace-pre-wrap">
            {comment.content}
          </div>
        )}

        {/* 반응 및 액션 */}
        <div className="flex items-center justify-between">
          {/* 감정 반응 */}
          <div className="flex items-center gap-2">
            <EmotionButton
              type="thumbsUp"
              count={comment.reactions.thumbsUp.count}
              isActive={comment.reactions.thumbsUp.userReacted}
              onClick={() => handleReaction('thumbsUp')}
            />
            <EmotionButton
              type="thumbsDown"
              count={comment.reactions.thumbsDown.count}
              isActive={comment.reactions.thumbsDown.userReacted}
              onClick={() => handleReaction('thumbsDown')}
            />
            <EmotionButton
              type="confused"
              count={comment.reactions.confused.count}
              isActive={comment.reactions.confused.userReacted}
              onClick={() => handleReaction('confused')}
            />
          </div>

          {/* 답글 버튼 */}
          <div className="flex items-center gap-2">
            {canReply ? (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors duration-150"
                title={`최대 ${maxDepth}단계까지 답글 가능`}
              >
                답글 {comment.depth < maxDepth - 1 ? `(${maxDepth - 1 - comment.depth}단계 더 가능)` : ''}
              </button>
            ) : (
              <span className="px-3 py-1 text-xs text-gray-500">
                최대 답글 깊이에 도달했습니다
              </span>
            )}
          </div>
        </div>

        {/* 답글 입력 폼 */}
        {isReplying && (
          <div className="mt-4">
            <CommentForm
              parentId={comment.id}
              onSubmit={handleReplySubmit}
              onCancel={() => setIsReplying(false)}
              placeholder="답글을 입력하세요..."
              autoFocus
            />
          </div>
        )}

        {/* 대댓글 목록 */}
        {comment.replies.length > 0 && (
          <div className="mt-4 space-y-2">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onResolve={onResolve}
                onUnresolve={onUnresolve}
                onReaction={onReaction}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 메인 개선된 댓글 스레드 컴포넌트
 */
interface ImprovedCommentThreadProps {
  readonly versionId: string
  readonly currentTimecode?: string
}

export function ImprovedCommentThread({ versionId, currentTimecode }: ImprovedCommentThreadProps) {
  const commentThread = useCommentThread(versionId)
  const { user } = useAuth()
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')

  // 실시간 알림 헬퍼
  const showLiveMessage = useCallback((message: string) => {
    setLiveMessage(message)
    setTimeout(() => setLiveMessage(''), 3000)
  }, [])

  const handleCreateComment = useCallback(async (content: string) => {
    try {
      await commentThread.addComment({
        content,
        timecode: currentTimecode
      })
      setShowCreateForm(false)
      showLiveMessage('댓글이 작성되었습니다')
    } catch (error) {
      console.error('댓글 작성 실패:', error)
      showLiveMessage('댓글 작성에 실패했습니다')
    }
  }, [commentThread, currentTimecode, showLiveMessage])

  const handleReply = useCallback(async (parentId: string, content: string) => {
    try {
      await commentThread.addReply(parentId, {
        content,
        timecode: currentTimecode
      })
      showLiveMessage('답글이 작성되었습니다')
    } catch (error) {
      console.error('답글 작성 실패:', error)
      showLiveMessage('답글 작성에 실패했습니다')
    }
  }, [commentThread, currentTimecode, showLiveMessage])

  const handleEdit = useCallback(async (commentId: string, content: string) => {
    try {
      await commentThread.updateComment(commentId, { content })
      showLiveMessage('댓글이 수정되었습니다')
    } catch (error) {
      console.error('댓글 수정 실패:', error)
      showLiveMessage('댓글 수정에 실패했습니다')
    }
  }, [commentThread, showLiveMessage])

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await commentThread.deleteComment(commentId)
      showLiveMessage('댓글이 삭제되었습니다')
    } catch (error) {
      console.error('댓글 삭제 실패:', error)
      showLiveMessage('댓글 삭제에 실패했습니다')
    }
  }, [commentThread, showLiveMessage])

  const handleResolve = useCallback(async (commentId: string) => {
    try {
      await commentThread.resolveComment(commentId)
      showLiveMessage('댓글이 해결됨으로 표시되었습니다')
    } catch (error) {
      console.error('댓글 해결 실패:', error)
      showLiveMessage('댓글 해결에 실패했습니다')
    }
  }, [commentThread, showLiveMessage])

  const handleUnresolve = useCallback(async (commentId: string) => {
    try {
      await commentThread.reopenComment(commentId)
      showLiveMessage('댓글이 다시 열렸습니다')
    } catch (error) {
      console.error('댓글 재열기 실패:', error)
      showLiveMessage('댓글 재열기에 실패했습니다')
    }
  }, [commentThread, showLiveMessage])

  const handleReaction = useCallback(async (commentId: string, type: EmotionType) => {
    try {
      // 기존 반응 확인
      const comment = commentThread.comments.find(c => c.id === commentId)
      const existingReaction = comment?.reactions[type]?.userReacted

      if (existingReaction) {
        await commentThread.removeReaction(commentId, type)
      } else {
        await commentThread.addReaction(commentId, type)
      }
    } catch (error) {
      console.error('반응 추가/제거 실패:', error)
      showLiveMessage('반응 처리에 실패했습니다')
    }
  }, [commentThread, showLiveMessage])

  // 정렬된 댓글 목록
  const sortedComments = useCallback(() => {
    let filtered = commentThread.comments || []

    // 필터링
    if (filterBy === 'unresolved') {
      filtered = filtered.filter(c => c.status === 'open')
    } else if (filterBy === 'resolved') {
      filtered = filtered.filter(c => c.status === 'resolved')
    }

    // 정렬
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'reactions':
          const aReactions = Object.values(a.reactions).reduce((sum, r) => sum + r.count, 0)
          const bReactions = Object.values(b.reactions).reduce((sum, r) => sum + r.count, 0)
          return bReactions - aReactions
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
  }, [commentThread.comments, sortBy, filterBy])

  if (commentThread.isLoading) {
    return (
      <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        <span className="ml-2 text-gray-400">댓글을 불러오는 중...</span>
      </div>
    )
  }

  if (commentThread.error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4" role="alert">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">댓글을 불러올 수 없습니다</span>
        </div>
        <p className="text-red-300 text-sm mb-3">{commentThread.error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const comments = sortedComments()

  if (comments.length === 0 && !showCreateForm) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <div className="text-lg font-medium mb-2">아직 댓글이 없습니다</div>
          <div className="text-sm">첫 번째 댓글을 작성해보세요!</div>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            댓글 작성하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 실시간 알림 */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          댓글 ({comments.length})
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          data-testid="toggle-comment-form"
        >
          {showCreateForm ? '취소' : '댓글 작성'}
        </button>
      </div>

      {/* 정렬 및 필터 */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">정렬:</span>
            <div className="flex gap-1">
              {(['newest', 'oldest', 'reactions'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    sortBy === option
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {option === 'newest' && '최신순'}
                  {option === 'oldest' && '오래된순'}
                  {option === 'reactions' && '반응순'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">필터:</span>
            <div className="flex gap-1">
              {(['all', 'unresolved', 'resolved'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setFilterBy(option)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    filterBy === option
                      ? 'bg-green-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {option === 'all' && '전체'}
                  {option === 'unresolved' && '미해결'}
                  {option === 'resolved' && '해결됨'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {filterBy === 'unresolved' && `미해결 ${comments.filter(c => c.status === 'open').length}개`}
          {filterBy === 'resolved' && `해결됨 ${comments.filter(c => c.status === 'resolved').length}개`}
          {filterBy === 'all' && `전체 ${comments.length}개`}
        </div>
      </div>

      {/* 댓글 작성 폼 */}
      {showCreateForm && user && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <CommentForm
            onSubmit={handleCreateComment}
            onCancel={() => setShowCreateForm(false)}
            placeholder={currentTimecode ? `${currentTimecode}에서 댓글 작성...` : '댓글을 입력하세요...'}
            autoFocus
          />
        </div>
      )}

      {/* 댓글 목록 */}
      <div role="list" aria-label="댓글 목록" className="space-y-4">
        {comments.map(comment => (
          <div
            key={comment.id}
            role="listitem"
            className="bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors duration-150"
          >
            <CommentItem
              comment={comment}
              currentUserId={user?.id || ''}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onResolve={handleResolve}
              onUnresolve={handleUnresolve}
              onReaction={handleReaction}
              maxDepth={3}
            />
          </div>
        ))}
      </div>

      {/* 빈 상태 메시지 */}
      {comments.length === 0 && filterBy !== 'all' && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-lg font-medium mb-2">
            {filterBy === 'unresolved' && '미해결 댓글이 없습니다'}
            {filterBy === 'resolved' && '해결된 댓글이 없습니다'}
          </div>
          <div className="text-sm">
            다른 필터를 선택해보세요.
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {liveMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg shadow-lg transform transition-all duration-300">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{liveMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// 현재 활성 버전 표시를 위한 스크린 리더 전용 텍스트
ImprovedCommentThread.displayName = 'ImprovedCommentThread'