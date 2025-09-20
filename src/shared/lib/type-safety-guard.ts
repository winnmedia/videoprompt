/**
 * 타입 안전성 런타임 가드
 * TDD 기반 타입 검증 시스템
 *
 * QA Lead Grace - 무관용 타입 안전성 정책
 */

import { z } from 'zod';
import type { BaseContent, PlanningContent, ContentType, ContentStatus, StorageStatus } from '@/entities/planning';
import { logger } from './logger';


// ============================================================================
// 런타임 스키마 정의 (Zod)
// ============================================================================

/**
 * ContentType 스키마 - 새 Zod 버전 호환
 */
export const ContentTypeSchema = z.enum(['scenario', 'prompt', 'video', 'story', 'image']);

/**
 * ContentStatus 스키마 - 새 Zod 버전 호환
 */
export const ContentStatusSchema = z.enum(['draft', 'active', 'processing', 'completed', 'failed', 'archived']);

/**
 * StorageStatus 스키마 - 새 Zod 버전 호환
 */
export const StorageStatusSchema = z.enum(['pending', 'saving', 'saved', 'failed', 'partial']);

/**
 * BaseContent 런타임 스키마
 */
export const BaseContentSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  type: ContentTypeSchema,
  title: z.string().min(1, 'Title은 필수입니다'),
  userId: z.string().optional(),
  projectId: z.string().optional(), // 중요: Prisma 스키마와 일치
  status: ContentStatusSchema,
  source: z.string().optional(),
  storageStatus: StorageStatusSchema,
  createdAt: z.string().datetime('Invalid createdAt format'),
  updatedAt: z.string().datetime('Invalid updatedAt format'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  storage: z.object({
    prisma: z.object({
      saved: z.boolean(),
      error: z.string().optional()
    }),
    supabase: z.object({
      saved: z.boolean(),
      error: z.string().optional()
    })
  }).optional()
});

/**
 * Scenario Content 스키마
 */
export const ScenarioContentSchema = BaseContentSchema.extend({
  type: z.literal('scenario'),
  story: z.string().min(1, 'Story content is required'),
  genre: z.string().optional(),
  tone: z.string().optional(),
  target: z.string().optional(),
  format: z.string().optional(),
  tempo: z.string().optional(),
  developmentMethod: z.string().optional(),
  developmentIntensity: z.string().optional(),
  durationSec: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Prompt Content 스키마
 */
export const PromptContentSchema = BaseContentSchema.extend({
  type: z.literal('prompt'),
  scenarioTitle: z.string().optional(),
  finalPrompt: z.string().min(1, 'Final prompt is required'),
  keywords: z.array(z.string()).optional(),
  version: z.number().int().min(1).default(1),
  keywordCount: z.number().int().min(0).default(0),
  shotCount: z.number().int().min(0).default(0),
  quality: z.enum(['standard', 'premium']).default('standard'),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Video Content 스키마
 */
export const VideoContentSchema = BaseContentSchema.extend({
  type: z.literal('video'),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  processingJobId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Planning Content 유니온 스키마
 */
export const PlanningContentSchema = z.discriminatedUnion('type', [
  ScenarioContentSchema,
  PromptContentSchema,
  VideoContentSchema
]);

// ============================================================================
// 타입 가드 함수들
// ============================================================================

/**
 * 타입 안전성 검증 결과
 */
export interface TypeValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: z.ZodError;
}

/**
 * BaseContent 타입 가드
 */
export function isBaseContent(data: unknown): data is BaseContent {
  try {
    BaseContentSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * BaseContent 검증 함수 (상세 결과 포함)
 */
export function validateBaseContent(data: unknown): TypeValidationResult<BaseContent> {
  try {
    const validated = BaseContentSchema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        details: error
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

/**
 * PlanningContent 타입 가드
 */
export function isPlanningContent(data: unknown): data is PlanningContent {
  try {
    PlanningContentSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * PlanningContent 검증 함수
 */
export function validatePlanningContent(data: unknown): TypeValidationResult<PlanningContent> {
  try {
    const validated = PlanningContentSchema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        details: error
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

// ============================================================================
// Prisma 호환성 검증
// ============================================================================

/**
 * Prisma Planning 모델과의 호환성 검증
 */
export function validatePrismaCompatibility(data: unknown): TypeValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'Data must be an object'
    };
  }

  const obj = data as Record<string, unknown>;

  // 필수 Prisma 필드 검증
  const requiredFields = ['id', 'type', 'title', 'content', 'status'];
  const missingFields = requiredFields.filter(field => !(field in obj));

  if (missingFields.length > 0) {
    return {
      success: false,
      error: `Missing required Prisma fields: ${missingFields.join(', ')}`
    };
  }

  // projectId 필드 검증 (선택적이지만 있으면 string이어야 함)
  if ('projectId' in obj && obj.projectId !== null && typeof obj.projectId !== 'string') {
    return {
      success: false,
      error: 'projectId must be string or null'
    };
  }

  return {
    success: true
  };
}

// ============================================================================
// 런타임 어설션 함수들
// ============================================================================

/**
 * BaseContent 어설션 (실패 시 에러 발생)
 */
export function assertBaseContent(data: unknown, context?: string): asserts data is BaseContent {
  const result = validateBaseContent(data);
  if (!result.success) {
    const contextMsg = context ? ` in ${context}` : '';
    throw new TypeError(`Invalid BaseContent${contextMsg}: ${result.error}`);
  }
}

/**
 * PlanningContent 어설션
 */
export function assertPlanningContent(data: unknown, context?: string): asserts data is PlanningContent {
  const result = validatePlanningContent(data);
  if (!result.success) {
    const contextMsg = context ? ` in ${context}` : '';
    throw new TypeError(`Invalid PlanningContent${contextMsg}: ${result.error}`);
  }
}

// ============================================================================
// 개발 모드 디버깅 도구
// ============================================================================

/**
 * 타입 검증 디버그 정보
 */
export function debugTypeValidation(data: unknown, schemaName: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  console.group(`🔍 Type Validation Debug: ${schemaName}`);
  logger.info('Data:', data);

  const baseResult = validateBaseContent(data);
  logger.info('BaseContent validation:', baseResult);

  if (!baseResult.success && baseResult.details) {
    logger.info('Validation errors:', baseResult.details.issues);
  }

  console.groupEnd();
}

// ============================================================================
// 빌드 타임 타입 체크
// ============================================================================

/**
 * 컴파일 타임 타입 체크 (빌드 실패 감지용)
 */
export type TypeSafetyCheck = {
  // Planning 모델 필드 체크
  planningProjectId: BaseContent['projectId'] extends string | undefined ? true : false;
  planningStorageStatus: BaseContent['storageStatus'] extends StorageStatus ? true : false;

  // Zod 스키마 호환성 체크
  zodContentType: z.infer<typeof ContentTypeSchema> extends ContentType ? true : false;
  zodContentStatus: z.infer<typeof ContentStatusSchema> extends ContentStatus ? true : false;
};

// 컴파일 타임 검증 (빌드 실패 시 타입 오류 발생)
const _buildTimeCheck: TypeSafetyCheck = {
  planningProjectId: true,
  planningStorageStatus: true,
  zodContentType: true,
  zodContentStatus: true
};

// 사용하지 않는 변수 경고 방지
void _buildTimeCheck;
