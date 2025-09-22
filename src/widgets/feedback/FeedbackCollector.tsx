/**
 * FeedbackCollector Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * 특정 타임코드에 감정 피드백 및 텍스트 댓글을 입력하는 UI
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectCurrentTimecode,
  selectSelectedVideoSlot,
  selectCurrentSession,
  selectIsSubmitting,
  createComment,
  createReaction
} from '../../entities/feedback'
import { useTimecodeFeedback } from '../../features/video-feedback/hooks/useTimecodeFeedback'
import type { EmotionType, Timecode, CreateCommentRequest, CreateReactionRequest } from '../../entities/feedback'

/**
 * 감정 아이콘 매핑
 */
const EMOTION_ICONS: Record<EmotionType, { icon: string; label: string; color: string }> = {
  like: { icon: '👍', label: '좋아요', color: 'text-green-600' },
  dislike: { icon: '👎', label: '싫어요', color: 'text-red-600' },
  confused: { icon: '🤔', label: '혼란스러움', color: 'text-yellow-600' }
} as const

/**
 * 추가 감정 반응 (확장)
 */
const EXTENDED_EMOTIONS = [
  { type: 'love' as const, icon: '😍', label: '사랑해요', color: 'text-pink-600' },
  { type: 'laugh' as const, icon: '😂', label: '웃겨요', color: 'text-blue-600' },
  { type: 'wow' as const, icon: '😮', label: '놀라워요', color: 'text-purple-600' },
  { type: 'sad' as const, icon: '😢', label: '슬퍼요', color: 'text-blue-500' },
  { type: 'angry' as const, icon: '😠', label: '화나요', color: 'text-red-700' },
  { type: 'sleepy' as const, icon: '😴', label: '지루해요', color: 'text-gray-600' }
] as const

/**
 * FeedbackCollector Props
 */
interface FeedbackCollectorProps {
  /** 현재 타임코드 (선택사항, 없으면 자동으로 현재 재생 시점 사용) */
  readonly timecode?: number

  /** 강제 타임코드 모드 (타임코드 수정 불가) */
  readonly lockTimecode?: boolean

  /** 익명/실명 선택 허용 */
  readonly allowAnonymous?: boolean

  /** 기본 익명 상태 */
  readonly defaultAnonymous?: boolean

  /** 부모 댓글 ID (대댓글인 경우) */
  readonly parentCommentId?: string

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 간소화된 UI (감정 반응만) */
  readonly emotionOnly?: boolean

  /** 확장 감정 사용 */
  readonly useExtendedEmotions?: boolean

  /** 댓글 작성 완료 콜백 */
  readonly onCommentSubmit?: (commentId: string) => void

  /** 감정 반응 완료 콜백 */
  readonly onReactionSubmit?: (reactionId: string) => void

  /** 취소 콜백 */
  readonly onCancel?: () => void

  /** 오류 콜백 */
  readonly onError?: (error: string) => void
}

/**
 * FeedbackCollector 컴포넌트
 */
export function FeedbackCollector(props: FeedbackCollectorProps) {
  const {
    timecode,
    lockTimecode = false,
    allowAnonymous = true,
    defaultAnonymous = false,
    parentCommentId,
    className = '',
    'aria-label': ariaLabel = '피드백 입력',
    emotionOnly = false,
    useExtendedEmotions = false,
    onCommentSubmit,
    onReactionSubmit,
    onCancel,
    onError
  } = props

  // Redux 상태
  const dispatch = useDispatch()
  const currentTimecode = useSelector(selectCurrentTimecode)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const currentSession = useSelector(selectCurrentSession)
  const isSubmitting = useSelector(selectIsSubmitting)

  // 로컬 상태
  const [commentText, setCommentText] = useState('')
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | null>(null)
  const [customTimecode, setCustomTimecode] = useState<number>(timecode || currentTimecode)
  const [isAnonymous, setIsAnonymous] = useState(defaultAnonymous)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 훅
  const timecodeFeedback = useTimecodeFeedback()

  // 실제 사용할 타임코드
  const effectiveTimecode = useMemo(() => {
    return timecode || customTimecode
  }, [timecode, customTimecode])

  // 감정 목록
  const availableEmotions = useMemo(() => {
    const basic = Object.entries(EMOTION_ICONS).map(([type, config]) => ({
      type: type as EmotionType,
      ...config
    }))

    if (useExtendedEmotions) {
      return [...basic, ...EXTENDED_EMOTIONS]
    }
    return basic
  }, [useExtendedEmotions])

  // 타임코드 포맷팅
  const formatTimecode = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

  // 유효성 검증
  const isValidSubmission = useMemo(() => {
    if (emotionOnly) {
      return selectedEmotion !== null
    }
    return commentText.trim().length > 0 || selectedEmotion !== null
  }, [emotionOnly, commentText, selectedEmotion])

  /**
   * 댓글 제출
   */
  const handleCommentSubmit = useCallback(async () => {
    if (!currentSession || commentText.trim().length === 0) return

    const request: CreateCommentRequest = {
      sessionId: currentSession.metadata.id,
      videoSlot: selectedVideoSlot,
      timecode: {
        seconds: effectiveTimecode,
        formatted: formatTimecode(effectiveTimecode)
      },
      content: commentText.trim(),
      parentId: parentCommentId
    }

    try {
      setLocalError(null)
      const result = await dispatch(createComment(request)).unwrap()

      // 성공 처리
      setCommentText('')
      onCommentSubmit?.(result.id)

      // 포커스 이동
      textareaRef.current?.focus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '댓글 작성에 실패했습니다'
      setLocalError(errorMessage)
      onError?.(errorMessage)
    }
  }, [
    currentSession,
    commentText,
    selectedVideoSlot,
    effectiveTimecode,
    formatTimecode,
    parentCommentId,
    dispatch,
    onCommentSubmit,
    onError
  ])

  /**
   * 감정 반응 제출
   */
  const handleEmotionSubmit = useCallback(async (emotionType: EmotionType) => {
    if (!currentSession) return

    const request: CreateReactionRequest = {
      sessionId: currentSession.metadata.id,
      videoSlot: selectedVideoSlot,
      timecode: {
        seconds: effectiveTimecode,
        formatted: formatTimecode(effectiveTimecode)
      },
      type: emotionType
    }

    try {
      setLocalError(null)
      const result = await dispatch(createReaction(request)).unwrap()

      // 성공 처리
      setSelectedEmotion(emotionType)
      onReactionSubmit?.(result.id)

      // 감정만 모드인 경우 자동으로 선택 해제
      if (emotionOnly) {
        setTimeout(() => setSelectedEmotion(null), 1000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '반응 추가에 실패했습니다'
      setLocalError(errorMessage)
      onError?.(errorMessage)
    }
  }, [
    currentSession,
    selectedVideoSlot,
    effectiveTimecode,
    formatTimecode,
    dispatch,
    onReactionSubmit,
    onError,
    emotionOnly
  ])

  /**
   * 전체 피드백 제출
   */
  const handleSubmit = useCallback(async () => {
    if (!isValidSubmission || isSubmitting) return

    try {
      // 댓글과 감정 반응 모두 제출
      if (commentText.trim().length > 0) {
        await handleCommentSubmit()
      }

      if (selectedEmotion) {
        await handleEmotionSubmit(selectedEmotion)
      }
    } catch (error) {
      // 에러는 개별 함수에서 처리됨
    }
  }, [isValidSubmission, isSubmitting, commentText, selectedEmotion, handleCommentSubmit, handleEmotionSubmit])

  /**
   * 키보드 단축키 처리
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      handleSubmit()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel?.()
    }
  }, [handleSubmit, onCancel])

  /**
   * 타임코드 변경 동기화
   */
  useEffect(() => {
    if (!lockTimecode && !timecode) {
      setCustomTimecode(currentTimecode)
    }
  }, [currentTimecode, lockTimecode, timecode])

  /**
   * 자동 포커스
   */
  useEffect(() => {
    if (!emotionOnly && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [emotionOnly])

  if (!currentSession) {
    return (
      <div className="text-center text-gray-500 py-4">
        세션이 로드되지 않았습니다
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
      aria-label={ariaLabel}
      data-testid="feedback-collector"
    >
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-sm font-medium text-gray-900">
              피드백 추가
            </div>
            <div className="text-xs text-gray-500">
              {formatTimecode(effectiveTimecode)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 익명 토글 */}
            {allowAnonymous && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="anonymous-toggle"
                />
                <span className="text-gray-600">익명</span>
              </label>
            )}

            {/* 고급 옵션 토글 */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-500 hover:text-gray-700"
              data-testid="advanced-toggle"
            >
              고급 옵션
            </button>
          </div>
        </div>
      </div>

      {/* 고급 옵션 */}
      {showAdvanced && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="space-y-3">
            {/* 타임코드 수정 */}
            {!lockTimecode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  타임코드 조정
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentSession.videoSlots.find(s => s.slot === selectedVideoSlot)?.video?.duration || 3600}
                  step="0.1"
                  value={customTimecode}
                  onChange={(e) => setCustomTimecode(Number(e.target.value))}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  data-testid="timecode-input"
                />
                <span className="ml-2 text-sm text-gray-500">초</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 감정 반응 선택 */}
      <div className="px-4 py-3">
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-700 mb-2">감정 반응</div>
          <div className="flex flex-wrap gap-2">
            {availableEmotions.map((emotion) => (
              <button
                key={emotion.type}
                type="button"
                onClick={() => handleEmotionSubmit(emotion.type)}
                disabled={isSubmitting}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors ${
                  selectedEmotion === emotion.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                data-testid={`emotion-${emotion.type}`}
                title={emotion.label}
              >
                <span className="text-lg">{emotion.icon}</span>
                <span className={`text-sm ${emotion.color}`}>
                  {emotion.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 텍스트 댓글 입력 */}
      {!emotionOnly && (
        <div className="px-4 pb-3">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              댓글 {parentCommentId && '(답글)'}
            </label>
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={parentCommentId ? '답글을 입력하세요...' : '이 시점에 대한 피드백을 입력하세요...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              maxLength={2000}
              disabled={isSubmitting}
              data-testid="comment-textarea"
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-500">
                {commentText.length}/2000 • Ctrl+Enter로 제출
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 오류 메시지 */}
      {localError && (
        <div className="px-4 pb-3">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            {localError}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            data-testid="cancel-button"
          >
            취소
          </button>

          <div className="flex space-x-2">
            {!emotionOnly && (
              <button
                type="button"
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-comment-button"
              >
                {isSubmitting ? '제출 중...' : '댓글 작성'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}