/**
 * Feedback Domain Validation Rules
 *
 * CLAUDE.md 준수: entities 레이어 비즈니스 규칙 검증
 * 피드백 도메인의 핵심 비즈니스 규칙과 검증 로직
 */

import {
  type Timecode,
  type FeedbackParticipant,
  type FeedbackSessionMetadata,
  type CreateCommentRequest,
  type CreateReactionRequest,
  type UploadVideoRequest,
  FeedbackConstants
} from './types'

/**
 * 검증 결과
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly errors: string[]
  readonly warnings?: string[]
}

/**
 * 타임코드 검증
 */
export function validateTimecode(timecode: Timecode, videoDuration: number): ValidationResult {
  const errors: string[] = []

  if (timecode.seconds < 0) {
    errors.push('타임코드는 0초 이상이어야 합니다')
  }

  if (timecode.seconds > videoDuration) {
    errors.push(`타임코드는 영상 길이(${videoDuration}초)를 초과할 수 없습니다`)
  }

  if (timecode.seconds % FeedbackConstants.TIMECODE_PRECISION !== 0) {
    errors.push(`타임코드는 ${FeedbackConstants.TIMECODE_PRECISION}초 단위여야 합니다`)
  }

  // 포맷 검증
  const timePattern = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/
  if (!timePattern.test(timecode.formatted)) {
    errors.push('타임코드 형식이 올바르지 않습니다 (MM:SS 또는 HH:MM:SS)')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 파일 업로드 검증
 */
export function validateVideoUpload(request: UploadVideoRequest): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 파일 크기 검증
  if (request.file.size <= 0) {
    errors.push('파일이 비어있습니다')
  } else if (request.file.size > FeedbackConstants.MAX_FILE_SIZE) {
    errors.push(`파일 크기가 최대 제한(${FeedbackConstants.MAX_FILE_SIZE / 1024 / 1024}MB)을 초과합니다`)
  }

  // 파일 형식 검증
  const extension = request.file.name.split('.').pop()?.toLowerCase()
  if (!extension || !FeedbackConstants.SUPPORTED_VIDEO_FORMATS.includes(extension as any)) {
    errors.push(`지원되지 않는 파일 형식입니다. 지원 형식: ${FeedbackConstants.SUPPORTED_VIDEO_FORMATS.join(', ')}`)
  }

  // 파일명 검증
  if (request.file.name.length > 255) {
    errors.push('파일명이 너무 깁니다 (최대 255자)')
  }

  // 경고사항
  if (request.file.size > 100 * 1024 * 1024) { // 100MB 이상
    warnings.push('파일 크기가 큽니다. 업로드에 시간이 오래 걸릴 수 있습니다')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * 댓글 생성 검증
 */
export function validateCommentCreation(request: CreateCommentRequest): ValidationResult {
  const errors: string[] = []

  // 내용 검증
  const trimmedContent = request.content.trim()
  if (trimmedContent.length === 0) {
    errors.push('댓글 내용을 입력해주세요')
  } else if (trimmedContent.length > FeedbackConstants.MAX_COMMENT_LENGTH) {
    errors.push(`댓글은 최대 ${FeedbackConstants.MAX_COMMENT_LENGTH}자까지 입력 가능합니다`)
  }

  // HTML/스크립트 태그 검증 (XSS 방지)
  const dangerousPattern = /<script|<iframe|javascript:|data:text\/html/i
  if (dangerousPattern.test(request.content)) {
    errors.push('댓글에 허용되지 않는 내용이 포함되어 있습니다')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 감정 반응 생성 검증
 */
export function validateReactionCreation(request: CreateReactionRequest): ValidationResult {
  const errors: string[] = []

  // 반응 대상 검증 (댓글 또는 타임코드 중 하나는 있어야 함)
  if (!request.commentId && !request.timecode) {
    errors.push('반응 대상(댓글 또는 타임코드)을 지정해야 합니다')
  }

  // 댓글 반응과 타임코드 반응이 동시에 있으면 안됨
  if (request.commentId && request.timecode) {
    errors.push('댓글 반응과 타임코드 반응을 동시에 할 수 없습니다')
  }

  // 타임코드 반응인 경우 비디오 슬롯 필수
  if (request.timecode && !request.videoSlot) {
    errors.push('타임코드 반응에는 비디오 슬롯이 필요합니다')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 세션 참여자 권한 검증
 */
export function validateParticipantPermissions(
  participant: FeedbackParticipant,
  session: FeedbackSessionMetadata,
  action: 'comment' | 'react' | 'edit_session' | 'manage_videos' | 'invite'
): ValidationResult {
  const errors: string[] = []

  switch (action) {
    case 'comment':
      if (participant.type === 'guest' && !session.allowGuestComments) {
        errors.push('이 세션에서는 게스트 댓글이 허용되지 않습니다')
      } else if (!participant.permissions.canComment) {
        errors.push('댓글 작성 권한이 없습니다')
      }
      break

    case 'react':
      if (participant.type === 'guest' && !session.allowGuestEmotions) {
        errors.push('이 세션에서는 게스트 감정 표현이 허용되지 않습니다')
      } else if (!participant.permissions.canReact) {
        errors.push('감정 표현 권한이 없습니다')
      }
      break

    case 'edit_session':
      if (!participant.permissions.canEditSession) {
        errors.push('세션 편집 권한이 없습니다')
      }
      break

    case 'manage_videos':
      if (!participant.permissions.canManageVideos) {
        errors.push('영상 관리 권한이 없습니다')
      }
      break

    case 'invite':
      if (!participant.permissions.canInviteOthers) {
        errors.push('초대 권한이 없습니다')
      }
      break
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 세션 만료 검증
 */
export function validateSessionExpiry(session: FeedbackSessionMetadata): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (session.expiresAt) {
    const now = new Date()
    const expiry = new Date(session.expiresAt)

    if (expiry <= now) {
      errors.push('세션이 만료되었습니다')
    } else {
      const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursLeft < 24) {
        warnings.push(`세션이 ${Math.round(hoursLeft)}시간 후 만료됩니다`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * 대댓글 깊이 검증
 */
export function validateReplyDepth(parentCommentId: string, existingComments: Array<{ id: string; parentId?: string }>): ValidationResult {
  const errors: string[] = []

  // 대댓글 깊이 계산
  let depth = 0
  let currentParentId: string | undefined = parentCommentId

  while (currentParentId && depth < FeedbackConstants.MAX_NESTED_REPLIES + 1) {
    const parentComment = existingComments.find(c => c.id === currentParentId)
    if (!parentComment) break

    depth++
    currentParentId = parentComment.parentId
  }

  if (depth >= FeedbackConstants.MAX_NESTED_REPLIES) {
    errors.push(`대댓글은 최대 ${FeedbackConstants.MAX_NESTED_REPLIES}단계까지만 가능합니다`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 세션 참여자 수 제한 검증
 */
export function validateParticipantLimit(currentCount: number): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (currentCount >= FeedbackConstants.MAX_PARTICIPANTS) {
    errors.push(`최대 참여자 수(${FeedbackConstants.MAX_PARTICIPANTS}명)에 도달했습니다`)
  } else if (currentCount >= FeedbackConstants.MAX_PARTICIPANTS * 0.9) {
    warnings.push(`참여자 수가 제한에 근접했습니다 (${currentCount}/${FeedbackConstants.MAX_PARTICIPANTS})`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * 종합 세션 상태 검증
 */
export function validateSessionState(
  session: FeedbackSessionMetadata,
  participants: FeedbackParticipant[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 만료 검증
  const expiryResult = validateSessionExpiry(session)
  errors.push(...expiryResult.errors)
  if (expiryResult.warnings) warnings.push(...expiryResult.warnings)

  // 참여자 수 제한 검증
  const participantResult = validateParticipantLimit(participants.length)
  errors.push(...participantResult.errors)
  if (participantResult.warnings) warnings.push(...participantResult.warnings)

  // 활성 참여자 검증
  const activeParticipants = participants.filter(p => p.isOnline)
  if (activeParticipants.length === 0) {
    warnings.push('현재 온라인 참여자가 없습니다')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}