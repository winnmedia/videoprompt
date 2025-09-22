/**
 * Video Entity Public API
 *
 * CLAUDE.md 준수: entities 레이어 Public API
 * 영상 생성 도메인의 모든 타입, 모델, 상태 관리를 외부에 노출
 */

// 타입 정의 export
export type {
  VideoGeneration,
  VideoGenerationStatus,
  VideoProvider,
  VideoGenerationParams,
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoMetadata,
  VideoJob,
  VideoQueueItem,
  VideoProgressUpdate,
  VideoFeedback,
  VideoIssue,
  Resolution
} from './types'

// 도메인 상수 export
export { VideoConstants, isVideoGenerationStatus, isVideoProvider, isValidResolution } from './types'

// 도메인 모델 및 서비스 export
export {
  VideoGenerationDomain,
  VideoGenerationFactory,
  VideoGenerationAggregates,
  type ValidationResult,
  type UserTier,
  type ProjectProgressSummary
} from './model'

// 상태 관리 export
export {
  // 리듀서
  default as videoReducer,

  // 액션들
  generateVideo,
  fetchVideoStatus,
  fetchProjectVideos,
  upsertVideoGeneration,
  upsertVideoGenerations,
  updateVideoStatus,
  updateVideoProgress,
  enqueueVideo,
  dequeueVideo,
  moveToProcessing,
  setCurrentGeneration,
  setSelectedProvider,
  setFilters,
  setSortBy,
  updateProjectSummary,
  setError,
  clearError,
  deleteVideoGeneration,
  resetVideoState,

  // 셀렉터들
  videoSelectors,

  // 타입들
  type VideoState,
  type VideoFilters,
  type VideoSortBy
} from './store'