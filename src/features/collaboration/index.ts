/**
 * 협업 기능 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 Public API
 * - Named export 우선 사용
 * - Redux slice와 hooks 노출
 * - 타입 재내보내기
 */

// ===========================================
// Redux Slice 내보내기
// ===========================================

export { default as collaborationSlice } from './store/collaboration-slice'

export {
  // 액션 생성자들
  setConnectionStatus,
  addMention,
  setSelectedMention,
  toggleMentionPanel,
  updateOtherCursor,
  removeUserCursor,
  setCursorHighlights,
  toggleCursorTrails,
  updateUserPresence,
  removeUserPresence,
  setMyPresence,
  addCollaborationEvent,
  updateMentionSettings,
  updateCursorSettings,
  clearError,
  clearMentionError,
  clearCursorError,
  setCurrentSession,
  updateSessionStatistics,
  resetCollaborationState,

  // 비동기 Thunk 액션들
  connectToCollaborationAsync,
  createMentionAsync,
  updateCursorAsync,
  joinSessionAsync,
  markMentionAsReadAsync,

  // 셀렉터들
  selectCurrentSession,
  selectMentions,
  selectUnreadMentions,
  selectMyMentions,
  selectCursors,
  selectMyCursor,
  selectParticipants,
  selectMyPresence,
  selectConnectionStatus,
  selectCollaborationLoadingState,
  selectCollaborationErrors
} from './store/collaboration-slice'

// ===========================================
// React Hooks 내보내기
// ===========================================

/**
 * 멘션 시스템 메인 훅
 */
export { useMentions } from './hooks/useMentions'

/**
 * 읽지 않은 멘션 전용 훅
 */
export { useUnreadMentions } from './hooks/useMentions'

/**
 * 멘션 알림 관리 훅
 */
export { useMentionNotifications } from './hooks/useMentions'

/**
 * 실시간 커서 메인 훅
 */
export { useRealTimeCursors } from './hooks/useRealTimeCursors'

/**
 * 커서 표시 전용 훅
 */
export { useCursorDisplay } from './hooks/useRealTimeCursors'

/**
 * 커서 애니메이션 훅
 */
export { useCursorAnimation } from './hooks/useRealTimeCursors'

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  // Redux 상태 타입
  CollaborationState
} from './store/collaboration-slice'

export type {
  // 훅 옵션 타입들
  UseMentionsOptions,
  UseMentionsReturn,
  UseRealTimeCursorsOptions,
  UseRealTimeCursorsReturn,
  CursorWithUser
} from './hooks/useMentions'

export type {
  UseRealTimeCursorsOptions,
  UseRealTimeCursorsReturn,
  CursorWithUser
} from './hooks/useRealTimeCursors'

// entities/collaboration 타입들 재내보내기 (convenience re-export)
export type {
  Mention,
  RealTimeCursor,
  UserPresence,
  CollaborationSession,
  CollaborationEvent,
  CollaborationUser,
  MentionType,
  MentionContext,
  CursorState,
  CollaborationSessionStatus,
  CreateMentionRequest,
  UpdateCursorRequest,
  CreateCollaborationSessionRequest,
  CollaborationSearchFilters,
  CollaborationStats,
  MentionNotificationSettings,
  RealTimeCursorSettings,
  CollaborationPermissions
} from '../../entities/collaboration'

// ===========================================
// 고수준 통합 훅들
// ===========================================

/**
 * 완전한 협업 기능 통합 훅
 */
export function useCollaboration(
  sessionId: string,
  options: {
    enableMentions?: boolean
    enableCursors?: boolean
    autoConnect?: boolean
  } = {}
) {
  const {
    enableMentions = true,
    enableCursors = true,
    autoConnect = true
  } = options

  // 멘션 기능
  const mentionHook = useMentions({
    enableSoundNotifications: enableMentions,
    enableBrowserNotifications: enableMentions
  })

  // 커서 기능
  const cursorHook = useRealTimeCursors({
    enableAnimation: enableCursors,
    enableTrails: enableCursors
  })

  return {
    // 멘션 기능
    mentions: enableMentions ? mentionHook : null,

    // 커서 기능
    cursors: enableCursors ? cursorHook : null,

    // 통합 상태
    isActive: mentionHook.isCreatingMention || cursorHook.isUpdatingCursor,
    hasErrors: !!(mentionHook.error || cursorHook.error),

    // 통합 액션
    disconnect: () => {
      // 연결 해제 로직
    }
  }
}

/**
 * 협업 상태 모니터링 훅
 */
export function useCollaborationMonitor() {
  const currentSession = useSelector(selectCurrentSession)
  const participants = useSelector(selectParticipants)
  const connectionStatus = useSelector(selectConnectionStatus)
  const { unreadCount } = useUnreadMentions()
  const { cursorCount } = useCursorDisplay()

  return {
    session: currentSession,
    participantCount: participants.length,
    isConnected: connectionStatus === 'connected',
    unreadMentions: unreadCount,
    activeCursors: cursorCount,
    isActive: currentSession !== null,
    health: {
      connection: connectionStatus,
      participants: participants.length,
      activity: unreadCount + cursorCount
    }
  }
}

// ===========================================
// 유틸리티 함수들
// ===========================================

/**
 * 협업 기능 관련 유틸리티 함수들
 */
export const CollaborationFeatureUtils = {
  /**
   * 멘션 텍스트에서 사용자 ID 추출
   */
  extractUserIdsFromMentionText: (text: string): string[] => {
    const userRegex = /@(\w+)/g
    const matches = []
    let match

    while ((match = userRegex.exec(text)) !== null) {
      if (!['everyone', 'here'].includes(match[1])) {
        matches.push(match[1])
      }
    }

    return matches
  },

  /**
   * 커서 위치를 뷰포트 좌표로 변환
   */
  convertCursorToViewport: (
    cursor: RealTimeCursor,
    currentViewport: { scrollX: number; scrollY: number }
  ) => ({
    x: cursor.position.x + (currentViewport.scrollX - cursor.viewport.scrollX),
    y: cursor.position.y + (currentViewport.scrollY - cursor.viewport.scrollY)
  }),

  /**
   * 협업 세션 활동 점수 계산
   */
  calculateActivityScore: (
    mentions: readonly Mention[],
    cursors: readonly RealTimeCursor[],
    participants: readonly UserPresence[]
  ): number => {
    const recentMentions = mentions.filter(
      m => Date.now() - m.createdAt.getTime() < 5 * 60 * 1000 // 5분 내
    ).length

    const activeCursors = cursors.filter(
      c => Date.now() - c.lastUpdated.getTime() < 30 * 1000 // 30초 내
    ).length

    const activeParticipants = participants.filter(
      p => p.status === 'active'
    ).length

    // 가중치를 적용한 활동 점수
    return (recentMentions * 3) + (activeCursors * 2) + (activeParticipants * 1)
  },

  /**
   * 사용자 권한 확인 헬퍼
   */
  canUserPerformAction: (
    user: CollaborationUser,
    action: 'mention' | 'edit' | 'view',
    session: CollaborationSession
  ): boolean => {
    // 세션 소유자는 모든 권한
    if (session.owner.id === user.id) {
      return true
    }

    // 역할별 권한 확인
    switch (user.role) {
      case 'editor':
        return ['mention', 'edit', 'view'].includes(action)
      case 'viewer':
        return ['mention', 'view'].includes(action)
      case 'guest':
        return action === 'view'
      default:
        return false
    }
  },

  /**
   * 멘션 알림 우선순위 계산
   */
  getMentionNotificationPriority: (mention: Mention): 'low' | 'normal' | 'high' => {
    // 긴급도가 설정되어 있으면 사용
    if (mention.metadata.urgency !== 'normal') {
      return mention.metadata.urgency
    }

    // 멘션 타입에 따른 우선순위
    switch (mention.type) {
      case 'everyone':
        return 'high'
      case 'here':
        return 'normal'
      case 'user':
        return 'normal'
      case 'role':
        return 'normal'
      default:
        return 'low'
    }
  }
} as const

// ===========================================
// 상수 내보내기
// ===========================================

/**
 * 협업 기능 관련 상수
 */
export const COLLABORATION_FEATURE_CONSTANTS = {
  /**
   * WebSocket 연결 관련
   */
  CONNECTION: {
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    PING_INTERVAL: 30000,
    TIMEOUT: 10000
  },

  /**
   * 멘션 관련
   */
  MENTION: {
    DEBOUNCE_MS: 300,
    MAX_NOTIFICATION_SOUND_FREQUENCY: 2000, // 2초
    NOTIFICATION_DURATION: 5000,
    AUTO_MARK_READ_DELAY: 5000
  },

  /**
   * 커서 관련
   */
  CURSOR: {
    UPDATE_DEBOUNCE_MS: 100,
    IDLE_TIMEOUT: 5000,
    HIDE_AFTER_MS: 30000,
    ANIMATION_DURATION: 300,
    COLLISION_THRESHOLD: 50,
    TRAIL_LENGTH: 10
  },

  /**
   * UI 관련
   */
  UI: {
    MENTION_PANEL_WIDTH: 320,
    CURSOR_SIZE: 16,
    AVATAR_SIZE: 24,
    ANIMATION_EASING: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },

  /**
   * 성능 관련
   */
  PERFORMANCE: {
    MAX_CURSORS_DISPLAYED: 50,
    MAX_MENTIONS_CACHED: 1000,
    EVENT_BUFFER_SIZE: 100,
    RENDER_THROTTLE_MS: 16 // 60fps
  }
} as const

// ===========================================
// 기본 내보내기 (통합 훅)
// ===========================================

/**
 * 가장 많이 사용될 통합 훅을 기본 내보내기로 제공
 */
export { useCollaboration as default }