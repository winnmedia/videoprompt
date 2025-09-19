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
  type PrismaRepository,
  type SupabaseRepository,
  type DualStorageDependencies
} from './model/services';

// Repository Export
export {
  getPlanningRepository,
  type DualPlanningRepository
} from './model/repository';

// Infrastructure Export (Repository 구현체)
export {
  createPrismaRepository,
  PrismaRepositoryImpl
} from './infrastructure/prisma-repository';

export {
  createSupabaseRepository,
  SupabaseRepositoryImpl
} from './infrastructure/supabase-repository';

export {
  getDualStorageFactory,
  createDualStorageDependencies,
  DualStorageFactory
} from './infrastructure/dual-storage-factory';