/**
 * Planning Storage 타입 정의
 *
 * 목적: 이중 저장 시스템의 타입 안전성 보장
 * 범위: Redux 상태, API 요청/응답, 메트릭 데이터
 */

// ============================================================================
// 기본 타입 정의
// ============================================================================

/**
 * 저장 요청 상태
 */
export type StorageStatus = 'idle' | 'loading' | 'error';

/**
 * 컨텐츠 타입
 */
export type ContentType = 'story' | 'scenario' | 'prompt' | 'video';

/**
 * 저장 전략
 */
export type StorageStrategy =
  | 'dual_storage_required'    // 양쪽 모두 성공 필수
  | 'dual_storage_preferred'   // Supabase 실패해도 계속
  | 'prisma_only_fallback'     // Prisma만 사용
  | 'mock_supabase';           // 테스트용

// ============================================================================
// API 요청/응답 타입
// ============================================================================

/**
 * 이중 저장 요청 데이터
 */
export interface StorageRequest {
  // 기본 정보
  type: ContentType;
  projectId: string;
  source: string;
  createdAt: string;

  // 컨텐츠별 필드 (선택적)
  title?: string;
  description?: string;

  // Story 필드
  oneLineStory?: string;
  story?: string;
  genre?: string;
  tone?: string;
  target?: string;
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
  durationSec?: number;

  // Prompt 필드
  scenarioTitle?: string;
  finalPrompt?: string;
  keywords?: string[];
  negativePrompt?: string;
  visualStyle?: string;
  mood?: string;
  quality?: string;
  directorStyle?: string;

  // Video 필드
  provider?: string;
  status?: string;
  videoUrl?: string;
  refPromptTitle?: string;
  jobId?: string;
  operationId?: string;
}

/**
 * 이중 저장 결과
 */
export interface DualStorageResult {
  success: boolean;

  // Prisma 저장 결과
  prismaResult: {
    saved: boolean;
    id?: string;
    error?: string;
  };

  // Supabase 저장 결과
  supabaseResult: {
    saved: boolean;
    tables: {
      story: boolean;
      scenario: boolean;
      prompt: boolean;
      videoGeneration: boolean;
    };
    error?: string;
  };

  // 메타데이터
  rollbackExecuted: boolean;
  timestamp: string;
  latencyMs?: number;
}

// ============================================================================
// Redux 상태 타입
// ============================================================================

/**
 * 활성 요청 정보
 */
export interface ActiveRequest extends StorageRequest {
  status: 'pending' | 'completed' | 'failed';
  startTime: number;
}

/**
 * 저장 결과 기록
 */
export interface StorageResultRecord {
  request?: StorageRequest;
  timestamp: string;
  // DualStorageResult의 모든 필드 포함
  success: boolean;
  prismaResult: DualStorageResult['prismaResult'];
  supabaseResult: DualStorageResult['supabaseResult'];
  rollbackExecuted: boolean;
  latencyMs?: number;
}

/**
 * 실패 기록
 */
export interface FailureRecord {
  request: StorageRequest;
  error: string;
  timestamp: string;
}

/**
 * 성능 메트릭
 */
export interface StorageMetrics {
  // 전체 성능
  averageLatency: number;      // 평균 응답 시간 (ms)
  successRate: number;         // 전체 성공률 (%)

  // 개별 시스템 성능
  prismaSuccessRate: number;   // Prisma 성공률 (%)
  supabaseSuccessRate: number; // Supabase 성공률 (%)

  // 신뢰성 지표
  rollbackCount: number;       // 롤백 발생 횟수
}

/**
 * 메인 Redux 상태
 */
export interface PlanningStorageState {
  // 저장 상태
  status: StorageStatus;
  activeRequests: Map<string, ActiveRequest>;

  // 결과 추적
  results: {
    successful: StorageResultRecord[];
    failed: FailureRecord[];
    total: number;
  };

  // 성능 메트릭
  metrics: StorageMetrics;

  // 에러 처리
  lastError: string | null;
  retryQueue: StorageRequest[];
}

// ============================================================================
// Hook 타입
// ============================================================================

/**
 * usePlanningStorage 훅 반환 타입
 */
export interface UsePlanningStorageReturn {
  // 상태
  status: StorageStatus;
  isLoading: boolean;
  hasError: boolean;

  // 데이터
  metrics: StorageMetrics;
  recentResults: StorageResultRecord[];
  failedRequests: FailureRecord[];
  retryQueueSize: number;

  // 액션
  submitStorage: (request: StorageRequest) => Promise<DualStorageResult>;
  retryFailed: () => Promise<void>;
  clearError: () => void;
  resetState: () => void;
  resetMetrics: () => void;
}

// ============================================================================
// 유틸리티 타입
// ============================================================================

/**
 * 컨텐츠 타입별 필수 필드 검증
 */
export type RequiredFieldsForType<T extends ContentType> =
  T extends 'story' ? Pick<StorageRequest, 'story' | 'genre'> :
  T extends 'scenario' ? Pick<StorageRequest, 'title' | 'story'> :
  T extends 'prompt' ? Pick<StorageRequest, 'finalPrompt'> :
  T extends 'video' ? Pick<StorageRequest, 'videoUrl' | 'status'> :
  never;

/**
 * 타입 가드 헬퍼
 */
export function isValidStorageRequest(
  request: Partial<StorageRequest>
): request is StorageRequest {
  return !!(
    request.type &&
    request.projectId &&
    request.source &&
    request.createdAt
  );
}

/**
 * 컨텐츠 타입별 유효성 검증
 */
export function hasRequiredFields(request: StorageRequest): boolean {
  switch (request.type) {
    case 'story':
      return !!(request.story && request.genre);
    case 'scenario':
      return !!(request.title && request.story);
    case 'prompt':
      return !!request.finalPrompt;
    case 'video':
      return !!(request.videoUrl || request.status === 'processing');
    default:
      return false;
  }
}

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * 저장 전략별 설정
 */
export const STORAGE_STRATEGY_CONFIG = {
  dual_storage_required: {
    retryAttempts: 3,
    timeoutMs: 5000,
    fallbackEnabled: false,
  },
  dual_storage_preferred: {
    retryAttempts: 2,
    timeoutMs: 3000,
    fallbackEnabled: true,
  },
  prisma_only_fallback: {
    retryAttempts: 1,
    timeoutMs: 2000,
    fallbackEnabled: true,
  },
  mock_supabase: {
    retryAttempts: 0,
    timeoutMs: 1000,
    fallbackEnabled: true,
  },
} as const;

/**
 * 메트릭 임계값
 */
export const METRICS_THRESHOLDS = {
  SUCCESS_RATE_WARNING: 90,    // 성공률 90% 미만 시 경고
  SUCCESS_RATE_CRITICAL: 75,   // 성공률 75% 미만 시 심각
  LATENCY_WARNING: 2000,       // 평균 응답시간 2초 이상 시 경고
  LATENCY_CRITICAL: 5000,      // 평균 응답시간 5초 이상 시 심각
  ROLLBACK_WARNING: 5,         // 롤백 5회 이상 시 경고
} as const;