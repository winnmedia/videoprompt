/**
 * Shared 레이어 공개 API
 * FSD 아키텍처에 따른 공개 인터페이스
 */

// =============================================================================
// 공통 유틸리티 및 훅
// =============================================================================

export { useAsyncOperation } from './hooks/useAsyncOperation';

// =============================================================================
// 타입 내보내기
// =============================================================================

export type {
  StoryboardResult,
  StoryboardGenerationOptions,
  SingleShotGenerationRequest,
  BatchGenerationRequest,
  BatchGenerationResult,
  ShotGenerationState,
  StoryboardGenerationState,
  StoryboardSaveRequest,
  PromptCacheEntry,
  ImageCompressionUtils,
  PromptOptimizationUtils,
} from './types/storyboard';

export {
  ShotGenerationStatus,
  StoryboardErrorType,
  StoryboardGenerationError,
} from './types/storyboard';

// =============================================================================
// 서비스 내보내기 (서버 사이드만)
// =============================================================================

// 주석 처리: 클라이언트 사이드에서 Google API 관련 Node.js 전용 모듈 문제 해결
// export {
//   StoryboardGeneratorService,
//   generateStoryboard,
//   generateSingleShot,
//   batchGenerateShots,
//   saveStoryboard,
//   getGenerationState,
//   clearCache,
//   getCacheStats,
// } from './services/storyboard-generator';

// =============================================================================
// Redux Store 내보내기
// =============================================================================

export { store, useAppDispatch, useAppSelector } from './store';
export type { RootState, AppDispatch } from './store';

export {
  setActiveProject,
  initializeGenerationState,
  updateGenerationState,
  updateShotState,
  addGeneratedResult,
  addBatchResults,
  removeGenerationState,
  updateUIState,
  selectShot,
  setViewMode,
  setFilter,
  setSort,
  addError,
  removeError,
  clearErrors,
  updateStatistics,
  clearProjectResults,
  resetState,
  storyboardSelectors,
} from './store/slices/storyboard';

// =============================================================================
// React Query 내보내기
// =============================================================================

export { queryClient, queryKeys } from './query/client';

// 주석 처리: 스토리보드 생성 hooks (필요시 개별 import)
// export {
//   useGenerateStoryboard,
//   useGenerateSingleShot,
//   useBatchGenerateShots,
//   useSaveStoryboard,
//   useGenerationStatus,
//   useCacheStats,
//   useStoryboard,
//   useGenerationHistory,
//   useOptimisticStoryboardUpdate,
// } from './query/hooks/useStoryboardGeneration';

// =============================================================================
// MSW Mock 핸들러 (개발/테스트용) - 주석 처리
// =============================================================================

// 주석 처리: 빌드 시 MSW 관련 모듈 문제 해결
// export { handlers, errorHandlers, successHandlers } from './mocks/handlers';
// export { worker, startMSW } from './mocks/browser';
// export { server, setupTestServer } from './mocks/server';

// =============================================================================
// 기존 유틸리티 내보내기
// =============================================================================

export { cn } from './utils';
export { useSoftPrefetch } from './prefetch';
export { logger } from './logger';
export { success, failure } from './api-response';
export type { ApiError } from './api-response';
export * from './auth';

// =============================================================================
// 업로드 유틸리티 내보내기
// =============================================================================

export {
  formatFileSize,
  sanitizeFileName,
  isValidVideoFile,
  isFileSizeValid,
  createFileChunks,
  calculateProgress,
  calculateRetryDelay,
  isRetriableError,
  createUploadSession,
  createUploadHeaders,
  getMemoryUsage,
  createCancellationToken,
  calculateFileChecksum,
  isUploadSessionExpired,
  isUploadSessionActive,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_RETRY_CONFIG,
  SUPPORTED_VIDEO_TYPES,
  MAX_FILE_SIZE,
} from './upload-utils';

export type {
  UploadProgress,
  UploadChunk,
  UploadSession,
  RetryConfig,
} from './upload-utils';

// =============================================================================
// AI Client 내보내기
// =============================================================================

export { extractSceneComponents } from './ai-client';

// =============================================================================
// Zod 스키마 내보내기
// =============================================================================

export {
  // API 스키마
  BaseApiResponseSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
  PaginationSchema,
  ApiErrorSchema,
  ValidationErrorSchema,
  ValidationErrorResponseSchema,
  UserSchema,
  UserPreferencesSchema,
  UserWithPreferencesSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  FileUploadMetadataSchema,
  FileUploadResponseSchema,
  VideoUploadValidationSchema,
  VideoUploadResponseSchema,
  PaginationQuerySchema,
  SearchQuerySchema,
  FilterQuerySchema,
  CombinedQuerySchema,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedSuccessResponse,
} from '../schemas/api.schema';

export type {
  ApiResponse,
  PaginatedResponse,
  ValidationError,
  User,
  UserPreferences,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  FileUploadResponse,
  VideoUploadResponse,
  PaginationQuery,
  SearchQuery,
  FilterQuery,
  CombinedQuery,
} from '../schemas/api.schema';

export {
  // Story 스키마
  StorySchema,
  CreateStoryRequestSchema,
  UpdateStoryRequestSchema,
  GetStoriesQuerySchema,
  StoryResponseSchema,
  StoriesResponseSchema,
  DevelopShotsRequestSchema,
  DevelopShotsResponseSchema,
  SceneSchema,
  storyValidators,
  validateStoryStructure,
  validateDevelopShotsRequest,
} from '../schemas/story.schema';

export type {
  Story,
  CreateStoryRequest,
  UpdateStoryRequest,
  GetStoriesQuery,
  StoryResponse,
  StoriesResponse,
  DevelopShotsRequest,
  DevelopShotsResponse,
  Scene,
  ScenePrompt,
  TimelineElement,
  Genre,
  Tone,
  TargetAudience,
} from '../schemas/story.schema';