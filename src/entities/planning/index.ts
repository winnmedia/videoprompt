/**
 * Planning Entity Public API
 * FSD Architecture - Entities Layer
 */

// 도메인 타입 Export
export type {
  ContentType,
  ContentStatus,
  StorageStatus,
  BaseContent,
  ScenarioContent,
  PromptContent,
  VideoContent,
  PlanningContent,
  ProjectId,
  ContentId,
  StorageResult,
  DualStorageConfig,
  DomainEvent,
  ContentCreatedEvent,
  ContentUpdatedEvent,
  StorageFailedEvent,
  ConsistencyRestoredEvent,
  PlanningDomainError,
  StorageConsistencyError,
  InvalidContentError,
  DualStorageError,
  // 하위 호환성 타입들
  VideoItem,
  ScenarioItem,
  PromptItem,
  PlanningItem,
  PlanningState,
  ImageAsset
} from './model/types';

// 도메인 서비스 Export
export {
  saveScenario,
  savePrompt,
  saveVideo,
  type DualStorageDependencies
} from './model/services';

// Repository Interfaces (Pure Domain)
export {
  type PlanningRepository,
  type PrismaRepository,
  type SupabaseRepository,
  type DualStorageRepository,
  type DualStorageResult,
  type RepositoryFactory
} from './model/repository';

// Repository Factory Export (API 라우트용)
export {
  getPlanningRepository,
  getDualPlanningRepository
} from './model/repository-factory';

// Infrastructure Export (Repository 구현체) - Prisma 임시 비활성화
// export {
//   createPrismaRepository,
//   PrismaRepositoryImpl
// } from './infrastructure/prisma-repository';

export {
  createSupabaseRepository,
  SupabaseRepositoryImpl
} from './infrastructure/supabase-repository';

// Redux Store Export
export {
  planningReducer,
  setActiveTab,
  setLoading,
  setError,
  updateLastLoadTime,
  setScenarios,
  setPrompts,
  setVideos,
  setImages,
  updateScenario,
  updatePrompt,
  updateVideo,
  updateVideoStatus,
  setSelectedVideo,
  setSelectedItems,
  toggleSelectedItem,
  setBatchMode,
  setSearchTerm,
  setStatusFilter,
  setTypeFilter,
  setProviderFilter,
  setDateFilter,
  setSortBy,
  setEditingItem,
  setViewingItem,
  setShowCreateDialog,
  setCreateItemType,
  resetFilters,
  clearError,
  selectPlanningState,
  selectActiveTab,
  selectLoading,
  selectError,
  selectScenarios,
  selectPrompts,
  selectVideos,
  selectImages,
  selectSelectedVideo,
  selectSelectedItems,
  selectFilters,
  selectLastLoadTime,
  shouldRefreshData,
} from './store/planning-slice';

// export {
//   getDualStorageFactory,
//   createDualStorageDependencies,
//   DualStorageFactory
// } from './infrastructure/dual-storage-factory'; // Prisma 의존성으로 인한 임시 비활성화