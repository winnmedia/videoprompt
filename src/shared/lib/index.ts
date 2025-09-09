/**
 * Shared 레이어 공개 API
 * FSD 아키텍처에 따른 공개 인터페이스
 */

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
// 서비스 내보내기
// =============================================================================

export {
  StoryboardGeneratorService,
  generateStoryboard,
  generateSingleShot,
  batchGenerateShots,
  saveStoryboard,
  getGenerationState,
  clearCache,
  getCacheStats,
} from './services/storyboard-generator';

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

export {
  useGenerateStoryboard,
  useGenerateSingleShot,
  useBatchGenerateShots,
  useSaveStoryboard,
  useGenerationStatus,
  useCacheStats,
  useStoryboard,
  useGenerationHistory,
  useOptimisticStoryboardUpdate,
} from './query/hooks/useStoryboardGeneration';

// =============================================================================
// MSW Mock 핸들러 (개발/테스트용)
// =============================================================================

export { handlers, errorHandlers, successHandlers } from './mocks/handlers';
export { worker, startMSW } from './mocks/browser';
export { server, setupTestServer } from './mocks/server';

// =============================================================================
// 기존 유틸리티 내보내기
// =============================================================================

export { cn } from './utils';
export { prefetch } from './prefetch';
export { logger } from './logger';
export { createApiResponse, ApiError } from './api-response';
export * from './auth';