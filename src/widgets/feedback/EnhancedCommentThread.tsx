/**
 * Enhanced Comment Thread Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * 스레드 댓글, 대댓글, 감정표현을 지원하는 향상된 댓글 시스템 UI
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useEnhancedComments } from '../../features/video-feedback/hooks/useEnhancedComments'
import {
  type ThreadedComment,
  type CommentThread,
  type EmotionType,
  type EmotionReactionExtended,
  ThreadConstants
} from '../../entities/feedback'

/**
 * 감정 반응 버튼 Props
 */
interface EmotionButtonProps {
  readonly type: EmotionType
  readonly count: number
  readonly isActive: boolean
  readonly onClick: () => void
  readonly disabled?: boolean
}

/**
 * 감정 반응 버튼 컴포넌트
 */
function EmotionButton({ type, count, isActive, onClick, disabled = false }: EmotionButtonProps) {
  const getEmotionIcon = useCallback((type: EmotionType) => {
    switch (type) {
      case 'like':
        return '👍'
      case 'dislike':
        return '👎'
      case 'confused':
        return '🤔'
      default:
        return '👍'
    }
  }, [])

  const getEmotionLabel = useCallback((type: EmotionType) => {
    switch (type) {
      case 'like':
        return '좋아요'
      case 'dislike':
        return '싫어요'
      case 'confused':
        return '모호해요'
      default:
        return '좋아요'
    }
  }, [])

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
    >
      <span>{getEmotionIcon(type)}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

/**
 * 댓글 첨부 파일 Props
 */
interface CommentAttachmentProps {
  readonly attachment: {
    readonly id: string
    readonly type: 'screenshot' | 'file' | 'link'
    readonly url: string
    readonly filename: string
    readonly thumbnailUrl?: string
  }
  readonly onRemove?: () => void
  readonly canRemove?: boolean
}

/**
 * 댓글 첨부 파일 컴포넌트
 */
function CommentAttachment({ attachment, onRemove, canRemove = false }: CommentAttachmentProps) {
  const handleClick = useCallback(() => {
    window.open(attachment.url, '_blank')
  }, [attachment.url])

  return (
    <div className="
      relative group bg-gray-800 rounded-lg p-2
      border border-gray-700 hover:border-gray-600
      transition-colors duration-150
    ">
      {/* 제거 버튼 */}
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="
            absolute -top-2 -right-2 w-6 h-6
            bg-red-600 hover:bg-red-700 rounded-full
            flex items-center justify-center
            opacity-0 group-hover:opacity-100
            transition-opacity duration-150
          "
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div
        onClick={handleClick}
        className="cursor-pointer"
      >
        {/* 스크린샷 첨부 */}
        {attachment.type === 'screenshot' && attachment.thumbnailUrl && (
          <div className="space-y-2">
            <img
              src={attachment.thumbnailUrl}
              alt={attachment.filename}
              className="w-full h-20 object-cover rounded"
            />
            <div className="text-xs text-gray-400 truncate">
              {attachment.filename}
            </div>
          </div>
        )}

        {/* 파일 첨부 */}
        {attachment.type === 'file' && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-xs text-gray-300 truncate">
              {attachment.filename}
            </span>
          </div>
        )}

        {/* 링크 첨부 */}
        {attachment.type === 'link' && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-xs text-blue-300 truncate">
              {attachment.filename}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 댓글 입력 폼 Props
 */
interface CommentFormProps {
  readonly parentId?: string
  readonly onSubmit: (content: string) => void
  readonly onCancel: () => void
  readonly placeholder?: string
  readonly autoFocus?: boolean
  readonly disabled?: boolean
}

/**
 * 댓글 입력 폼 컴포넌트
 */
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
        maxLength={ThreadConstants.MAX_CONTENT_LENGTH}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {content.length}/{ThreadConstants.MAX_CONTENT_LENGTH}
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
 * 단일 댓글 Props
 */
interface CommentItemProps {
  readonly comment: ThreadedComment
  readonly canReply: boolean
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly onReply: (parentId: string, content: string) => void
  readonly onEdit: (commentId: string, content: string) => void
  readonly onDelete: (commentId: string) => void
  readonly onResolve: (commentId: string) => void
  readonly onUnresolve: (commentId: string) => void
  readonly onReaction: (commentId: string, type: EmotionType) => void
  readonly isHighlighted?: boolean
}

/**
 * 단일 댓글 컴포넌트
 */
function CommentItem({
  comment,
  canReply,
  canEdit,
  canDelete,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReaction,
  isHighlighted = false
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)

  // 반응 집계
  const reactionCounts = comment.reactions.reduce((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1
    return acc
  }, {} as Record<EmotionType, number>)

  // 현재 사용자의 반응 (TODO: 실제 사용자 ID 구현)
  const userReactions = comment.reactions.filter(r => r.userId === 'current-user')

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

  const formatTimeAgo = useCallback((date: Date) => {
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
        ${comment.depth > 0 ? 'ml-8' : ''}
      `}
      style={{ marginLeft: `${comment.depth * 2}rem` }}
    >
      <div className="pl-4 py-3">
        {/* 댓글 헤더 */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
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
            <span className="
              px-2 py-0.5 bg-gray-700 rounded text-xs
              font-mono text-blue-300
            ">
              {comment.timecode.formatted}
            </span>

            {/* 해결됨 표시 */}
            {comment.isResolved && (
              <span className="
                px-2 py-0.5 bg-green-600/20 border border-green-500/30
                rounded text-xs text-green-400
              ">
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
          <div className="flex items-center gap-1">
            {comment.isResolved ? (
              <button
                onClick={() => onUnresolve(comment.id)}
                className="
                  p-1 text-gray-400 hover:text-white
                  transition-colors duration-150
                "
                title="해결 취소"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => onResolve(comment.id)}
                className="
                  p-1 text-gray-400 hover:text-green-400
                  transition-colors duration-150
                "
                title="해결 완료"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="
                  p-1 text-gray-400 hover:text-white
                  transition-colors duration-150
                "
                title="수정"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="
                  p-1 text-gray-400 hover:text-red-400
                  transition-colors duration-150
                "
                title="삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
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

        {/* 첨부 파일 */}
        {comment.attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {comment.attachments.map(attachment => (
              <CommentAttachment
                key={attachment.id}
                attachment={attachment}
                canRemove={canEdit}
              />
            ))}
          </div>
        )}

        {/* 반응 및 액션 */}
        <div className="flex items-center justify-between">
          {/* 감정 반응 */}
          <div className="flex items-center gap-2">
            {(['like', 'dislike', 'confused'] as EmotionType[]).map(type => (
              <EmotionButton
                key={type}
                type={type}
                count={reactionCounts[type] || 0}
                isActive={userReactions.some(r => r.type === type)}
                onClick={() => handleReaction(type)}
              />
            ))}
          </div>

          {/* 답글 버튼 */}
          {canReply && (
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="
                px-3 py-1 text-xs text-gray-400 hover:text-white
                transition-colors duration-150
              "
            >
              답글
            </button>
          )}
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
      </div>
    </div>
  )
}

/**
 * 메인 향상된 댓글 스레드 컴포넌트
 */
export function EnhancedCommentThread() {
  const enhancedComments = useEnhancedComments()

  const handleReply = useCallback(async (parentId: string, content: string) => {
    await enhancedComments.replyToComment(parentId, content)
  }, [enhancedComments])

  const handleEdit = useCallback(async (commentId: string, content: string) => {
    await enhancedComments.editComment(commentId, content)
  }, [enhancedComments])

  const handleDelete = useCallback(async (commentId: string) => {
    if (confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
      await enhancedComments.deleteComment(commentId)
    }
  }, [enhancedComments])

  const handleResolve = useCallback(async (commentId: string) => {
    await enhancedComments.resolveComment(commentId)
  }, [enhancedComments])

  const handleUnresolve = useCallback(async (commentId: string) => {
    await enhancedComments.unresolveComment(commentId)
  }, [enhancedComments])

  const handleReaction = useCallback(async (commentId: string, type: EmotionType) => {
    const reactions = enhancedComments.getCommentReactions(commentId)
    const userReaction = reactions.find(r => r.userId === 'current-user' && r.type === type)

    if (userReaction) {
      await enhancedComments.removeReaction(commentId, type)
    } else {
      await enhancedComments.addReaction(commentId, type)
    }
  }, [enhancedComments])

  if (enhancedComments.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        <span className="ml-2 text-gray-400">댓글을 불러오는 중...</span>
      </div>
    )
  }

  if (enhancedComments.commentThreads.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        아직 댓글이 없습니다.
        <br />
        첫 번째 댓글을 작성해보세요!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          댓글 ({enhancedComments.totalComments})
        </h3>
        <div className="text-sm text-gray-400">
          {enhancedComments.totalThreads}개 스레드
        </div>
      </div>

      {/* 댓글 스레드 목록 */}
      <div className="space-y-6">
        {enhancedComments.commentThreads.map(thread => (
          <div
            key={thread.rootComment.id}
            data-thread-id={thread.rootComment.id}
            className="
              bg-gray-900/50 rounded-lg border border-gray-700
              hover:border-gray-600 transition-colors duration-150
            "
          >
            {/* 루트 댓글 */}
            <CommentItem
              comment={thread.rootComment}
              canReply={enhancedComments.canReply(thread.rootComment.id)}
              canEdit={enhancedComments.canEdit(thread.rootComment.id)}
              canDelete={enhancedComments.canDelete(thread.rootComment.id)}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onResolve={handleResolve}
              onUnresolve={handleUnresolve}
              onReaction={handleReaction}
              isHighlighted={thread.isHighlighted}
            />

            {/* 답글들 */}
            {thread.isExpanded && thread.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                canReply={enhancedComments.canReply(reply.id)}
                canEdit={enhancedComments.canEdit(reply.id)}
                canDelete={enhancedComments.canDelete(reply.id)}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onResolve={handleResolve}
                onUnresolve={handleUnresolve}
                onReaction={handleReaction}
              />
            ))}

            {/* 답글 접기/펼치기 */}
            {thread.replies.length > 0 && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => {
                    if (thread.isExpanded) {
                      enhancedComments.collapseThread(thread.rootComment.id)
                    } else {
                      enhancedComments.expandThread(thread.rootComment.id)
                    }
                  }}
                  className="
                    text-sm text-blue-400 hover:text-blue-300
                    transition-colors duration-150
                  "
                >
                  {thread.isExpanded
                    ? `답글 ${thread.replies.length}개 숨기기`
                    : `답글 ${thread.replies.length}개 보기`
                  }
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 에러 상태 */}
      {enhancedComments.error && (
        <div className="
          bg-red-600/20 border border-red-500/30 rounded-lg
          px-4 py-3 text-red-400 text-sm
        ">
          {enhancedComments.error}
        </div>
      )}
    </div>
  )
}