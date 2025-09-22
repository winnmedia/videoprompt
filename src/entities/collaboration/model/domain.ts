/**
 * 협업 시스템 도메인 로직
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 (순수한 도메인 모델)
 * - 외부 기술 의존성 없는 비즈니스 로직
 * - 멘션 및 실시간 커서 도메인 서비스
 */

import type {
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
  CollaborationSortOption,
  CollaborationStats
} from '../types'

// ===========================================
// 멘션 도메인 서비스
// ===========================================

export class MentionDomain {
  /**
   * 새 멘션 생성
   */
  static createMention(
    request: CreateMentionRequest,
    mentionedBy: CollaborationUser,
    sessionId: string,
    projectId: string
  ): Mention {
    const mentionId = `mention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id: mentionId,
      type: request.type,
      mentionedBy,
      mentionedUsers: this.resolveMentionedUsers(request, mentionedBy),
      context: request.context,
      contextId: request.contextId,
      message: request.message,
      createdAt: new Date(),
      isRead: false,
      metadata: {
        projectId,
        sessionId,
        position: request.position,
        urgency: request.urgency || 'normal'
      }
    }
  }

  /**
   * 멘션 타입에 따른 대상 사용자 결정
   */
  static resolveMentionedUsers(
    request: CreateMentionRequest,
    mentionedBy: CollaborationUser
  ): readonly CollaborationUser[] {
    switch (request.type) {
      case 'user':
        // 실제로는 사용자 ID로 사용자 정보를 조회해야 함
        return [] // placeholder

      case 'everyone':
        // 프로젝트의 모든 참여자
        return [] // placeholder

      case 'here':
        // 현재 온라인인 사용자들만
        return [] // placeholder

      case 'role':
        // 특정 역할의 사용자들
        return [] // placeholder

      default:
        return []
    }
  }

  /**
   * 멘션 메시지에서 멘션 추출
   */
  static extractMentionsFromText(text: string): Array<{
    type: MentionType
    value: string
    start: number
    end: number
  }> {
    const mentions: Array<{
      type: MentionType
      value: string
      start: number
      end: number
    }> = []

    // @everyone 패턴
    const everyoneRegex = /@everyone/g
    let match
    while ((match = everyoneRegex.exec(text)) !== null) {
      mentions.push({
        type: 'everyone',
        value: 'everyone',
        start: match.index,
        end: match.index + match[0].length
      })
    }

    // @here 패턴
    const hereRegex = /@here/g
    while ((match = hereRegex.exec(text)) !== null) {
      mentions.push({
        type: 'here',
        value: 'here',
        start: match.index,
        end: match.index + match[0].length
      })
    }

    // @username 패턴
    const userRegex = /@([a-zA-Z0-9._-]+)/g
    while ((match = userRegex.exec(text)) !== null) {
      const username = match[1]
      if (username !== 'everyone' && username !== 'here') {
        mentions.push({
          type: 'user',
          value: username,
          start: match.index,
          end: match.index + match[0].length
        })
      }
    }

    return mentions.sort((a, b) => a.start - b.start)
  }

  /**
   * 멘션 읽음 처리
   */
  static markMentionAsRead(mention: Mention): Mention {
    return {
      ...mention,
      isRead: true
    }
  }

  /**
   * 멘션 필터링
   */
  static filterMentions(
    mentions: readonly Mention[],
    filters: CollaborationSearchFilters
  ): readonly Mention[] {
    return mentions.filter(mention => {
      // 세션 ID 필터
      if (filters.sessionId && mention.metadata.sessionId !== filters.sessionId) {
        return false
      }

      // 사용자 ID 필터
      if (filters.userId && mention.mentionedBy.id !== filters.userId) {
        return false
      }

      // 컨텍스트 타입 필터
      if (filters.contextType && mention.context !== filters.contextType) {
        return false
      }

      // 멘션 타입 필터
      if (filters.mentionType && mention.type !== filters.mentionType) {
        return false
      }

      // 날짜 범위 필터
      if (filters.dateRange) {
        const mentionDate = mention.createdAt
        if (mentionDate < filters.dateRange.start || mentionDate > filters.dateRange.end) {
          return false
        }
      }

      return true
    })
  }

  /**
   * 멘션 정렬
   */
  static sortMentions(
    mentions: readonly Mention[],
    sortBy: CollaborationSortOption,
    order: 'asc' | 'desc' = 'desc'
  ): readonly Mention[] {
    const sorted = [...mentions].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'timestamp':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break

        case 'userId':
          comparison = a.mentionedBy.name.localeCompare(b.mentionedBy.name)
          break

        case 'importance':
          const urgencyWeight = { low: 1, normal: 2, high: 3 }
          comparison = urgencyWeight[a.metadata.urgency] - urgencyWeight[b.metadata.urgency]
          break

        default:
          comparison = 0
      }

      return order === 'asc' ? comparison : -comparison
    })

    return sorted
  }

  /**
   * 멘션 검증
   */
  static validateMention(request: CreateMentionRequest): string[] {
    const errors: string[] = []

    if (!request.message.trim()) {
      errors.push('멘션 메시지는 필수입니다')
    }

    if (request.message.length > 1000) {
      errors.push('멘션 메시지는 1000자를 초과할 수 없습니다')
    }

    if (!request.contextId) {
      errors.push('멘션 컨텍스트 ID는 필수입니다')
    }

    if (request.type === 'user' && request.mentionedUserIds.length === 0) {
      errors.push('사용자 멘션에는 최소 1명의 사용자가 필요합니다')
    }

    if (request.mentionedUserIds.length > 50) {
      errors.push('한 번에 멘션할 수 있는 사용자는 최대 50명입니다')
    }

    return errors
  }
}

// ===========================================
// 실시간 커서 도메인 서비스
// ===========================================

export class RealTimeCursorDomain {
  /**
   * 커서 위치 업데이트
   */
  static updateCursor(
    userId: string,
    user: CollaborationUser,
    sessionId: string,
    request: UpdateCursorRequest
  ): RealTimeCursor {
    const cursorId = `cursor_${userId}_${sessionId}`

    return {
      id: cursorId,
      userId,
      user,
      sessionId,
      position: request.position,
      state: request.state,
      lastUpdated: new Date(),
      viewport: request.viewport,
      selection: request.selection
    }
  }

  /**
   * 커서 상태 변경
   */
  static updateCursorState(cursor: RealTimeCursor, newState: CursorState): RealTimeCursor {
    return {
      ...cursor,
      state: newState,
      lastUpdated: new Date()
    }
  }

  /**
   * 커서 필터링 (활성 사용자만)
   */
  static filterActiveCursors(
    cursors: readonly RealTimeCursor[],
    maxIdleTime: number = 30000 // 30초
  ): readonly RealTimeCursor[] {
    const now = new Date().getTime()

    return cursors.filter(cursor => {
      const timeSinceUpdate = now - cursor.lastUpdated.getTime()
      return timeSinceUpdate <= maxIdleTime && cursor.state !== 'idle'
    })
  }

  /**
   * 커서 위치 차이 계산
   */
  static calculateCursorDistance(cursor1: RealTimeCursor, cursor2: RealTimeCursor): number {
    const dx = cursor1.position.x - cursor2.position.x
    const dy = cursor1.position.y - cursor2.position.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * 커서 충돌 감지
   */
  static detectCursorCollisions(
    cursors: readonly RealTimeCursor[],
    threshold: number = 50 // 픽셀
  ): Array<{
    cursor1: RealTimeCursor
    cursor2: RealTimeCursor
    distance: number
  }> {
    const collisions: Array<{
      cursor1: RealTimeCursor
      cursor2: RealTimeCursor
      distance: number
    }> = []

    for (let i = 0; i < cursors.length; i++) {
      for (let j = i + 1; j < cursors.length; j++) {
        const distance = this.calculateCursorDistance(cursors[i], cursors[j])
        if (distance <= threshold) {
          collisions.push({
            cursor1: cursors[i],
            cursor2: cursors[j],
            distance
          })
        }
      }
    }

    return collisions
  }

  /**
   * 커서 위치 유효성 검사
   */
  static validateCursorPosition(request: UpdateCursorRequest): string[] {
    const errors: string[] = []

    if (request.position.x < 0 || request.position.y < 0) {
      errors.push('커서 위치는 음수일 수 없습니다')
    }

    if (request.viewport.width <= 0 || request.viewport.height <= 0) {
      errors.push('뷰포트 크기는 0보다 커야 합니다')
    }

    if (request.position.x > request.viewport.width || request.position.y > request.viewport.height) {
      errors.push('커서 위치가 뷰포트를 벗어났습니다')
    }

    if (request.selection) {
      if (request.selection.start < 0 || request.selection.end < request.selection.start) {
        errors.push('텍스트 선택 범위가 유효하지 않습니다')
      }
    }

    return errors
  }

  /**
   * 커서 애니메이션 경로 계산
   */
  static calculateAnimationPath(
    fromCursor: RealTimeCursor,
    toCursor: RealTimeCursor,
    steps: number = 10
  ): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = []
    const dx = (toCursor.position.x - fromCursor.position.x) / steps
    const dy = (toCursor.position.y - fromCursor.position.y) / steps

    for (let i = 0; i <= steps; i++) {
      path.push({
        x: fromCursor.position.x + dx * i,
        y: fromCursor.position.y + dy * i
      })
    }

    return path
  }
}

// ===========================================
// 협업 세션 도메인 서비스
// ===========================================

export class CollaborationSessionDomain {
  /**
   * 새 협업 세션 생성
   */
  static createSession(
    request: CreateCollaborationSessionRequest,
    owner: CollaborationUser
  ): CollaborationSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id: sessionId,
      projectId: request.projectId,
      name: request.name,
      owner,
      participants: [],
      activeUsers: [],
      status: 'active',
      settings: {
        maxParticipants: 50,
        allowGuests: false,
        requireApproval: true,
        enableMentions: true,
        enableRealTimeCursors: true,
        enableVoiceChat: false,
        enableScreenShare: false,
        ...request.settings
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        totalParticipants: 0,
        peakConcurrentUsers: 0,
        totalMentions: 0,
        totalMessages: 0,
        duration: 0
      }
    }
  }

  /**
   * 사용자 세션 참여
   */
  static addUserToSession(
    session: CollaborationSession,
    userPresence: UserPresence
  ): CollaborationSession {
    // 이미 참여 중인지 확인
    const existingParticipant = session.participants.find(p => p.userId === userPresence.userId)

    if (existingParticipant) {
      // 기존 참여자 상태 업데이트
      return {
        ...session,
        participants: session.participants.map(p =>
          p.userId === userPresence.userId ? userPresence : p
        ),
        activeUsers: session.activeUsers.includes(userPresence)
          ? session.activeUsers
          : [...session.activeUsers, userPresence],
        updatedAt: new Date(),
        statistics: {
          ...session.statistics,
          peakConcurrentUsers: Math.max(
            session.statistics.peakConcurrentUsers,
            session.activeUsers.length + 1
          )
        }
      }
    }

    // 새 참여자 추가
    return {
      ...session,
      participants: [...session.participants, userPresence],
      activeUsers: [...session.activeUsers, userPresence],
      updatedAt: new Date(),
      statistics: {
        ...session.statistics,
        totalParticipants: session.statistics.totalParticipants + 1,
        peakConcurrentUsers: Math.max(
          session.statistics.peakConcurrentUsers,
          session.activeUsers.length + 1
        )
      }
    }
  }

  /**
   * 사용자 세션 떠나기
   */
  static removeUserFromSession(
    session: CollaborationSession,
    userId: string
  ): CollaborationSession {
    return {
      ...session,
      activeUsers: session.activeUsers.filter(user => user.userId !== userId),
      updatedAt: new Date()
    }
  }

  /**
   * 세션 상태 업데이트
   */
  static updateSessionStatus(
    session: CollaborationSession,
    status: 'active' | 'paused' | 'ended'
  ): CollaborationSession {
    return {
      ...session,
      status,
      updatedAt: new Date(),
      endedAt: status === 'ended' ? new Date() : session.endedAt
    }
  }

  /**
   * 세션 통계 계산
   */
  static calculateSessionStats(session: CollaborationSession): CollaborationStats {
    const now = new Date()
    const duration = Math.floor((now.getTime() - session.createdAt.getTime()) / 1000)

    // 간단한 참여도 점수 계산 (실제로는 더 복잡한 로직 필요)
    const engagementScore = Math.min(100,
      (session.statistics.totalMentions * 10 +
       session.statistics.totalMessages * 5 +
       session.activeUsers.length * 20) / Math.max(1, session.statistics.totalParticipants)
    )

    return {
      sessionId: session.id,
      totalParticipants: session.statistics.totalParticipants,
      currentParticipants: session.activeUsers.length,
      totalMentions: session.statistics.totalMentions,
      totalMessages: session.statistics.totalMessages,
      totalCursorMovements: 0, // 실제로는 이벤트에서 계산
      sessionDuration: duration,
      peakConcurrentUsers: session.statistics.peakConcurrentUsers,
      averageResponseTime: 0, // 실제로는 이벤트 분석 필요
      engagementScore
    }
  }

  /**
   * 세션 권한 검사
   */
  static checkPermission(
    session: CollaborationSession,
    userId: string,
    permission: string
  ): boolean {
    // 소유자는 모든 권한을 가짐
    if (session.owner.id === userId) {
      return true
    }

    // 참여자 권한 확인
    const participant = session.participants.find(p => p.userId === userId)
    if (!participant) {
      return false
    }

    // 역할별 권한 확인 (실제로는 더 세분화된 권한 시스템 필요)
    switch (participant.user.role) {
      case 'editor':
        return ['edit', 'comment', 'mention'].includes(permission)
      case 'viewer':
        return ['comment', 'mention'].includes(permission)
      case 'guest':
        return ['comment'].includes(permission)
      default:
        return false
    }
  }

  /**
   * 세션 유효성 검사
   */
  static validateSession(request: CreateCollaborationSessionRequest): string[] {
    const errors: string[] = []

    if (!request.name.trim()) {
      errors.push('세션 이름은 필수입니다')
    }

    if (request.name.length > 100) {
      errors.push('세션 이름은 100자를 초과할 수 없습니다')
    }

    if (!request.projectId) {
      errors.push('프로젝트 ID는 필수입니다')
    }

    if (request.settings?.maxParticipants && request.settings.maxParticipants > 100) {
      errors.push('최대 참여자 수는 100명을 초과할 수 없습니다')
    }

    return errors
  }
}

// ===========================================
// 통합 협업 도메인 서비스
// ===========================================

export const CollaborationDomain = {
  Mention: MentionDomain,
  RealTimeCursor: RealTimeCursorDomain,
  Session: CollaborationSessionDomain
} as const