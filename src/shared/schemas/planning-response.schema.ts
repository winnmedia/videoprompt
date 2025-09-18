/**
 * 🚀 Planning API 표준 응답 스키마
 * 듀얼 저장소 상태 정보를 포함한 표준화된 응답 형식
 *
 * 핵심 원칙:
 * - 저장소 상태 투명성: 클라이언트가 저장소 상태를 인지
 * - 부분 실패 대응: degraded 플래그로 서비스 지속성 보장
 * - 데이터 무결성: warnings를 통한 일관성 문제 알림
 * - Contract-First: Zod를 통한 런타임 검증
 */

import { z } from 'zod';

// ============================================================================
// Storage Status Schema
// ============================================================================

export const StorageStatusSchema = z.object({
  prisma: z.enum(['healthy', 'degraded', 'failed']),
  supabase: z.enum(['healthy', 'degraded', 'failed'])
});

export type StorageStatus = z.infer<typeof StorageStatusSchema>;

// ============================================================================
// Base Planning Response Schema
// ============================================================================

export const BasePlanningResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(), // 각 API별로 구체적인 타입으로 재정의

  // 듀얼 저장소 상태 정보
  degraded: z.boolean().optional().describe('일부 저장소 실패 시 true'),
  warnings: z.array(z.string()).optional().describe('데이터 일관성 경고'),
  storageStatus: StorageStatusSchema.optional().describe('각 저장소별 상태'),

  // 메타데이터
  timestamp: z.number().describe('응답 생성 시각'),
  version: z.string().default('1.0').describe('API 버전')
});

export type BasePlanningResponse = z.infer<typeof BasePlanningResponseSchema>;

// ============================================================================
// Specific API Response Schemas
// ============================================================================

// Planning 등록 응답
export const PlanningRegisterResponseSchema = BasePlanningResponseSchema.extend({
  data: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    userId: z.string().nullable(),
    status: z.string(),
    createdAt: z.number(),
    updatedAt: z.number()
  }).nullable()
});

export type PlanningRegisterResponse = z.infer<typeof PlanningRegisterResponseSchema>;

// Planning 스토리 목록 응답
export const PlanningStoriesResponseSchema = BasePlanningResponseSchema.extend({
  data: z.object({
    stories: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      content: z.any(),
      userId: z.string().nullable(),
      status: z.string(),
      createdAt: z.number(),
      updatedAt: z.number()
    })),
    total: z.number(),
    page: z.number().optional(),
    limit: z.number().optional()
  }).nullable()
});

export type PlanningStoriesResponse = z.infer<typeof PlanningStoriesResponseSchema>;

// Planning 시나리오 응답
export const PlanningScenariosResponseSchema = BasePlanningResponseSchema.extend({
  data: z.object({
    scenarios: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      content: z.any(),
      userId: z.string().nullable(),
      status: z.string(),
      createdAt: z.number(),
      updatedAt: z.number()
    })),
    total: z.number()
  }).nullable()
});

export type PlanningScenariosResponse = z.infer<typeof PlanningScenariosResponseSchema>;

// ============================================================================
// Response Builder Utilities
// ============================================================================

/**
 * 듀얼 저장소 결과를 바탕으로 표준 응답 생성 (표준화된 버전)
 */
export interface DualStorageResult {
  id: string;
  success: boolean;
  error?: string;

  // 저장소별 세부 결과
  details?: {
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
  consistency?: 'full' | 'partial' | 'failed';
  degradationMode?: 'none' | 'supabase-disabled' | 'prisma-circuit-open' | 'supabase-circuit-open';

  // 메타데이터
  timestamp?: number;
  totalTime?: number; // ms

  // 레거시 호환 (deprecated)
  prismaSuccess?: boolean;
  supabaseSuccess?: boolean;
  prismaError?: string;
  supabaseError?: string;
}

/**
 * 저장소 헬스 상태를 바탕으로 StorageStatus 생성
 */
export function createStorageStatus(
  prismaHealthy: boolean,
  supabaseHealthy: boolean,
  prismaError?: string,
  supabaseError?: string
): StorageStatus {
  return {
    prisma: prismaHealthy ? 'healthy' : 'failed',
    supabase: supabaseHealthy ? 'healthy' : 'failed'
  };
}

/**
 * 듀얼 저장 결과를 바탕으로 응답 메타데이터 생성
 */
export function createResponseMetadata(result: DualStorageResult): {
  degraded: boolean;
  warnings: string[];
  storageStatus: StorageStatus;
} {
  const degraded = !result.success ||
    (result.prismaSuccess !== undefined && result.supabaseSuccess !== undefined &&
     !(result.prismaSuccess && result.supabaseSuccess));

  const warnings: string[] = [];

  // 부분 실패 경고
  if (result.prismaSuccess === false && result.supabaseSuccess === true) {
    warnings.push('Prisma 저장 실패: 데이터가 Supabase에만 저장됨');
  }
  if (result.prismaSuccess === true && result.supabaseSuccess === false) {
    warnings.push('Supabase 저장 실패: 데이터가 Prisma에만 저장됨');
  }

  // 완전 실패 경고
  if (!result.success) {
    warnings.push('모든 저장소 저장 실패');
  }

  const storageStatus = createStorageStatus(
    result.prismaSuccess ?? false,
    result.supabaseSuccess ?? false,
    result.prismaError,
    result.supabaseError
  );

  return { degraded, warnings, storageStatus };
}

/**
 * 표준 성공 응답 생성
 */
export function createSuccessResponse<T>(
  data: T,
  result?: DualStorageResult
): BasePlanningResponse & { data: T } {
  const baseResponse = {
    success: true,
    data,
    timestamp: Date.now(),
    version: '1.0'
  };

  if (result) {
    const metadata = createResponseMetadata(result);
    return {
      ...baseResponse,
      ...metadata
    };
  }

  return baseResponse;
}

/**
 * 표준 에러 응답 생성
 */
export function createErrorResponse(
  error: string,
  result?: DualStorageResult
): BasePlanningResponse {
  const baseResponse = {
    success: false,
    data: null,
    timestamp: Date.now(),
    version: '1.0'
  };

  if (result) {
    const metadata = createResponseMetadata(result);
    const warnings = [...(metadata.warnings || [])];

    // 원본 에러가 있으면 추가
    if (result.error) {
      warnings.push(result.error);
    }

    // 입력된 에러 메시지도 추가
    warnings.push(error);

    return {
      ...baseResponse,
      ...metadata,
      warnings
    };
  }

  return {
    ...baseResponse,
    warnings: [error]
  };
}

/**
 * Repository 응답을 표준화된 DualStorageResult로 변환
 */
export function normalizeRepositoryResult(
  repoResult: { id: string; success: boolean; error?: string },
  storageHealth?: { prisma: { isHealthy: boolean }; supabase: { isHealthy: boolean } },
  timing?: { total: number; prisma?: number; supabase?: number }
): DualStorageResult {
  const startTime = Date.now();

  return {
    id: repoResult.id,
    success: repoResult.success,
    error: repoResult.error,

    details: storageHealth ? {
      prisma: {
        attempted: true,
        success: storageHealth.prisma.isHealthy && repoResult.success,
        timing: timing?.prisma
      },
      supabase: {
        attempted: true,
        success: storageHealth.supabase.isHealthy && repoResult.success,
        timing: timing?.supabase
      }
    } : undefined,

    consistency: repoResult.success ? 'full' : 'failed',
    degradationMode: !storageHealth?.supabase.isHealthy ? 'supabase-disabled' :
                     !storageHealth?.prisma.isHealthy ? 'prisma-circuit-open' : 'none',

    timestamp: startTime,
    totalTime: timing?.total || (Date.now() - startTime),

    // 레거시 호환
    prismaSuccess: storageHealth?.prisma.isHealthy && repoResult.success,
    supabaseSuccess: storageHealth?.supabase.isHealthy && repoResult.success
  };
}

// ============================================================================
// Data Consistency Validation
// ============================================================================

/**
 * 두 저장소 간 데이터 일관성 검증
 */
export interface ConsistencyCheckResult {
  consistent: boolean;
  differences: string[];
  recommendations: string[];
}

/**
 * 기본 콘텐츠 일관성 검증 (향후 확장 가능)
 */
export function validateDataConsistency(
  prismaData: any,
  supabaseData: any
): ConsistencyCheckResult {
  const differences: string[] = [];
  const recommendations: string[] = [];

  if (!prismaData && !supabaseData) {
    return { consistent: true, differences, recommendations };
  }

  if (!prismaData || !supabaseData) {
    differences.push('한쪽 저장소에만 데이터 존재');
    recommendations.push('누락된 저장소에 데이터 동기화 필요');
    return { consistent: false, differences, recommendations };
  }

  // 기본 필드 검증
  const basicFields = ['id', 'type', 'title', 'status'];
  for (const field of basicFields) {
    if (prismaData[field] !== supabaseData[field]) {
      differences.push(`${field} 불일치: Prisma(${prismaData[field]}) vs Supabase(${supabaseData[field]})`);
    }
  }

  // 타임스탬프 검증 (5초 이내 차이는 허용)
  const prismaTime = new Date(prismaData.updatedAt || prismaData.updated_at).getTime();
  const supabaseTime = new Date(supabaseData.updatedAt || supabaseData.updated_at).getTime();
  const timeDiff = Math.abs(prismaTime - supabaseTime);

  if (timeDiff > 5000) { // 5초 초과
    differences.push(`업데이트 시간 불일치: ${timeDiff}ms 차이`);
    recommendations.push('최신 데이터로 동기화 필요');
  }

  const consistent = differences.length === 0;

  return { consistent, differences, recommendations };
}