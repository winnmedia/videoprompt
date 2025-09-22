/**
 * Feedback Entity - Public API
 *
 * CLAUDE.md 준수: entities 레이어 Public API
 * 피드백 도메인의 모든 public exports 정의
 */

// 타입 exports
export type {
  // 핵심 타입
  VideoSlot,
  ParticipantType,
  EmotionType,
  FeedbackStatus,

  // 인터페이스
  Timecode,
  VideoMetadata,
  VideoSlotInfo,
  FeedbackSession,
  FeedbackSessionMetadata,
  FeedbackParticipant,
  ParticipantPermissions,
  TimecodeComment,
  CommentEditHistory,
  EmotionReaction,
  FeedbackSessionStats,
  SlotStats,
  TimecodeHotspot,

  // 요청 타입
  CreateFeedbackSessionRequest,
  CreateCommentRequest,
  CreateReactionRequest,
  UploadVideoRequest,

  // 실시간 이벤트
  RealtimeEventType,
  RealtimeEvent,

  // 에러 타입
  FeedbackError
} from './model/types'

// 확장 타입 exports (Phase 3.9)
export type {
  // 버전 관리
  VersionMetadata,
  VersionHistory,
  VersionComparisonRequest,
  VersionComparisonResult,

  // 스레드 댓글
  ThreadedComment,
  CommentEditEntry,
  EmotionReactionExtended,
  CommentAttachment,
  ThreadStats,

  // 고급 공유
  SharePermission,
  ShareLinkToken,

  // 스크린샷
  ScreenshotRequest,
  ScreenshotResult,

  // 확장된 메타데이터
  ExtendedFeedbackSessionMetadata,

  // 확장된 실시간 이벤트
  ExtendedRealtimeEventType,
  ExtendedRealtimeEvent
} from './model/extended-types'

// 상수 exports
export { FeedbackConstants } from './model/types'
export { VersionConstants, ThreadConstants, ShareConstants } from './model/extended-types'

// 타입 가드 exports
export {
  isVideoSlot,
  isParticipantType,
  isEmotionType,
  isFeedbackStatus,
  isRealtimeEventType,
  validateTimecode,
  validateFileSize,
  validateVideoFormat,
  validateCommentContent,
  canParticipantComment,
  canParticipantReact
} from './model/types'

// 검증 함수 exports
export type { ValidationResult } from './model/validation'
export {
  validateVideoUpload,
  validateCommentCreation,
  validateReactionCreation,
  validateParticipantPermissions,
  validateSessionExpiry,
  validateReplyDepth,
  validateParticipantLimit,
  validateSessionState
} from './model/validation'

// Redux store exports
export { default as feedbackReducer, default as feedbackSlice } from './store/feedback-slice'
export {
  // Async actions
  loadFeedbackSession,
  createComment,
  createReaction,

  // Sync actions
  setSelectedVideoSlot,
  setCurrentTimecode,
  setPlayingState,
  toggleResolvedComments,
  setParticipantFilter,
  toggleCommentForm,
  toggleReactionPanel,
  setRealtimeConnection,
  addRealtimeEvent,
  processRealtimeEvent,
  updateCommentResolved,
  updateVideoSlot,
  clearError,
  cacheSession,
  clearSessionCache,
  leaveSession
} from './store/feedback-slice'

export type { FeedbackAction } from './store/feedback-slice'

// Selectors exports
export {
  // 기본 선택자
  selectFeedbackState,
  selectCurrentSession,
  selectIsLoading,
  selectIsSubmitting,
  selectError,
  selectUI,
  selectRealtime,

  // UI 상태 선택자
  selectSelectedVideoSlot,
  selectCurrentTimecode,
  selectIsPlaying,
  selectShowResolvedComments,
  selectParticipantFilter,
  selectCommentFormOpen,
  selectReactionPanelOpen,

  // 실시간 상태 선택자
  selectIsRealtimeConnected,
  selectLastRealtimeEvent,
  selectPendingEvents,

  // 세션 데이터 선택자
  selectSessionMetadata,
  selectVideoSlots,
  selectParticipants,
  selectComments,
  selectReactions,
  selectSessionStats,

  // 파생 데이터 선택자
  selectActiveVideoSlot,
  selectActiveVideo,
  selectFilteredComments,
  selectCommentsByTimecode,
  selectCommentsAtCurrentTime,
  selectOnlineParticipants,
  selectParticipantStats,
  selectTimecodeHotspots,
  selectUnresolvedCommentCount,
  selectSessionEngagement,
  selectCommentTree,
  selectCommentReactions,
  selectCanCurrentUserParticipate
} from './store/selectors'