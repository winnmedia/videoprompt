/**
 * Content Management Entity Public API
 *
 * CLAUDE.md 준수: FSD Public API 패턴, entities 레이어
 * FRD.md 연계: /planning 경로 콘텐츠 관리 대시보드 지원
 */

// === Core Types ===
export type {
  // 핵심 도메인 타입
  ContentType,
  ContentStatus,
  ContentUsage,
  ContentMetadata,
  ContentItem,
  AnyContentItem,

  // 특화 콘텐츠 타입
  ScenarioContent,
  PromptContent,
  ImageContent,
  VideoContent,
  ScenarioContentItem,
  PromptContentItem,
  ImageContentItem,
  VideoContentItem,

  // 지원 타입
  PromptCategory,
  ImageFormat,
  VideoFormat,
  Resolution,
  VideoProvider,
  Scene,

  // 검색 및 필터링
  ContentFilter,
  ContentSort,
  ContentSortField,
  PaginatedContentItems,

  // CRUD 작업
  ContentCreateInput,
  ContentUpdateInput,

  // 검증 및 에러
  ContentValidationResult,
  ContentValidationError,
  ContentValidationWarning,
} from './types'

// === 도메인 에러 ===
export { ContentManagementError } from './types'

// === 상수 및 비즈니스 규칙 ===
export {
  CONTENT_BUSINESS_RULES,
  CONTENT_CONSTANTS,
} from './types'

// === 타입 가드 ===
export {
  isContentType,
  isContentStatus,
  isContentUsage,
  isScenarioContentItem,
  isPromptContentItem,
  isImageContentItem,
  isVideoContentItem,
} from './types'

// === 도메인 모델 및 서비스 ===
export {
  ContentManagementDomain,
  ContentFilteringDomain,
  ContentMappingService,
} from './model'

// === Redux Store ===
export {
  default as contentManagementReducer,
  fetchContent,
  fetchStats,
  executeBatchAction,
  setActiveTab,
  setFilters,
  resetFilters,
  setSortConfig,
  setPagination,
  toggleSelectItem,
  toggleSelectAll,
  clearSelection,
  applyFilters,
  handleRealtimeEvent,
  clearError,
  selectContent,
  selectActiveTabContent,
  selectFilteredContent,
  selectSelectedItems,
  selectStats,
  selectLoading,
  selectError,
  selectIsStale,
} from './store/content-slice'

// === Additional Types for Store ===
export type {
  Content,
  ContentFilters,
  SortConfig,
  PaginationConfig,
  ContentStats,
  BatchAction,
  BatchActionResult,
  RealtimeEvent,
} from './model/types'