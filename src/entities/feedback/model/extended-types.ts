/**
 * Extended Video Feedback Domain Types - Phase 3.9
 *
 * CLAUDE.md 준수: entities 레이어 순수 도메인 모델
 * 버전 관리, 스레드 댓글, 고급 공유 기능을 위한 확장 타입 정의
 */

import type { VideoSlot, Timecode, VideoMetadata, EmotionType, ParticipantType } from './types'

/**
 * 영상 버전 메타데이터
 */
export interface VersionMetadata {
  readonly versionId: string
  readonly slot: VideoSlot
  readonly versionNumber: number // 1, 2, 3...
  readonly uploader: {
    readonly id: string
    readonly name: string
    readonly type: ParticipantType
  }
  readonly uploadedAt: Date
  readonly originalFilename: string
  readonly fileHash: string // SHA-256 해시
  readonly fileSize: number // bytes
  readonly duration: number // seconds
  readonly codec: string // H.264, VP9, etc.
  readonly resolution: {
    readonly width: number
    readonly height: number
  }
  readonly thumbnailUrl?: string
  readonly isActive: boolean // 현재 활성 버전 여부
  readonly replaceReason?: string // 교체 사유
}

/**
 * 스레드 댓글 구조
 */
export interface ThreadedComment {
  readonly id: string
  readonly sessionId: string
  readonly videoSlot: VideoSlot
  readonly versionId?: string // 특정 버전 댓글인 경우
  readonly parentId?: string // 대댓글인 경우 부모 댓글 ID
  readonly depth: number // 0: 원댓글, 1: 대댓글, 2: 대대댓글...
  readonly threadId: string // 스레드 식별자 (원댓글 ID)
  readonly author: {
    readonly id: string
    readonly name: string
    readonly type: ParticipantType
  }
  readonly timecode: Timecode
  readonly content: string
  readonly isResolved: boolean
  readonly createdAt: Date
  readonly updatedAt?: Date
  readonly editHistory: CommentEditEntry[]
  readonly reactions: EmotionReactionExtended[]
  readonly mentions: string[] // 멘션된 사용자 ID 목록
  readonly attachments: CommentAttachment[]
}

/**
 * 댓글 수정 이력
 */
export interface CommentEditEntry {
  readonly editedAt: Date
  readonly previousContent: string
  readonly reason?: string
}

/**
 * 확장된 감정 반응
 */
export interface EmotionReactionExtended {
  readonly id: string
  readonly type: EmotionType
  readonly userId: string
  readonly userName: string
  readonly createdAt: Date
  readonly commentId?: string // 댓글 반응인 경우
  readonly timecode?: Timecode // 타임코드 반응인 경우
}

/**
 * 댓글 첨부 파일
 */
export interface CommentAttachment {
  readonly id: string
  readonly type: 'screenshot' | 'file' | 'link'
  readonly url: string
  readonly filename: string
  readonly size?: number
  readonly mimeType?: string
  readonly thumbnailUrl?: string
}

/**
 * 고급 공유 권한
 */
export interface SharePermission {
  readonly id: string
  readonly sessionId: string
  readonly createdBy: string
  readonly accessLevel: 'view' | 'comment' | 'react' | 'edit' | 'admin'
  readonly expiresAt?: Date
  readonly maxUses?: number
  readonly usedCount: number
  readonly allowedDomains?: string[] // 도메인 제한
  readonly requiresAuth: boolean // 로그인 필요 여부
  readonly isActive: boolean
  readonly createdAt: Date
  readonly lastUsedAt?: Date
}

/**
 * 공유 링크 토큰
 */
export interface ShareLinkToken {
  readonly token: string
  readonly sessionId: string
  readonly permissions: SharePermission
  readonly shortUrl: string
  readonly fullUrl: string
  readonly qrCodeUrl?: string
}

/**
 * 버전 히스토리
 */
export interface VersionHistory {
  readonly sessionId: string
  readonly slot: VideoSlot
  readonly versions: VersionMetadata[]
  readonly currentVersionId: string
  readonly totalVersions: number
  readonly createdAt: Date
  readonly lastModifiedAt: Date
}

/**
 * 스크린샷 요청
 */
export interface ScreenshotRequest {
  readonly sessionId: string
  readonly videoSlot: VideoSlot
  readonly versionId: string
  readonly timecode: Timecode
  readonly format: 'jpg' | 'png' | 'webp'
  readonly quality: number // 1-100
  readonly includeTimestamp: boolean
  readonly includeProjectInfo: boolean
}

/**
 * 스크린샷 결과
 */
export interface ScreenshotResult {
  readonly id: string
  readonly filename: string // project-{slug}_TC{mmssfff}_{YYYY-MM-DD}T{HHmmss}.jpg
  readonly url: string
  readonly thumbnailUrl?: string
  readonly size: number
  readonly dimensions: {
    readonly width: number
    readonly height: number
  }
  readonly metadata: {
    readonly projectSlug: string
    readonly timecode: string
    readonly capturedAt: Date
    readonly videoVersion: string
  }
}

/**
 * 댓글 스레드 통계
 */
export interface ThreadStats {
  readonly threadId: string
  readonly totalComments: number
  readonly totalReactions: number
  readonly participantCount: number
  readonly lastActivity: Date
  readonly isResolved: boolean
  readonly resolvedAt?: Date
  readonly resolvedBy?: string
}

/**
 * 확장된 피드백 세션 메타데이터
 */
export interface ExtendedFeedbackSessionMetadata {
  readonly sessionId: string
  readonly projectSlug: string
  readonly title: string
  readonly description?: string
  readonly versionHistories: VersionHistory[]
  readonly shareLinks: ShareLinkToken[]
  readonly threadStats: ThreadStats[]
  readonly totalScreenshots: number
  readonly settings: {
    readonly allowGuestComments: boolean
    readonly requireApproval: boolean
    readonly enableVersionComparison: boolean
    readonly maxCommentDepth: number
    readonly allowReactions: boolean
    readonly enableNotifications: boolean
  }
  readonly createdAt: Date
  readonly lastActivityAt: Date
}

/**
 * 버전 비교 요청
 */
export interface VersionComparisonRequest {
  readonly sessionId: string
  readonly slot: VideoSlot
  readonly versionA: string
  readonly versionB: string
  readonly compareType: 'side-by-side' | 'overlay' | 'diff'
}

/**
 * 버전 비교 결과
 */
export interface VersionComparisonResult {
  readonly id: string
  readonly request: VersionComparisonRequest
  readonly differences: {
    readonly duration: number // 길이 차이 (초)
    readonly fileSize: number // 파일 크기 차이 (bytes)
    readonly resolution: boolean // 해상도 변경 여부
    readonly codec: boolean // 코덱 변경 여부
  }
  readonly thumbnailComparisonUrl?: string
  readonly createdAt: Date
}

/**
 * 피드백 이벤트 타입 확장
 */
export type ExtendedRealtimeEventType =
  | 'version_uploaded'
  | 'version_activated'
  | 'thread_created'
  | 'thread_resolved'
  | 'comment_replied'
  | 'screenshot_captured'
  | 'share_link_created'
  | 'share_link_accessed'

/**
 * 확장된 실시간 이벤트
 */
export interface ExtendedRealtimeEvent {
  readonly type: ExtendedRealtimeEventType
  readonly sessionId: string
  readonly userId: string
  readonly timestamp: Date
  readonly data: {
    readonly versionId?: string
    readonly threadId?: string
    readonly commentId?: string
    readonly screenshotId?: string
    readonly shareTokenId?: string
    readonly [key: string]: any
  }
}

/**
 * 버전 관리 상수
 */
export const VersionConstants = {
  MAX_VERSIONS_PER_SLOT: 10,
  MAX_FILE_SIZE: 300 * 1024 * 1024, // 300MB
  SUPPORTED_FORMATS: ['mp4', 'webm', 'mov', 'avi'] as const,
  SUPPORTED_CODECS: ['H.264', 'H.265', 'VP9', 'AV1'] as const,
  MAX_COMMENT_DEPTH: 3,
  SCREENSHOT_FORMATS: ['jpg', 'png', 'webp'] as const,
  SHARE_TOKEN_LENGTH: 32,
  SHARE_LINK_EXPIRY_DAYS: 30
} as const

/**
 * 스레드 댓글 상수
 */
export const ThreadConstants = {
  MAX_DEPTH: 3, // 최대 3단계 대댓글
  MAX_CONTENT_LENGTH: 2000,
  MAX_MENTIONS: 10,
  MAX_ATTACHMENTS: 5,
  EDIT_TIME_LIMIT: 24 * 60 * 60 * 1000 // 24시간 (ms)
} as const

/**
 * 공유 권한 상수
 */
export const ShareConstants = {
  TOKEN_LENGTH: 32,
  DEFAULT_EXPIRY_DAYS: 30,
  MAX_USES_UNLIMITED: -1,
  QR_CODE_SIZE: 200,
  SHORT_URL_LENGTH: 8
} as const