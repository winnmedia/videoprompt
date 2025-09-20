/**
 * Planning 데이터 계약 스키마 (Zod)
 * 런타임 검증과 타입 안전성을 제공하는 Planning 도메인 계약
 *
 * 핵심 원칙:
 * - Contract-First: 모든 데이터는 계약을 먼저 통과
 * - Runtime Validation: 런타임에서 스키마 위반 차단
 * - Type Safety: TypeScript 타입 자동 생성
 * - Evolvable: 버전 관리 가능한 스키마 설계
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * 콘텐츠 타입 열거
 */
export const ContentTypeSchema = z.enum(['scenario', 'prompt', 'video', 'story', 'image']);

/**
 * 콘텐츠 상태 열거
 */
export const ContentStatusSchema = z.enum(['draft', 'active', 'processing', 'completed', 'failed', 'archived']);

/**
 * UUID 형태 검증 (유연한 ID 형식 허용)
 */
export const IdSchema = z.string().min(1, 'ID는 비어있을 수 없습니다.').max(100, 'ID는 100자 이하여야 합니다.');

/**
 * 사용자 ID 스키마 (null 허용)
 */
export const UserIdSchema = z.string().min(1).max(100).nullable();

/**
 * 타임스탬프 스키마 (Unix timestamp)
 */
export const TimestampSchema = z.number().int().min(0, '타임스탬프는 0 이상이어야 합니다.');

/**
 * 제목 스키마
 */
export const TitleSchema = z.string().min(1, '제목은 비어있을 수 없습니다.').max(500, '제목은 500자 이하여야 합니다.');

// ============================================================================
// Metadata Schema
// ============================================================================

/**
 * Planning 메타데이터 스키마
 */
export const PlanningMetadataSchema = z.object({
  userId: UserIdSchema.optional(),
  status: ContentStatusSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
  projectId: z.string().optional(),
  version: z.number().int().min(1).optional(),
  author: z.string().optional()
}).strict(); // 추가 필드 허용 안함

// ============================================================================
// Base Content Schema
// ============================================================================

/**
 * 기본 콘텐츠 스키마
 */
export const BaseContentSchema = z.object({
  id: IdSchema,
  type: ContentTypeSchema,
  title: TitleSchema.optional(),
  userId: UserIdSchema.optional(),
  projectId: IdSchema.optional(),
  status: ContentStatusSchema,
  source: z.string().optional(),
  createdAt: z.string().datetime('Invalid createdAt format'),
  updatedAt: z.string().datetime('Invalid updatedAt format'),
  metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

// ============================================================================
// Extended Content Schemas
// ============================================================================

/**
 * 시나리오 콘텐츠 스키마
 */
export const ScenarioContentSchema = BaseContentSchema.extend({
  type: z.literal('scenario'),
  title: TitleSchema,
  story: z.string().optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  target: z.string().optional(),
  format: z.string().optional(),
  tempo: z.string().optional(),
  developmentMethod: z.string().optional(),
  developmentIntensity: z.string().optional(),
  durationSec: z.number().int().min(0).optional()
}).strict();

/**
 * 프롬프트 콘텐츠 스키마
 */
export const PromptContentSchema = BaseContentSchema.extend({
  type: z.literal('prompt'),
  scenarioTitle: z.string().optional(),
  finalPrompt: z.string().min(1, '프롬프트는 비어있을 수 없습니다.'),
  keywords: z.array(z.string()).optional(),
  version: z.number().int().min(1).optional().default(1),
  keywordCount: z.number().int().min(0).optional().default(0),
  shotCount: z.number().int().min(0).optional().default(0),
  quality: z.enum(['standard', 'premium']).optional().default('standard')
}).strict();

/**
 * 비디오 콘텐츠 스키마
 */
export const VideoContentSchema = BaseContentSchema.extend({
  type: z.literal('video'),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  processingJobId: z.string().optional(),
  provider: z.string().optional(),
  duration: z.number().positive().optional(),
  aspectRatio: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

/**
 * 스토리 콘텐츠 스키마
 */
export const StoryContentSchema = BaseContentSchema.extend({
  type: z.literal('story'),
  title: TitleSchema,
  content: z.string().min(1, '스토리 내용은 비어있을 수 없습니다.'),
  oneLineStory: z.string().optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  targetAudience: z.string().optional()
}).strict();

/**
 * 이미지 콘텐츠 스키마
 */
export const ImageContentSchema = BaseContentSchema.extend({
  type: z.literal('image'),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
}).strict();

/**
 * 유니온 콘텐츠 스키마 (타입에 따른 자동 검증)
 */
export const PlanningContentSchema = z.discriminatedUnion('type', [
  ScenarioContentSchema,
  PromptContentSchema,
  VideoContentSchema,
  StoryContentSchema,
  ImageContentSchema
]);

// ============================================================================
// Repository Response Schemas
// ============================================================================

/**
 * 저장소 응답 스키마
 */
export const RepositoryResponseSchema = z.object({
  id: IdSchema,
  success: z.boolean(),
  error: z.string().optional()
}).strict();

/**
 * 이중 저장소 결과 스키마
 */
export const DualStorageResultSchema = z.object({
  id: IdSchema,
  success: z.boolean(),
  error: z.string().optional(),

  details: z.object({
    prisma: z.object({
      attempted: z.boolean(),
      success: z.boolean(),
      error: z.string().optional(),
      timing: z.number().int().min(0).optional()
    }).strict(),
    supabase: z.object({
      attempted: z.boolean(),
      success: z.boolean(),
      error: z.string().optional(),
      timing: z.number().int().min(0).optional()
    }).strict()
  }).strict().optional(),

  consistency: z.enum(['full', 'partial', 'failed']).optional(),
  degradationMode: z.enum(['none', 'supabase-disabled', 'prisma-circuit-open', 'supabase-circuit-open']).optional(),
  timestamp: TimestampSchema.optional(),
  totalTime: z.number().int().min(0).optional(),

  // 레거시 호환
  prismaSuccess: z.boolean().optional(),
  supabaseSuccess: z.boolean().optional(),
  prismaError: z.string().optional(),
  supabaseError: z.string().optional()
}).strict();

/**
 * 헬스 상태 스키마
 */
export const StorageHealthSchema = z.object({
  prisma: z.object({
    failures: z.number().int().min(0),
    lastFailure: z.number().int().min(0),
    isHealthy: z.boolean()
  }).strict(),
  supabase: z.object({
    failures: z.number().int().min(0),
    lastFailure: z.number().int().min(0),
    isHealthy: z.boolean()
  }).strict()
}).strict();

// ============================================================================
// API Request/Response Schemas
// ============================================================================

/**
 * Planning 생성 요청 스키마
 */
export const CreatePlanningRequestSchema = z.object({
  type: ContentTypeSchema,
  title: TitleSchema,
  content: z.any(), // 타입별로 다르므로 any 허용
  metadata: PlanningMetadataSchema.optional()
}).strict();

/**
 * Planning 업데이트 요청 스키마
 */
export const UpdatePlanningRequestSchema = z.object({
  title: TitleSchema.optional(),
  content: z.any().optional(),
  metadata: PlanningMetadataSchema.optional()
}).strict();

/**
 * Planning 조회 쿼리 스키마
 */
export const GetPlanningQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: ContentTypeSchema.optional(),
  status: ContentStatusSchema.optional(),
  search: z.string().max(100).optional(),
  userId: UserIdSchema.optional()
}).strict();

// ============================================================================
// Type Exports (TypeScript Types)
// ============================================================================

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type PlanningMetadata = z.infer<typeof PlanningMetadataSchema>;
export type BaseContent = z.infer<typeof BaseContentSchema>;
export type ScenarioContent = z.infer<typeof ScenarioContentSchema>;
export type PromptContent = z.infer<typeof PromptContentSchema>;
export type VideoContent = z.infer<typeof VideoContentSchema>;
export type StoryContent = z.infer<typeof StoryContentSchema>;
export type ImageContent = z.infer<typeof ImageContentSchema>;
export type PlanningContent = z.infer<typeof PlanningContentSchema>;
export type RepositoryResponse = z.infer<typeof RepositoryResponseSchema>;
export type DualStorageResult = z.infer<typeof DualStorageResultSchema>;
export type StorageHealth = z.infer<typeof StorageHealthSchema>;
export type CreatePlanningRequest = z.infer<typeof CreatePlanningRequestSchema>;
export type UpdatePlanningRequest = z.infer<typeof UpdatePlanningRequestSchema>;
export type GetPlanningQuery = z.infer<typeof GetPlanningQuerySchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * 안전한 데이터 검증 헬퍼
 */
export function validatePlanningContent(data: unknown): {
  success: boolean;
  data?: PlanningContent;
  error?: string;
} {
  try {
    const validated = PlanningContentSchema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: errorMessage
      };
    }
    return {
      success: false,
      error: '알 수 없는 검증 오류'
    };
  }
}

/**
 * 메타데이터 기본값 생성
 */
export function createDefaultMetadata(userId?: string | null): PlanningMetadata {
  const now = Date.now();
  return {
    userId: userId || null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

/**
 * 이중 저장소 결과 검증
 */
export function validateDualStorageResult(data: unknown): {
  success: boolean;
  data?: DualStorageResult;
  error?: string;
} {
  try {
    const validated = DualStorageResultSchema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: errorMessage
      };
    }
    return {
      success: false,
      error: '이중 저장소 결과 검증 실패'
    };
  }
}

// ============================================================================
// Schema Evolution Support
// ============================================================================

/**
 * 스키마 버전 정보
 */
export const PLANNING_SCHEMA_VERSION = '1.0.0';

/**
 * 스키마 호환성 체크
 */
export function checkSchemaCompatibility(version: string): boolean {
  // 현재는 단일 버전만 지원
  return version === PLANNING_SCHEMA_VERSION;
}

/**
 * 스키마 마이그레이션 (향후 버전 업그레이드 시 사용)
 */
export function migrateToCurrentSchema(data: any, fromVersion: string): any {
  // 현재는 마이그레이션 불필요
  if (fromVersion === PLANNING_SCHEMA_VERSION) {
    return data;
  }

  // 향후 버전 간 마이그레이션 로직 구현
  throw new Error(`지원하지 않는 스키마 버전: ${fromVersion}`);
}

// ============================================================================
// Development & Testing Utilities
// ============================================================================

/**
 * 테스트용 Mock 데이터 생성
 */
export function createMockBaseContent(overrides: Partial<BaseContent> = {}): BaseContent {
  return {
    id: 'test-id-' + Date.now(),
    type: 'scenario',
    title: 'Test Content',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: createDefaultMetadata('test-user'),
    ...overrides
  };
}

/**
 * 테스트용 Mock 시나리오 생성
 */
export function createMockScenarioContent(overrides: Partial<ScenarioContent> = {}): ScenarioContent {
  return {
    id: 'test-scenario-' + Date.now(),
    type: 'scenario',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Test Scenario',
    story: 'A test story for validation',
    genre: 'Drama',
    tone: 'Serious',
    target: 'Adults',
    metadata: createDefaultMetadata('test-user'),
    ...overrides
  };
}

/**
 * 계약 검증 상태 체크 (개발/테스트 환경)
 */
export function checkContractViolations(data: unknown[]): {
  totalItems: number;
  validItems: number;
  violations: Array<{
    index: number;
    errors: string[];
  }>;
} {
  const violations: Array<{ index: number; errors: string[] }> = [];
  let validItems = 0;

  data.forEach((item, index) => {
    const validation = validatePlanningContent(item);
    if (validation.success) {
      validItems++;
    } else {
      violations.push({
        index,
        errors: validation.error ? [validation.error] : ['Unknown validation error']
      });
    }
  });

  return {
    totalItems: data.length,
    validItems,
    violations
  };
}
