/**
 * 협업 엔티티 타입 정의
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 (순수한 도메인 모델)
 * - 외부 기술 의존성 없는 비즈니스 로직
 * - 협업 시스템 도메인 모델
 */

/**
 * 사용자 정보 (간단한 참조용)
 */
export interface CollaborationUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly avatar?: string
  readonly role: 'owner' | 'editor' | 'viewer' | 'guest'
}

/**
 * 협업 세션 상태
 */
export type CollaborationSessionStatus =
  | 'active'     // 활성 상태
  | 'idle'       // 비활성 상태 (5분 이상 액션 없음)
  | 'away'       // 자리 비움
  | 'disconnected' // 연결 끊김

/**
 * 멘션 타입
 */
export type MentionType =
  | 'user'       // 사용자 멘션 (@username)
  | 'everyone'   // 전체 멘션 (@everyone)
  | 'here'       // 현재 온라인 사용자 (@here)
  | 'role'       // 역할 멘션 (@editors, @viewers)

/**
 * 멘션 컨텍스트 (멘션이 발생한 위치)
 */
export type MentionContext =
  | 'comment'    // 댓글
  | 'storyboard' // 스토리보드
  | 'scenario'   // 시나리오
  | 'chat'       // 채팅
  | 'document'   // 문서

/**
 * 실시간 커서 상태
 */
export type CursorState =
  | 'typing'     // 타이핑 중
  | 'selecting'  // 선택 중
  | 'idle'       // 비활성
  | 'moving'     // 이동 중

/**
 * 멘션 엔티티
 */
export interface Mention {
  readonly id: string
  readonly type: MentionType
  readonly mentionedBy: CollaborationUser
  readonly mentionedUsers: readonly CollaborationUser[]
  readonly context: MentionContext
  readonly contextId: string           // 댓글 ID, 스토리보드 ID 등
  readonly message: string
  readonly createdAt: Date
  readonly isRead: boolean
  readonly metadata: {
    readonly projectId: string
    readonly sessionId: string
    readonly position?: {             // 멘션 발생 위치 (텍스트 내)
      readonly start: number
      readonly end: number
    }
    readonly urgency: 'low' | 'normal' | 'high'
  }
}

/**
 * 실시간 커서 정보
 */
export interface RealTimeCursor {
  readonly id: string
  readonly userId: string
  readonly user: CollaborationUser
  readonly sessionId: string
  readonly position: {
    readonly x: number
    readonly y: number
    readonly elementId?: string       // 포커스된 요소 ID
    readonly componentType?: string   // 컴포넌트 타입 (text, image, etc.)
  }
  readonly state: CursorState
  readonly lastUpdated: Date
  readonly viewport: {
    readonly width: number
    readonly height: number
    readonly scrollX: number
    readonly scrollY: number
  }
  readonly selection?: {              // 텍스트 선택 영역
    readonly start: number
    readonly end: number
    readonly text: string
  }
}

/**
 * 사용자 현재 상태 (Presence)
 */
export interface UserPresence {
  readonly userId: string
  readonly user: CollaborationUser
  readonly sessionId: string
  readonly status: CollaborationSessionStatus
  readonly lastSeen: Date
  readonly currentLocation: {
    readonly page: string             // 현재 페이지 (scenario, storyboard, etc.)
    readonly componentId?: string     // 현재 포커스된 컴포넌트
    readonly action?: string          // 현재 수행 중인 액션
  }
  readonly connectionInfo: {
    readonly ip: string
    readonly userAgent: string
    readonly connectionType: 'websocket' | 'polling'
    readonly quality: 'good' | 'poor' | 'disconnected'
  }
}

/**
 * 협업 세션
 */
export interface CollaborationSession {
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly owner: CollaborationUser
  readonly participants: readonly UserPresence[]
  readonly activeUsers: readonly UserPresence[]
  readonly status: 'active' | 'paused' | 'ended'
  readonly settings: {
    readonly maxParticipants: number
    readonly allowGuests: boolean
    readonly requireApproval: boolean
    readonly enableMentions: boolean
    readonly enableRealTimeCursors: boolean
    readonly enableVoiceChat: boolean
    readonly enableScreenShare: boolean
  }
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly endedAt?: Date
  readonly statistics: {
    readonly totalParticipants: number
    readonly peakConcurrentUsers: number
    readonly totalMentions: number
    readonly totalMessages: number
    readonly duration: number         // 세션 지속 시간 (초)
  }
}

/**
 * 협업 이벤트 타입
 */
export type CollaborationEventType =
  | 'user_joined'
  | 'user_left'
  | 'user_mentioned'
  | 'cursor_moved'
  | 'text_changed'
  | 'selection_changed'
  | 'component_focused'
  | 'message_sent'
  | 'status_changed'

/**
 * 협업 이벤트
 */
export interface CollaborationEvent {
  readonly id: string
  readonly type: CollaborationEventType
  readonly sessionId: string
  readonly userId: string
  readonly timestamp: Date
  readonly data: Record<string, unknown>
  readonly metadata: {
    readonly projectId: string
    readonly source: 'user' | 'system'
    readonly severity: 'info' | 'warning' | 'error'
  }
}

/**
 * 멘션 알림 설정
 */
export interface MentionNotificationSettings {
  readonly userId: string
  readonly enableEmailNotifications: boolean
  readonly enablePushNotifications: boolean
  readonly enableSoundNotifications: boolean
  readonly quietHours: {
    readonly enabled: boolean
    readonly startTime: string        // HH:MM 형식
    readonly endTime: string          // HH:MM 형식
    readonly timezone: string
  }
  readonly mentionTypes: {
    readonly user: boolean            // @username 멘션
    readonly everyone: boolean        // @everyone 멘션
    readonly here: boolean            // @here 멘션
    readonly role: boolean            // 역할 멘션
  }
  readonly contextFilters: {
    readonly comment: boolean
    readonly storyboard: boolean
    readonly scenario: boolean
    readonly chat: boolean
    readonly document: boolean
  }
}

/**
 * 실시간 커서 설정
 */
export interface RealTimeCursorSettings {
  readonly sessionId: string
  readonly enabled: boolean
  readonly showUserNames: boolean
  readonly showUserAvatars: boolean
  readonly cursorSize: 'small' | 'medium' | 'large'
  readonly animationSpeed: 'slow' | 'normal' | 'fast'
  readonly fadeOutDelay: number       // 커서 사라지는 딜레이 (ms)
  readonly colors: {
    readonly [userId: string]: string // 사용자별 커서 색상
  }
  readonly filters: {
    readonly showOnlyActiveUsers: boolean
    readonly hideOwnCursor: boolean
    readonly hideIdleUsers: boolean
  }
}

/**
 * 협업 권한
 */
export interface CollaborationPermissions {
  readonly userId: string
  readonly sessionId: string
  readonly role: 'owner' | 'editor' | 'viewer' | 'guest'
  readonly permissions: {
    readonly canEdit: boolean
    readonly canComment: boolean
    readonly canMention: boolean
    readonly canInvite: boolean
    readonly canManageSession: boolean
    readonly canViewCursors: boolean
    readonly canShareScreen: boolean
    readonly canUseVoiceChat: boolean
  }
  readonly restrictions: {
    readonly readOnlyComponents: readonly string[]
    readonly disallowedActions: readonly string[]
    readonly timeLimit?: number       // 세션 참여 시간 제한 (분)
  }
}

/**
 * 멘션 생성 요청
 */
export interface CreateMentionRequest {
  readonly type: MentionType
  readonly mentionedUserIds: readonly string[]
  readonly context: MentionContext
  readonly contextId: string
  readonly message: string
  readonly urgency?: 'low' | 'normal' | 'high'
  readonly position?: {
    readonly start: number
    readonly end: number
  }
}

/**
 * 커서 위치 업데이트 요청
 */
export interface UpdateCursorRequest {
  readonly position: {
    readonly x: number
    readonly y: number
    readonly elementId?: string
    readonly componentType?: string
  }
  readonly state: CursorState
  readonly viewport: {
    readonly width: number
    readonly height: number
    readonly scrollX: number
    readonly scrollY: number
  }
  readonly selection?: {
    readonly start: number
    readonly end: number
    readonly text: string
  }
}

/**
 * 협업 세션 생성 요청
 */
export interface CreateCollaborationSessionRequest {
  readonly projectId: string
  readonly name: string
  readonly settings?: Partial<CollaborationSession['settings']>
  readonly initialParticipants?: readonly string[] // 사용자 ID 목록
}

/**
 * 협업 통계
 */
export interface CollaborationStats {
  readonly sessionId: string
  readonly totalParticipants: number
  readonly currentParticipants: number
  readonly totalMentions: number
  readonly totalMessages: number
  readonly totalCursorMovements: number
  readonly sessionDuration: number    // 현재까지 지속 시간 (초)
  readonly peakConcurrentUsers: number
  readonly averageResponseTime: number // 평균 응답 시간 (ms)
  readonly engagementScore: number    // 참여도 점수 (0-100)
}

/**
 * 협업 검색 필터
 */
export interface CollaborationSearchFilters {
  readonly sessionId?: string
  readonly userId?: string
  readonly eventType?: CollaborationEventType
  readonly dateRange?: {
    readonly start: Date
    readonly end: Date
  }
  readonly contextType?: MentionContext
  readonly mentionType?: MentionType
  readonly status?: CollaborationSessionStatus
}

/**
 * 협업 정렬 옵션
 */
export type CollaborationSortOption =
  | 'timestamp'
  | 'userId'
  | 'eventType'
  | 'importance'
  | 'status'