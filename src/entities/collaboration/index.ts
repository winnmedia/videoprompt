/**
 * 협업 엔티티 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 Public API
 * - Named export 우선 사용
 * - 타입과 구현체 분리하여 export
 * - 도메인 서비스 노출
 */

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  // 핵심 엔티티 타입
  Mention,
  RealTimeCursor,
  UserPresence,
  CollaborationSession,
  CollaborationEvent,
  CollaborationUser,

  // 설정 타입
  MentionNotificationSettings,
  RealTimeCursorSettings,
  CollaborationPermissions,

  // 유틸리티 타입
  MentionType,
  MentionContext,
  CursorState,
  CollaborationSessionStatus,
  CollaborationEventType,
  CollaborationSortOption,

  // 요청/응답 타입
  CreateMentionRequest,
  UpdateCursorRequest,
  CreateCollaborationSessionRequest,
  CollaborationSearchFilters,
  CollaborationStats
} from './types'

// ===========================================
// 도메인 서비스 내보내기
// ===========================================

export { CollaborationDomain } from './model/domain'

// 개별 도메인 서비스들도 편의성을 위해 내보내기
export {
  MentionDomain,
  RealTimeCursorDomain,
  CollaborationSessionDomain
} from './model/domain'

// ===========================================
// 유틸리티 함수들
// ===========================================

/**
 * 협업 관련 유틸리티 함수들
 */
export const CollaborationUtils = {
  /**
   * 멘션 텍스트 포맷팅
   */
  formatMentionText: (mention: Mention): string => {
    const { type, mentionedUsers, mentionedBy } = mention

    switch (type) {
      case 'user':
        if (mentionedUsers.length === 1) {
          return `@${mentionedUsers[0].name}`
        }
        return `@${mentionedUsers.map(u => u.name).join(', @')}`

      case 'everyone':
        return '@everyone'

      case 'here':
        return '@here'

      case 'role':
        return `@${mentionedUsers[0]?.role || 'role'}`

      default:
        return '@unknown'
    }
  },

  /**
   * 커서 상태 한글명 변환
   */
  getCursorStateDisplayName: (state: CursorState): string => {
    const stateMap: Record<CursorState, string> = {
      'typing': '입력 중',
      'selecting': '선택 중',
      'idle': '대기 중',
      'moving': '이동 중'
    }

    return stateMap[state] || state
  },

  /**
   * 사용자 온라인 상태 한글명 변환
   */
  getSessionStatusDisplayName: (status: CollaborationSessionStatus): string => {
    const statusMap: Record<CollaborationSessionStatus, string> = {
      'active': '활성',
      'idle': '비활성',
      'away': '자리 비움',
      'disconnected': '연결 끊김'
    }

    return statusMap[status] || status
  },

  /**
   * 상대적 시간 표시
   */
  getRelativeTime: (date: Date): string => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return '방금 전'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours}시간 전`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays}일 전`
    }

    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
      return `${diffInWeeks}주 전`
    }

    const diffInMonths = Math.floor(diffInDays / 30)
    return `${diffInMonths}개월 전`
  },

  /**
   * 사용자 색상 생성 (일관성 있는 색상)
   */
  generateUserColor: (userId: string): string => {
    // 사용자 ID를 기반으로 일관성 있는 색상 생성
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    // HSL 색상으로 변환 (채도와 명도는 고정하여 읽기 쉬운 색상 보장)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 50%)`
  },

  /**
   * 멘션 우선순위 점수 계산
   */
  calculateMentionPriority: (mention: Mention): number => {
    let score = 0

    // 멘션 타입별 점수
    switch (mention.type) {
      case 'everyone':
        score += 100
        break
      case 'here':
        score += 80
        break
      case 'role':
        score += 60
        break
      case 'user':
        score += 40
        break
    }

    // 긴급도별 점수
    switch (mention.metadata.urgency) {
      case 'high':
        score += 50
        break
      case 'normal':
        score += 20
        break
      case 'low':
        score += 10
        break
    }

    // 컨텍스트별 점수
    switch (mention.context) {
      case 'storyboard':
        score += 30
        break
      case 'scenario':
        score += 25
        break
      case 'comment':
        score += 20
        break
      case 'chat':
        score += 15
        break
      case 'document':
        score += 10
        break
    }

    // 시간 페널티 (오래된 멘션일수록 점수 감소)
    const ageInHours = (new Date().getTime() - mention.createdAt.getTime()) / (1000 * 60 * 60)
    const agePenalty = Math.min(50, ageInHours * 2)
    score -= agePenalty

    return Math.max(0, score)
  },

  /**
   * 협업 세션 건강도 계산
   */
  calculateSessionHealth: (session: CollaborationSession): {
    score: number
    issues: string[]
    recommendations: string[]
  } => {
    let score = 100
    const issues: string[] = []
    const recommendations: string[] = []

    // 활성 사용자 비율 확인
    const activeRatio = session.activeUsers.length / Math.max(1, session.participants.length)
    if (activeRatio < 0.3) {
      score -= 20
      issues.push('활성 사용자 비율이 낮음')
      recommendations.push('참여도를 높이기 위한 활동을 시작해보세요')
    }

    // 세션 지속 시간 확인
    const durationHours = (new Date().getTime() - session.createdAt.getTime()) / (1000 * 60 * 60)
    if (durationHours > 8) {
      score -= 15
      issues.push('장시간 세션 지속')
      recommendations.push('정기적인 휴식을 권장합니다')
    }

    // 멘션 활동 확인
    if (session.statistics.totalMentions === 0 && session.participants.length > 1) {
      score -= 10
      issues.push('멘션 활동 없음')
      recommendations.push('팀원들과 소통을 시작해보세요')
    }

    // 최대 동시 사용자 수 대비 현재 사용자 수
    if (session.activeUsers.length < session.statistics.peakConcurrentUsers * 0.5) {
      score -= 10
      issues.push('참여자 수 감소')
      recommendations.push('팀원들에게 참여를 독려해보세요')
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations
    }
  }
} as const

// ===========================================
// 상수 내보내기
// ===========================================

/**
 * 협업 관련 상수
 */
export const COLLABORATION_CONSTANTS = {
  /**
   * 멘션 관련
   */
  MENTION: {
    MAX_MESSAGE_LENGTH: 1000,
    MAX_MENTIONED_USERS: 50,
    URGENCY_LEVELS: ['low', 'normal', 'high'] as const,
    CONTEXT_TYPES: ['comment', 'storyboard', 'scenario', 'chat', 'document'] as const
  },

  /**
   * 실시간 커서 관련
   */
  CURSOR: {
    MAX_IDLE_TIME: 30000,      // 30초
    ANIMATION_DURATION: 300,   // 300ms
    COLLISION_THRESHOLD: 50,   // 50픽셀
    UPDATE_THROTTLE: 100,      // 100ms
    CURSOR_STATES: ['typing', 'selecting', 'idle', 'moving'] as const
  },

  /**
   * 협업 세션 관련
   */
  SESSION: {
    MAX_PARTICIPANTS: 100,
    MAX_SESSION_NAME_LENGTH: 100,
    DEFAULT_MAX_PARTICIPANTS: 50,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24시간
    STATUS_TYPES: ['active', 'idle', 'away', 'disconnected'] as const
  },

  /**
   * 알림 관련
   */
  NOTIFICATION: {
    DEFAULT_QUIET_HOURS: {
      start: '22:00',
      end: '08:00',
      timezone: 'Asia/Seoul'
    },
    MENTION_TYPES: ['user', 'everyone', 'here', 'role'] as const
  },

  /**
   * 성능 관련
   */
  PERFORMANCE: {
    CURSOR_BATCH_SIZE: 20,     // 한 번에 처리할 커서 업데이트 수
    EVENT_BUFFER_SIZE: 100,    // 이벤트 버퍼 크기
    WEBSOCKET_RETRY_ATTEMPTS: 3,
    WEBSOCKET_RETRY_DELAY: 1000 // 1초
  }
} as const

// ===========================================
// 기본 내보내기 (메인 도메인 서비스)
// ===========================================

/**
 * 가장 많이 사용될 통합 도메인 서비스를 기본 내보내기로 제공
 */
export default CollaborationDomain