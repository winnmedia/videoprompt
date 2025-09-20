/**
 * Planning 도메인 타입 정의
 * FSD Architecture - Entities Layer
 *
 * 핵심 원칙:
 * - Zod 스키마에서 자동 생성된 타입 사용 (Single Source of Truth)
 * - 런타임 검증과 타입 안전성 동시 확보
 * - 데이터 계약 일관성 보장
 */

import {
  ContentTypeSchema,
  ContentStatusSchema,
  BaseContentSchema,
  ScenarioContentSchema,
  PromptContentSchema,
  VideoContentSchema,
  type PlanningContent as PlanningContentFromContract,
  type ContentType as ContentTypeFromContract,
  type ContentStatus as ContentStatusFromContract
} from '@/shared/contracts/planning.contract';
import { z } from 'zod';

// Zod 스키마에서 자동 생성된 타입들 (Single Source of Truth)
export type ContentType = ContentTypeFromContract;
export type ContentStatus = ContentStatusFromContract;

// Storage status는 아직 contract에 없으므로 임시로 유지 (TODO: contract에 추가)
export type StorageStatus =
  | 'pending'    // 저장 대기
  | 'saving'     // 저장 중
  | 'saved'      // 저장 완료
  | 'failed'     // 저장 실패
  | 'partial';   // 부분 저장 (Prisma만 또는 Supabase만)

// ============================================================================
// 도메인 핵심 엔티티
// ============================================================================

/**
 * 기본 컨텐츠 엔티티 - Zod 스키마에서 자동 생성 (Single Source of Truth)
 */
export type BaseContent = z.infer<typeof BaseContentSchema> & {
  // Storage status 추가 (아직 contract에 없는 필드)
  storageStatus: StorageStatus;
  storage?: {
    prisma: { saved: boolean; error?: string };
    supabase: { saved: boolean; error?: string };
  };
};

/**
 * 시나리오 엔티티 - Zod 스키마에서 자동 생성 (Single Source of Truth)
 */
export type ScenarioContent = z.infer<typeof ScenarioContentSchema> & {
  // Storage status 추가 (아직 contract에 없는 필드)
  storageStatus: StorageStatus;
  storage?: {
    prisma: { saved: boolean; error?: string };
    supabase: { saved: boolean; error?: string };
  };
};

/**
 * 프롬프트 엔티티 - Zod 스키마에서 자동 생성 (Single Source of Truth)
 */
export type PromptContent = z.infer<typeof PromptContentSchema> & {
  // Storage status 추가 (아직 contract에 없는 필드)
  storageStatus: StorageStatus;
  storage?: {
    prisma: { saved: boolean; error?: string };
    supabase: { saved: boolean; error?: string };
  };
};

/**
 * 영상 엔티티 - Zod 스키마에서 자동 생성 (Single Source of Truth)
 */
export type VideoContent = z.infer<typeof VideoContentSchema> & {
  // Storage status 추가 (아직 contract에 없는 필드)
  storageStatus: StorageStatus;
  storage?: {
    prisma: { saved: boolean; error?: string };
    supabase: { saved: boolean; error?: string };
  };
};

/**
 * 유니온 타입 - 모든 컨텐츠 타입
 */
export type PlanningContent = ScenarioContent | PromptContent | VideoContent;

/**
 * 하위 호환성을 위한 타입 별칭들
 */
export type VideoItem = VideoContent;
export type ScenarioItem = ScenarioContent;
export type PromptItem = PromptContent;
export type PlanningItem = PlanningContent;

/**
 * 플래닝 상태 관리 타입
 */
export interface PlanningState {
  scenarios: ScenarioContent[];
  prompts: PromptContent[];
  videos: VideoContent[];
  loading: boolean;
  error?: string;
}

/**
 * 이미지 자산 타입 (플래이스홀더)
 */
export interface ImageAsset {
  id: string;
  url: string;
  alt?: string;
  metadata?: Record<string, any>;
  title?: string;
  dimensions?: string;
  format?: string;
  fileSize?: number;
  createdAt?: string;
  tags?: string[];
}

/**
 * 플래닝 메타데이터 (Repository 호환)
 */
export interface PlanningMetadata {
  userId?: string;
  projectId?: string;
  status?: ContentStatus;
  storageStatus?: StorageStatus;
  createdAt?: number;
  updatedAt?: number;
  version?: number;
  author?: string;
  source?: string;
}

// ============================================================================
// Value Objects
// ============================================================================

/**
 * 프로젝트 식별자
 */
export interface ProjectId {
  readonly value: string;
}

/**
 * 컨텐츠 식별자
 */
export interface ContentId {
  readonly value: string;
}

/**
 * 이중 저장소 결과 (Repository 표준 응답)
 */
export interface DualStorageResult {
  id: string;
  success: boolean;
  error?: string;

  // 저장소별 세부 결과
  details: {
    prisma: {
      attempted: boolean;
      success: boolean;
      error?: string;
      timing?: number; // ms
    };
    supabase: {
      attempted: boolean;
      success: boolean;
      error?: string;
      timing?: number; // ms
    };
  };

  // 일관성 상태
  consistency: 'full' | 'partial' | 'failed';
  degradationMode: 'none' | 'supabase-disabled' | 'prisma-circuit-open' | 'supabase-circuit-open';

  // 메타데이터
  timestamp: number;
  totalTime: number; // ms
}

/**
 * 데이터 조회 결과
 */
export interface DualStorageQueryResult<T = BaseContent> {
  data: T | T[] | null;
  source: 'prisma' | 'supabase' | 'merged';

  // 조회 성능 정보
  timing: {
    prisma?: number; // ms
    supabase?: number; // ms
    total: number; // ms
  };

  // 에러 정보
  errors: {
    prisma?: string;
    supabase?: string;
  };
}

/**
 * 저장 결과 (레거시 호환)
 */
export interface StorageResult {
  success: boolean;
  contentId: string;
  storage: {
    prisma: { success: boolean; error?: string };
    supabase: { success: boolean; error?: string };
  };
  message: string;
  consistency: 'full' | 'partial' | 'failed';
}

/**
 * 듀얼 스토리지 설정
 */
export interface DualStorageConfig {
  prismaEnabled: boolean;
  supabaseEnabled: boolean;
  requireBoth: boolean; // 둘 다 성공해야 하는지
  fallbackToPrisma: boolean; // Supabase 실패 시 Prisma만으로 진행
}

// ============================================================================
// 도메인 이벤트
// ============================================================================

export type DomainEvent =
  | ContentCreatedEvent
  | ContentUpdatedEvent
  | StorageFailedEvent
  | ConsistencyRestoredEvent;

export interface ContentCreatedEvent {
  type: 'ContentCreated';
  contentId: string;
  contentType: ContentType;
  projectId: string;
  timestamp: string;
}

export interface ContentUpdatedEvent {
  type: 'ContentUpdated';
  contentId: string;
  changes: Partial<PlanningContent>;
  timestamp: string;
}

export interface StorageFailedEvent {
  type: 'StorageFailed';
  contentId: string;
  storage: 'prisma' | 'supabase' | 'both';
  error: string;
  timestamp: string;
}

export interface ConsistencyRestoredEvent {
  type: 'ConsistencyRestored';
  contentId: string;
  restoredFrom: 'prisma' | 'supabase';
  timestamp: string;
}

// ============================================================================
// 에러 타입
// ============================================================================

export class PlanningDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'PlanningDomainError';
  }
}

export class StorageConsistencyError extends PlanningDomainError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_CONSISTENCY_ERROR', details);
  }
}

export class InvalidContentError extends PlanningDomainError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_CONTENT_ERROR', details);
  }
}

export class DualStorageError extends PlanningDomainError {
  constructor(message: string, details?: any) {
    super(message, 'DUAL_STORAGE_ERROR', details);
  }
}
