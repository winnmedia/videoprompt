/**
 * Planning 도메인 타입 정의
 * FSD Architecture - Entities Layer
 *
 * 핵심 원칙:
 * - 비즈니스 도메인의 순수한 타입 정의
 * - 외부 기술에 의존하지 않음
 * - 단일 책임 원칙 준수
 */

export type ContentType = 'scenario' | 'prompt' | 'video' | 'story' | 'image';

export type ContentStatus =
  | 'draft'      // 초안
  | 'active'     // 활성
  | 'processing' // 처리 중
  | 'completed'  // 완료
  | 'failed'     // 실패
  | 'archived';  // 보관됨

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
 * 기본 컨텐츠 엔티티 (Repository 호환)
 */
export interface BaseContent {
  id: string;
  type: ContentType;
  title?: string;
  userId?: string;
  status?: ContentStatus;
  createdAt?: number;
  updatedAt?: number;

  // 메타데이터 (Repository 호환)
  metadata?: {
    userId?: string;
    status?: ContentStatus;
    createdAt?: number;
    updatedAt?: number;
    projectId?: string;
    version?: number;
    author?: string;
  };
}

/**
 * 시나리오 엔티티
 */
export interface ScenarioContent extends BaseContent {
  type: 'scenario';
  title: string;
  story: string;
  genre?: string;
  tone?: string;
  target?: string;
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
  durationSec?: number;

  // 시나리오 특화 메타데이터
  metadata: BaseContent['metadata'] & {
    hasFourStep?: boolean;
    hasTwelveShot?: boolean;
    wordCount?: number;
  };
}

/**
 * 프롬프트 엔티티
 */
export interface PromptContent extends BaseContent {
  type: 'prompt';
  scenarioTitle?: string;
  finalPrompt: string;
  keywords?: string[];

  // 프롬프트 특화 메타데이터
  metadata: BaseContent['metadata'] & {
    keywordCount?: number;
    segmentCount?: number;
    promptLength?: number;
  };
}

/**
 * 영상 엔티티
 */
export interface VideoContent extends BaseContent {
  type: 'video';
  videoUrl?: string;
  thumbnailUrl?: string;
  processingJobId?: string;

  // 영상 특화 메타데이터
  metadata: BaseContent['metadata'] & {
    duration?: number;
    resolution?: string;
    fileSize?: number;
    provider?: 'seedance' | 'mock';
  };
}

/**
 * 유니온 타입 - 모든 컨텐츠 타입
 */
export type PlanningContent = ScenarioContent | PromptContent | VideoContent;

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