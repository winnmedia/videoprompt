/**
 * 협업 위젯 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 Public API
 * - Named export 우선 사용
 * - UI 컴포넌트 노출
 * - 타입 재내보내기
 */

// ===========================================
// 메인 컴포넌트 내보내기
// ===========================================

/**
 * 멘션 패널 컴포넌트
 */
export { MentionPanel } from './MentionPanel'

/**
 * 실시간 커서 컴포넌트
 */
export { RealTimeCursor, CursorContainer } from './RealTimeCursor'

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  // 멘션 패널 타입들
  MentionPanelProps
} from './MentionPanel'

export type {
  // 커서 타입들
  RealTimeCursorProps
} from './RealTimeCursor'

// entities/collaboration와 features/collaboration 타입들 재내보내기 (convenience)
export type {
  Mention,
  RealTimeCursor as RealTimeCursorType,
  UserPresence,
  CollaborationSession,
  MentionType,
  CursorState
} from '../../entities/collaboration'

export type {
  UseMentionsReturn,
  UseRealTimeCursorsReturn
} from '../../features/collaboration'

// ===========================================
// 기본 내보내기 (메인 컴포넌트)
// ===========================================

/**
 * 가장 많이 사용될 멘션 패널을 기본 내보내기로 제공
 */
export { MentionPanel as default } from './MentionPanel'