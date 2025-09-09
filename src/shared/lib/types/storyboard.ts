/**
 * 스토리보드 생성 서비스 타입 정의
 * FSD 아키텍처 shared 레이어 - 공통 타입 정의
 */

import { z } from 'zod';

// =============================================================================
// 스토리보드 결과 타입
// =============================================================================

/**
 * 단일 스토리보드 샷 결과
 */
export const StoryboardResultSchema = z.object({
  /** 샷 고유 식별자 */
  shotId: z.string().uuid(),
  
  /** Base64 인코딩된 이미지 데이터 */
  imageData: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/),
  
  /** 이미지 생성에 사용된 프롬프트 */
  prompt: z.string().min(1),
  
  /** 메타데이터 */
  metadata: z.object({
    /** 생성 일시 */
    generatedAt: z.date(),
    
    /** 사용된 AI 모델 */
    model: z.enum(['imagen-4.0-fast', 'imagen-4.0', 'imagen-2.0', 'dall-e-3', 'placeholder']),
    
    /** 사용된 토큰 수 (선택) */
    tokensUsed: z.number().optional(),
    
    /** 생성 소요 시간 (ms) */
    generationTimeMs: z.number(),
    
    /** 이미지 크기 */
    size: z.enum(['512x512', '768x768', '1024x1024', '1280x720', '1920x1080']),
  }),
});

export type StoryboardResult = z.infer<typeof StoryboardResultSchema>;

// =============================================================================
// 생성 요청 타입
// =============================================================================

/**
 * 스토리보드 생성 요청 옵션
 */
export const StoryboardGenerationOptionsSchema = z.object({
  /** 프로젝트 ID */
  projectId: z.string().uuid(),
  
  /** 타임라인 세그먼트 ID 목록 */
  segmentIds: z.array(z.string()),
  
  /** 이미지 크기 */
  size: z.enum(['512x512', '768x768', '1024x1024', '1280x720', '1920x1080']).default('1024x1024'),
  
  /** 모델 선호도 */
  preferredModel: z.enum(['imagen-4.0-fast', 'imagen-4.0', 'dall-e-3', 'auto']).default('auto'),
  
  /** 동시 생성 개수 제한 */
  concurrencyLimit: z.number().min(1).max(5).default(3),
  
  /** 재시도 설정 */
  retryOptions: z.object({
    maxRetries: z.number().min(0).max(3).default(2),
    retryDelayMs: z.number().min(100).max(5000).default(1000),
  }).optional(),
});

export type StoryboardGenerationOptions = z.infer<typeof StoryboardGenerationOptionsSchema>;

/**
 * 단일 샷 생성 요청
 */
export const SingleShotGenerationRequestSchema = z.object({
  /** 샷 ID */
  shotId: z.string(),
  
  /** 프롬프트 */
  prompt: z.string().min(1).max(2000),
  
  /** 이미지 크기 */
  size: z.enum(['512x512', '768x768', '1024x1024', '1280x720', '1920x1080']).optional(),
  
  /** 모델 지정 */
  model: z.enum(['imagen-4.0-fast', 'imagen-4.0', 'dall-e-3', 'auto']).optional(),
});

export type SingleShotGenerationRequest = z.infer<typeof SingleShotGenerationRequestSchema>;

// =============================================================================
// 생성 상태 관리 타입
// =============================================================================

/**
 * 샷 생성 상태
 */
export enum ShotGenerationStatus {
  /** 대기 중 */
  PENDING = 'pending',
  /** 생성 중 */
  GENERATING = 'generating',
  /** 완료 */
  COMPLETED = 'completed',
  /** 실패 */
  FAILED = 'failed',
  /** 재시도 중 */
  RETRYING = 'retrying',
}

/**
 * 개별 샷 생성 상태
 */
export interface ShotGenerationState {
  /** 샷 ID */
  shotId: string;
  
  /** 현재 상태 */
  status: ShotGenerationStatus;
  
  /** 진행률 (0-100) */
  progress: number;
  
  /** 시작 시간 */
  startedAt?: Date;
  
  /** 완료 시간 */
  completedAt?: Date;
  
  /** 재시도 횟수 */
  retryCount: number;
  
  /** 에러 메시지 */
  errorMessage?: string;
  
  /** 결과 데이터 */
  result?: StoryboardResult;
}

/**
 * 전체 스토리보드 생성 상태
 */
export interface StoryboardGenerationState {
  /** 프로젝트 ID */
  projectId: string;
  
  /** 전체 진행률 (0-100) */
  overallProgress: number;
  
  /** 총 샷 개수 */
  totalShots: number;
  
  /** 완료된 샷 개수 */
  completedShots: number;
  
  /** 실패한 샷 개수 */
  failedShots: number;
  
  /** 시작 시간 */
  startedAt: Date;
  
  /** 예상 완료 시간 */
  estimatedCompletionTime?: Date;
  
  /** 개별 샷 상태 맵 */
  shotStates: Map<string, ShotGenerationState>;
  
  /** 현재 생성 중인 샷 ID 목록 */
  activeGenerations: string[];
}

// =============================================================================
// 배치 처리 타입
// =============================================================================

/**
 * 배치 생성 요청
 */
export interface BatchGenerationRequest {
  /** 배치 ID */
  batchId: string;
  
  /** 샷 요청 목록 */
  shots: SingleShotGenerationRequest[];
  
  /** 동시 처리 개수 */
  concurrency: number;
  
  /** 우선순위 (높을수록 먼저 처리) */
  priority: number;
}

/**
 * 배치 생성 결과
 */
export interface BatchGenerationResult {
  /** 배치 ID */
  batchId: string;
  
  /** 성공한 결과 목록 */
  successful: StoryboardResult[];
  
  /** 실패한 샷 ID와 에러 */
  failed: Array<{
    shotId: string;
    error: string;
  }>;
  
  /** 처리 시간 (ms) */
  processingTimeMs: number;
}

// =============================================================================
// 저장 및 캐싱 타입
// =============================================================================

/**
 * 스토리보드 저장 요청
 */
export interface StoryboardSaveRequest {
  /** 프로젝트 ID */
  projectId: string;
  
  /** 저장할 결과 목록 */
  results: StoryboardResult[];
  
  /** 저장 옵션 */
  options?: {
    /** 기존 데이터 덮어쓰기 여부 */
    overwrite?: boolean;
    
    /** 압축 여부 */
    compress?: boolean;
    
    /** 메타데이터 추가 */
    additionalMetadata?: Record<string, any>;
  };
}

/**
 * 프롬프트 캐시 엔트리
 */
export interface PromptCacheEntry {
  /** 캐시 키 (프롬프트 해시) */
  key: string;
  
  /** 원본 프롬프트 */
  prompt: string;
  
  /** 캐시된 이미지 데이터 */
  imageData: string;
  
  /** 캐시 생성 시간 */
  cachedAt: Date;
  
  /** 캐시 만료 시간 */
  expiresAt: Date;
  
  /** 캐시 히트 카운트 */
  hitCount: number;
  
  /** 모델 정보 */
  model: string;
  
  /** 이미지 크기 */
  size: string;
}

// =============================================================================
// 에러 타입
// =============================================================================

/**
 * 스토리보드 생성 에러 타입
 */
export enum StoryboardErrorType {
  /** API 키 누락 */
  MISSING_API_KEY = 'MISSING_API_KEY',
  
  /** API 한도 초과 */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  /** 잘못된 프롬프트 */
  INVALID_PROMPT = 'INVALID_PROMPT',
  
  /** 네트워크 에러 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  /** 모델 사용 불가 */
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  
  /** 타임아웃 */
  TIMEOUT = 'TIMEOUT',
  
  /** 알 수 없는 에러 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 스토리보드 생성 에러
 */
export class StoryboardGenerationError extends Error {
  constructor(
    public readonly type: StoryboardErrorType,
    public readonly message: string,
    public readonly shotId?: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'StoryboardGenerationError';
  }
}

// =============================================================================
// 유틸리티 타입
// =============================================================================

/**
 * 이미지 데이터 압축/해제 유틸리티 인터페이스
 */
export interface ImageCompressionUtils {
  /** Base64 이미지 압축 */
  compress(imageData: string): Promise<string>;
  
  /** 압축된 이미지 해제 */
  decompress(compressedData: string): Promise<string>;
  
  /** 이미지 리사이징 */
  resize(imageData: string, targetSize: string): Promise<string>;
}

/**
 * 프롬프트 최적화 유틸리티 인터페이스
 */
export interface PromptOptimizationUtils {
  /** 프롬프트 정규화 */
  normalize(prompt: string): string;
  
  /** 프롬프트 해시 생성 (캐싱용) */
  hash(prompt: string): string;
  
  /** 프롬프트 토큰 수 계산 */
  countTokens(prompt: string): number;
  
  /** 프롬프트 최적화 (토큰 제한 내) */
  optimize(prompt: string, maxTokens: number): string;
}