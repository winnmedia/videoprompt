/**
 * Storyboard API Schemas
 *
 * 스토리보드 API를 위한 Zod 스키마 정의
 * CLAUDE.md 준수: 런타임 검증, 비용 안전 규칙
 */

import { z } from 'zod';

// ===========================================
// 기본 스키마 정의
// ===========================================

export const ImageGenerationModelSchema = z.enum([
  'dall-e-3',
  'midjourney',
  'stable-diffusion',
  'runway-gen3',
  'seedream-4.0'
]);

export const ImageAspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']);

export const ImageQualitySchema = z.enum(['standard', 'hd', '4k']);

export const StylePresetSchema = z.enum([
  'cinematic',
  'anime',
  'photorealistic',
  'illustration',
  'sketch',
  'watercolor',
  'oil-painting',
  'digital-art',
  'cartoon',
  'vintage',
  'pencil',
  'rough',
  'monochrome',
  'colored'
]);

export const StoryboardFrameStatusSchema = z.enum([
  'pending',
  'generating',
  'completed',
  'failed',
  'retry'
]);

// ===========================================
// 이미지 생성 설정 스키마
// ===========================================

export const ImageGenerationConfigSchema = z.object({
  model: ImageGenerationModelSchema,
  aspectRatio: ImageAspectRatioSchema,
  quality: ImageQualitySchema,
  style: StylePresetSchema.optional(),
  seed: z.number().int().min(0).optional(),
  steps: z.number().int().min(1).max(100).optional(),
  guidanceScale: z.number().min(1).max(20).optional(),
  negativePrompt: z.string().max(500).optional(),
  customParams: z.record(z.unknown()).optional()
});

// ===========================================
// 일관성 참조 스키마
// ===========================================

export const ConsistencyReferenceSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['character', 'location', 'object', 'style']),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  referenceImageUrl: z.string().url().optional(),
  keyFeatures: z.array(z.string().max(100)).max(10),
  weight: z.number().min(0).max(1),
  isActive: z.boolean()
});

// ===========================================
// 프롬프트 엔지니어링 스키마
// ===========================================

export const PromptEngineeringSchema = z.object({
  basePrompt: z.string().min(1).max(1000),
  enhancedPrompt: z.string().max(2000),
  styleModifiers: z.array(z.string().max(50)).max(10),
  technicalSpecs: z.array(z.string().max(50)).max(10),
  negativePrompt: z.string().max(500).optional(),
  promptTokens: z.number().int().min(0).optional()
});

// ===========================================
// 스토리보드 프레임 요청 스키마
// ===========================================

export const FrameGenerationRequestSchema = z.object({
  sceneId: z.string().uuid(),
  sceneDescription: z.string().min(1).max(1000),
  additionalPrompt: z.string().max(500).optional(),
  config: ImageGenerationConfigSchema.partial().optional(),
  consistencyRefs: z.array(z.string().uuid()).max(5).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
});

// ===========================================
// 개별 프레임 생성 API 스키마
// ===========================================

export const StoryboardGenerateRequestSchema = z.object({
  storyboardId: z.string().uuid(),
  frame: FrameGenerationRequestSchema,
  forceRegenerate: z.boolean().default(false),
  useConsistencyGuide: z.boolean().default(true)
});

export type StoryboardGenerateRequest = z.infer<typeof StoryboardGenerateRequestSchema>;

export const StoryboardGenerateResponseSchema = z.object({
  frameId: z.string().uuid(),
  storyboardId: z.string().uuid(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  generationId: z.string(),
  status: StoryboardFrameStatusSchema,
  model: ImageGenerationModelSchema,
  config: ImageGenerationConfigSchema,
  prompt: PromptEngineeringSchema,
  generatedAt: z.string().datetime(),
  processingTime: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  consistencyScore: z.number().min(0).max(1).optional()
});

export type StoryboardGenerateResponse = z.infer<typeof StoryboardGenerateResponseSchema>;

// ===========================================
// 배치 생성 API 스키마
// ===========================================

export const BatchGenerationSettingsSchema = z.object({
  maxConcurrent: z.number().int().min(1).max(3).default(1), // 비용 안전: 최대 3개 동시 처리
  delayBetweenRequests: z.number().int().min(5000).default(12000), // 최소 12초 간격
  stopOnError: z.boolean().default(false),
  useConsistencyChain: z.boolean().default(true) // 첫 이미지를 참조로 사용
});

export const StoryboardBatchRequestSchema = z.object({
  storyboardId: z.string().uuid(),
  frames: z.array(FrameGenerationRequestSchema).min(1).max(12), // 최대 12개 숏
  batchSettings: BatchGenerationSettingsSchema.optional(),
  consistencyBaseImage: z.string().url().optional() // 일관성 기준 이미지
});

export type StoryboardBatchRequest = z.infer<typeof StoryboardBatchRequestSchema>;

export const BatchGenerationProgressSchema = z.object({
  batchId: z.string().uuid(),
  totalFrames: z.number().int().min(1),
  completedFrames: z.number().int().min(0),
  failedFrames: z.number().int().min(0),
  progress: z.number().min(0).max(1),
  estimatedTimeRemaining: z.number().min(0).optional(),
  currentFrame: z.object({
    frameId: z.string().uuid(),
    sceneId: z.string().uuid(),
    status: StoryboardFrameStatusSchema,
    currentStep: z.string().optional()
  }).optional(),
  errors: z.array(z.object({
    frameId: z.string().uuid(),
    code: z.string(),
    message: z.string(),
    timestamp: z.string().datetime()
  }))
});

export type BatchGenerationProgress = z.infer<typeof BatchGenerationProgressSchema>;

export const StoryboardBatchResponseSchema = z.object({
  batchId: z.string().uuid(),
  storyboardId: z.string().uuid(),
  status: z.enum(['initiated', 'in_progress', 'completed', 'failed', 'cancelled']),
  progress: BatchGenerationProgressSchema,
  results: z.array(StoryboardGenerateResponseSchema),
  totalCost: z.number().min(0),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional()
});

export type StoryboardBatchResponse = z.infer<typeof StoryboardBatchResponseSchema>;

// ===========================================
// 일관성 분석 API 스키마
// ===========================================

export const ConsistencyAnalysisRequestSchema = z.object({
  imageUrl: z.string().url(),
  analysisType: z.enum(['character', 'location', 'style', 'full']).default('full'),
  extractFeatures: z.boolean().default(true)
});

export type ConsistencyAnalysisRequest = z.infer<typeof ConsistencyAnalysisRequestSchema>;

export const ConsistencyAnalysisResponseSchema = z.object({
  imageUrl: z.string().url(),
  analysisType: z.enum(['character', 'location', 'style', 'full']),
  features: z.object({
    dominantColors: z.array(z.string()).max(5),
    styleAttributes: z.array(z.string()).max(10),
    compositionElements: z.array(z.string()).max(10),
    characterFeatures: z.array(z.string()).max(10).optional(),
    locationFeatures: z.array(z.string()).max(10).optional()
  }),
  consistencyMetadata: z.object({
    promptSuggestions: z.array(z.string()).max(5),
    styleModifiers: z.array(z.string()).max(5),
    technicalSpecs: z.array(z.string()).max(5)
  }),
  confidenceScore: z.number().min(0).max(1),
  analyzedAt: z.string().datetime()
});

export type ConsistencyAnalysisResponse = z.infer<typeof ConsistencyAnalysisResponseSchema>;

// ===========================================
// 스토리보드 CRUD 스키마
// ===========================================

export const StoryboardCreateRequestSchema = z.object({
  scenarioId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config: ImageGenerationConfigSchema.partial().optional(),
  consistencyRefs: z.array(ConsistencyReferenceSchema).max(10).optional(),
  autoGenerate: z.boolean().default(false) // 생성 즉시 프레임 자동 생성 여부
});

export type StoryboardCreateRequest = z.infer<typeof StoryboardCreateRequestSchema>;

export const StoryboardUpdateRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  config: ImageGenerationConfigSchema.partial().optional(),
  consistencyRefs: z.array(ConsistencyReferenceSchema).max(10).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional()
});

export type StoryboardUpdateRequest = z.infer<typeof StoryboardUpdateRequestSchema>;

export const StoryboardResponseSchema = z.object({
  id: z.string().uuid(),
  scenarioId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']),
  userId: z.string().uuid(),
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  config: ImageGenerationConfigSchema,
  consistencyRefs: z.array(ConsistencyReferenceSchema),
  frames: z.array(z.object({
    id: z.string().uuid(),
    sceneId: z.string().uuid(),
    order: z.number().int().min(0),
    title: z.string(),
    description: z.string(),
    status: StoryboardFrameStatusSchema,
    imageUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    generatedAt: z.string().datetime().optional(),
    processingTime: z.number().min(0).optional(),
    cost: z.number().min(0).optional()
  })),
  statistics: z.object({
    totalFrames: z.number().int().min(0),
    completedFrames: z.number().int().min(0),
    failedFrames: z.number().int().min(0),
    totalCost: z.number().min(0),
    averageProcessingTime: z.number().min(0),
    averageRating: z.number().min(0).max(5)
  }).optional()
});

export type StoryboardResponse = z.infer<typeof StoryboardResponseSchema>;

// ===========================================
// 검색 및 필터링 스키마
// ===========================================

export const StoryboardSearchFilterSchema = z.object({
  query: z.string().max(100).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
  scenarioId: z.string().uuid().optional(),
  model: ImageGenerationModelSchema.optional(),
  style: StylePresetSchema.optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'title', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0)
});

export type StoryboardSearchFilter = z.infer<typeof StoryboardSearchFilterSchema>;

// ===========================================
// 에러 스키마
// ===========================================

export const StoryboardErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  frameId: z.string().uuid().optional(),
  details: z.record(z.unknown()).optional()
});

export type StoryboardError = z.infer<typeof StoryboardErrorSchema>;

// ===========================================
// 비용 안전 검증 규칙
// ===========================================

/**
 * 비용 안전 검증 함수들
 * $300 사건 방지를 위한 엄격한 제한
 */
export const validateCostSafety = {
  /**
   * 배치 생성 요청 비용 안전 검증
   */
  batchRequest: (request: StoryboardBatchRequest): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // 최대 프레임 수 제한 (12개)
    if (request.frames.length > 12) {
      errors.push('배치 생성은 최대 12개 프레임까지만 가능합니다.');
    }

    // 동시 처리 수 제한
    const maxConcurrent = request.batchSettings?.maxConcurrent || 1;
    if (maxConcurrent > 3) {
      errors.push('동시 처리는 최대 3개까지만 가능합니다.');
    }

    // 최소 지연 시간 검증
    const delay = request.batchSettings?.delayBetweenRequests || 12000;
    if (delay < 5000) {
      errors.push('배치 생성 간격은 최소 5초 이상이어야 합니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * 개별 생성 요청 비용 안전 검증
   */
  generateRequest: (request: StoryboardGenerateRequest): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // 프롬프트 길이 제한
    if (request.frame.sceneDescription.length > 1000) {
      errors.push('시나리오 설명은 1000자를 초과할 수 없습니다.');
    }

    if (request.frame.additionalPrompt && request.frame.additionalPrompt.length > 500) {
      errors.push('추가 프롬프트는 500자를 초과할 수 없습니다.');
    }

    // 일관성 참조 수 제한
    if (request.frame.consistencyRefs && request.frame.consistencyRefs.length > 5) {
      errors.push('일관성 참조는 최대 5개까지만 가능합니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};