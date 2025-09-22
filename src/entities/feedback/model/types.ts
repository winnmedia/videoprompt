/**
 * Video Feedback Domain Types
 *
 * CLAUDE.md 준수: entities 레이어 순수 도메인 모델
 * 타임코드 기반 시점 피드백 시스템의 핵심 비즈니스 규칙과 타입 정의
 */

/**
 * 영상 슬롯 식별자 (v1, v2, v3)
 */
export type VideoSlot = 'v1' | 'v2' | 'v3'

/**
 * 피드백 참여자 타입
 */
export type ParticipantType = 'owner' | 'member' | 'guest'

/**
 * 감정 표현 타입
 */
export type EmotionType = 'like' | 'dislike' | 'confused'

/**
 * 피드백 상태
 */
export type FeedbackStatus = 'active' | 'resolved' | 'archived'

/**
 * 타임코드 (초 단위)
 */
export interface Timecode {
  readonly seconds: number
  readonly formatted: string // "MM:SS" 또는 "HH:MM:SS" 형식
}

/**
 * 영상 메타데이터
 */
export interface VideoMetadata {
  readonly id: string
  readonly filename: string
  readonly originalName: string
  readonly size: number // bytes
  readonly duration: number // seconds
  readonly width: number
  readonly height: number
  readonly format: string // mp4, webm, etc.
  readonly thumbnailUrl?: string
  readonly uploadedAt: Date
}

/**
 * 영상 슬롯 정보
 */
export interface VideoSlotInfo {
  readonly slot: VideoSlot
  readonly video?: VideoMetadata
  readonly isActive: boolean
  readonly uploadProgress?: number // 0-100
  readonly error?: string
}

/**
 * 피드백 세션 메타데이터
 */
export interface FeedbackSessionMetadata {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly description?: string
  readonly ownerId: string
  readonly shareToken: string // 공유용 토큰
  readonly isPublic: boolean
  readonly allowGuestComments: boolean
  readonly allowGuestEmotions: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly expiresAt?: Date // 만료일 (옵션)
}

/**
 * 피드백 참여자
 */
export interface FeedbackParticipant {
  readonly id: string
  readonly sessionId: string
  readonly userId?: string // 회원인 경우
  readonly guestName?: string // 게스트인 경우
  readonly type: ParticipantType
  readonly permissions: ParticipantPermissions
  readonly isOnline: boolean
  readonly lastSeenAt: Date
  readonly joinedAt: Date
}

/**
 * 참여자 권한
 */
export interface ParticipantPermissions {
  readonly canComment: boolean
  readonly canReact: boolean // 감정 표현
  readonly canEditSession: boolean // 세션 설정 수정
  readonly canManageVideos: boolean // 영상 업로드/삭제
  readonly canInviteOthers: boolean
}

/**
 * 타임코드 기반 댓글
 */
export interface TimecodeComment {
  readonly id: string
  readonly sessionId: string
  readonly videoSlot: VideoSlot
  readonly timecode: Timecode
  readonly authorId: string // 참여자 ID
  readonly content: string
  readonly isResolved: boolean
  readonly parentId?: string // 대댓글인 경우
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly editHistory: CommentEditHistory[]
}

/**
 * 댓글 수정 이력
 */
export interface CommentEditHistory {
  readonly content: string
  readonly editedAt: Date
  readonly editedBy: string
}

/**
 * 감정 표현 반응
 */
export interface EmotionReaction {
  readonly id: string
  readonly commentId?: string // 댓글에 대한 반응
  readonly sessionId: string // 또는 세션 전체에 대한 반응
  readonly videoSlot?: VideoSlot
  readonly timecode?: Timecode // 특정 시점에 대한 반응
  readonly authorId: string
  readonly type: EmotionType
  readonly createdAt: Date
}

/**
 * 피드백 세션 통계
 */
export interface FeedbackSessionStats {
  readonly totalComments: number
  readonly resolvedComments: number
  readonly totalReactions: number
  readonly participantCount: number
  readonly averageEngagement: number // 참여도
  readonly videoSlotStats: Record<VideoSlot, SlotStats>
}

/**
 * 슬롯별 통계
 */
export interface SlotStats {
  readonly commentCount: number
  readonly reactionCount: number
  readonly averageTimecode: number
  readonly hotspots: TimecodeHotspot[] // 피드백이 집중된 구간
}

/**
 * 타임코드 핫스팟 (피드백이 집중된 구간)
 */
export interface TimecodeHotspot {
  readonly startTime: number
  readonly endTime: number
  readonly intensity: number // 피드백 밀도
  readonly commentCount: number
  readonly reactionCount: number
}

/**
 * 피드백 세션 완전체
 */
export interface FeedbackSession {
  readonly metadata: FeedbackSessionMetadata
  readonly videoSlots: VideoSlotInfo[]
  readonly participants: FeedbackParticipant[]
  readonly comments: TimecodeComment[]
  readonly reactions: EmotionReaction[]
  readonly stats: FeedbackSessionStats
}

/**
 * 피드백 세션 생성 요청
 */
export interface CreateFeedbackSessionRequest {
  readonly projectId: string
  readonly title: string
  readonly description?: string
  readonly allowGuestComments: boolean
  readonly allowGuestEmotions: boolean
  readonly expiresAt?: Date
}

/**
 * 댓글 생성 요청
 */
export interface CreateCommentRequest {
  readonly sessionId: string
  readonly videoSlot: VideoSlot
  readonly timecode: Timecode
  readonly content: string
  readonly parentId?: string
}

/**
 * 감정 반응 생성 요청
 */
export interface CreateReactionRequest {
  readonly sessionId: string
  readonly commentId?: string
  readonly videoSlot?: VideoSlot
  readonly timecode?: Timecode
  readonly type: EmotionType
}

/**
 * 영상 업로드 요청
 */
export interface UploadVideoRequest {
  readonly sessionId: string
  readonly slot: VideoSlot
  readonly file: File
  readonly replaceExisting: boolean
}

/**
 * 실시간 이벤트 타입
 */
export type RealtimeEventType =
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'participant_joined'
  | 'participant_left'
  | 'video_uploaded'
  | 'video_deleted'
  | 'session_updated'

/**
 * 실시간 이벤트
 */
export interface RealtimeEvent {
  readonly type: RealtimeEventType
  readonly sessionId: string
  readonly data: unknown
  readonly timestamp: Date
  readonly authorId: string
}

/**
 * 에러 타입
 */
export interface FeedbackError {
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown>
}

/**
 * 도메인 상수
 */
export const FeedbackConstants = {
  // 파일 제한
  MAX_FILE_SIZE: 300 * 1024 * 1024, // 300MB
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'webm', 'mov', 'avi'] as const,

  // 댓글 제한
  MAX_COMMENT_LENGTH: 2000,
  MAX_NESTED_REPLIES: 3,

  // 세션 제한
  MAX_PARTICIPANTS: 50,
  MAX_SESSION_DURATION_DAYS: 30,

  // 타임코드 정밀도
  TIMECODE_PRECISION: 0.1, // 0.1초 단위

  // 핫스팟 설정
  HOTSPOT_MIN_WINDOW: 5, // 최소 5초 구간
  HOTSPOT_MIN_INTENSITY: 3, // 최소 3개 피드백

  // 권한 프리셋
  OWNER_PERMISSIONS: {
    canComment: true,
    canReact: true,
    canEditSession: true,
    canManageVideos: true,
    canInviteOthers: true
  } as const,

  MEMBER_PERMISSIONS: {
    canComment: true,
    canReact: true,
    canEditSession: false,
    canManageVideos: false,
    canInviteOthers: false
  } as const,

  GUEST_PERMISSIONS: {
    canComment: true, // 세션 설정에 따라 변경 가능
    canReact: true,   // 세션 설정에 따라 변경 가능
    canEditSession: false,
    canManageVideos: false,
    canInviteOthers: false
  } as const
} as const

/**
 * 타입 가드
 */
export function isVideoSlot(value: string): value is VideoSlot {
  return ['v1', 'v2', 'v3'].includes(value)
}

export function isParticipantType(value: string): value is ParticipantType {
  return ['owner', 'member', 'guest'].includes(value)
}

export function isEmotionType(value: string): value is EmotionType {
  return ['like', 'dislike', 'confused'].includes(value)
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return ['active', 'resolved', 'archived'].includes(value)
}

export function isRealtimeEventType(value: string): value is RealtimeEventType {
  return [
    'comment_added', 'comment_updated', 'comment_deleted',
    'reaction_added', 'reaction_removed',
    'participant_joined', 'participant_left',
    'video_uploaded', 'video_deleted',
    'session_updated'
  ].includes(value)
}

/**
 * 비즈니스 규칙 검증
 */
export function validateTimecode(timecode: Timecode, videoDuration: number): boolean {
  return timecode.seconds >= 0 &&
         timecode.seconds <= videoDuration &&
         timecode.seconds % FeedbackConstants.TIMECODE_PRECISION === 0
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= FeedbackConstants.MAX_FILE_SIZE
}

export function validateVideoFormat(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? FeedbackConstants.SUPPORTED_VIDEO_FORMATS.includes(extension as any) : false
}

export function validateCommentContent(content: string): boolean {
  return content.trim().length > 0 &&
         content.length <= FeedbackConstants.MAX_COMMENT_LENGTH
}

export function canParticipantComment(participant: FeedbackParticipant, session: FeedbackSessionMetadata): boolean {
  if (participant.type === 'guest') {
    return session.allowGuestComments && participant.permissions.canComment
  }
  return participant.permissions.canComment
}

export function canParticipantReact(participant: FeedbackParticipant, session: FeedbackSessionMetadata): boolean {
  if (participant.type === 'guest') {
    return session.allowGuestEmotions && participant.permissions.canReact
  }
  return participant.permissions.canReact
}