/**
 * Planning API Zod Schemas
 *
 * 시나리오 기획 API를 위한 Zod 스키마 정의
 * CLAUDE.md 준수: 비용 안전 규칙, 타입 안전성, 런타임 검증
 */

import { z } from 'zod';

// ===========================================
// 기본 타입 스키마
// ===========================================

export const ScenarioStatusSchema = z.enum(['draft', 'in_progress', 'completed', 'archived']);
export const SceneTypeSchema = z.enum(['dialogue', 'action', 'transition', 'montage', 'voiceover']);
export const StoryStyleSchema = z.enum(['casual', 'professional', 'creative', 'educational']);
export const StoryToneSchema = z.enum(['serious', 'humorous', 'dramatic', 'informative']);

// ===========================================
// AI 스토리 생성 스키마
// ===========================================

export const StoryGenerationRequestSchema = z.object({
  prompt: z.string()
    .min(10, '프롬프트는 최소 10자 이상이어야 합니다.')
    .max(2000, '프롬프트는 최대 2000자까지 가능합니다.'),
  genre: z.string()
    .max(50, '장르는 최대 50자까지 가능합니다.')
    .optional()
    .default('일반'),
  targetDuration: z.number()
    .min(30, '최소 30초 이상이어야 합니다.')
    .max(3600, '최대 1시간(3600초)까지 가능합니다.')
    .optional()
    .default(300),
  style: StoryStyleSchema.optional().default('professional'),
  tone: StoryToneSchema.optional().default('informative'),
  projectId: z.string().uuid('유효한 프로젝트 ID가 필요합니다.').optional(),
});

export const VisualElementSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video', 'animation', 'graphic']),
  url: z.string().url().optional(),
  description: z.string().max(500),
  timing: z.object({
    start: z.number().min(0),
    end: z.number().min(0),
  }).optional(),
});

export const SceneSchema = z.object({
  id: z.string().uuid().optional(), // API 생성 시 optional
  order: z.number().min(1),
  type: SceneTypeSchema,
  title: z.string()
    .min(1, '씬 제목은 필수입니다.')
    .max(100, '씬 제목은 최대 100자까지 가능합니다.'),
  description: z.string()
    .max(1000, '씬 설명은 최대 1000자까지 가능합니다.'),
  duration: z.number()
    .min(5, '최소 5초 이상이어야 합니다.')
    .max(600, '최대 10분(600초)까지 가능합니다.')
    .optional()
    .default(30),
  location: z.string().max(100).optional(),
  characters: z.array(z.string().max(50)).max(20).optional().default([]),
  dialogue: z.string().max(2000).optional(),
  actionDescription: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
  visualElements: z.array(VisualElementSchema).max(10).optional().default([]),
});

export const StoryGenerationResponseSchema = z.object({
  storyOutline: z.string()
    .min(50, '스토리 개요는 최소 50자 이상이어야 합니다.')
    .max(1000, '스토리 개요는 최대 1000자까지 가능합니다.'),
  scenes: z.array(SceneSchema.omit({ id: true }))
    .min(1, '최소 1개 이상의 씬이 필요합니다.')
    .max(50, '최대 50개까지 씬을 생성할 수 있습니다.'),
  suggestedKeywords: z.array(z.string().max(30))
    .max(20, '최대 20개까지 키워드를 제안할 수 있습니다.')
    .default([]),
  estimatedDuration: z.number()
    .min(30)
    .max(3600),
});

// ===========================================
// 시나리오 CRUD 스키마
// ===========================================

export const ScenarioCreateRequestSchema = z.object({
  title: z.string()
    .min(1, '시나리오 제목은 필수입니다.')
    .max(200, '시나리오 제목은 최대 200자까지 가능합니다.'),
  description: z.string()
    .max(1000, '시나리오 설명은 최대 1000자까지 가능합니다.')
    .optional(),
  genre: z.string()
    .max(50, '장르는 최대 50자까지 가능합니다.')
    .optional(),
  targetDuration: z.number()
    .min(30)
    .max(3600)
    .optional(),
  storyPrompt: z.string()
    .min(10, '스토리 프롬프트는 최소 10자 이상이어야 합니다.')
    .max(2000, '스토리 프롬프트는 최대 2000자까지 가능합니다.'),
  projectId: z.string().uuid('유효한 프로젝트 ID가 필요합니다.').optional(),
  generateStory: z.boolean().default(true), // AI 스토리 생성 여부
});

export const ScenarioUpdateRequestSchema = z.object({
  title: z.string()
    .min(1, '시나리오 제목은 필수입니다.')
    .max(200, '시나리오 제목은 최대 200자까지 가능합니다.')
    .optional(),
  description: z.string()
    .max(1000, '시나리오 설명은 최대 1000자까지 가능합니다.')
    .optional(),
  genre: z.string()
    .max(50, '장르는 최대 50자까지 가능합니다.')
    .optional(),
  targetDuration: z.number()
    .min(30)
    .max(3600)
    .optional(),
  status: ScenarioStatusSchema.optional(),
  scenes: z.array(SceneSchema).max(50).optional(),
  storyOutline: z.string()
    .max(1000, '스토리 개요는 최대 1000자까지 가능합니다.')
    .optional(),
  keywords: z.array(z.string().max(30))
    .max(20, '최대 20개까지 키워드를 설정할 수 있습니다.')
    .optional(),
});

export const ScenarioMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  genre: z.string().optional(),
  targetDuration: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: ScenarioStatusSchema,
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
});

export const ScenarioSchema = z.object({
  metadata: ScenarioMetadataSchema,
  scenes: z.array(SceneSchema),
  totalDuration: z.number().optional(),
  storyOutline: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// ===========================================
// 씬 관리 스키마
// ===========================================

export const SceneCreateRequestSchema = z.object({
  scenarioId: z.string().uuid('유효한 시나리오 ID가 필요합니다.'),
  order: z.number().min(1),
  type: SceneTypeSchema,
  title: z.string()
    .min(1, '씬 제목은 필수입니다.')
    .max(100, '씬 제목은 최대 100자까지 가능합니다.'),
  description: z.string()
    .max(1000, '씬 설명은 최대 1000자까지 가능합니다.'),
  duration: z.number()
    .min(5)
    .max(600)
    .optional()
    .default(30),
  location: z.string().max(100).optional(),
  characters: z.array(z.string().max(50)).max(20).optional().default([]),
  dialogue: z.string().max(2000).optional(),
  actionDescription: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
});

export const SceneUpdateRequestSchema = SceneCreateRequestSchema.partial().omit({ scenarioId: true });

export const SceneReorderRequestSchema = z.object({
  sceneId: z.string().uuid(),
  newOrder: z.number().min(1),
});

export const SceneBulkUpdateRequestSchema = z.object({
  scenarioId: z.string().uuid(),
  scenes: z.array(z.object({
    id: z.string().uuid(),
    order: z.number().min(1),
  })).min(1).max(50),
});

// ===========================================
// 템플릿 관리 스키마
// ===========================================

export const TemplateCreateRequestSchema = z.object({
  title: z.string()
    .min(1, '템플릿 제목은 필수입니다.')
    .max(200, '템플릿 제목은 최대 200자까지 가능합니다.'),
  description: z.string()
    .max(1000, '템플릿 설명은 최대 1000자까지 가능합니다.')
    .optional(),
  category: z.string()
    .min(1, '템플릿 카테고리는 필수입니다.')
    .max(50, '템플릿 카테고리는 최대 50자까지 가능합니다.'),
  tags: z.array(z.string().max(30))
    .max(10, '최대 10개까지 태그를 설정할 수 있습니다.')
    .default([]),
  isPublic: z.boolean().default(false),
  sceneTemplates: z.array(SceneSchema.omit({ id: true }))
    .min(1, '최소 1개 이상의 씬 템플릿이 필요합니다.')
    .max(20, '최대 20개까지 씬 템플릿을 생성할 수 있습니다.'),
  defaultDuration: z.number()
    .min(30)
    .max(3600)
    .optional(),
  variables: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean']),
    default: z.any().optional(),
    description: z.string().max(200).optional(),
  })).optional().default({}),
});

export const TemplateUpdateRequestSchema = TemplateCreateRequestSchema.partial();

export const TemplateMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  userId: z.string().uuid(),
  usageCount: z.number().default(0),
  rating: z.number().min(0).max(5).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TemplateSchema = z.object({
  metadata: TemplateMetadataSchema,
  sceneTemplates: z.array(SceneSchema.omit({ id: true })),
  defaultDuration: z.number().optional(),
  variables: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean']),
    default: z.any().optional(),
    description: z.string().optional(),
  })).optional(),
});

// ===========================================
// 검색 및 필터 스키마
// ===========================================

export const PlanningSearchFilterSchema = z.object({
  query: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  genre: z.string().max(50).optional(),
  status: ScenarioStatusSchema.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  duration: z.object({
    min: z.number().min(0).optional(),
    max: z.number().max(3600).optional(),
  }).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'duration', 'usageCount']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ===========================================
// API 응답 스키마
// ===========================================

export const PlanningApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  metadata: z.object({
    requestId: z.string().uuid(),
    timestamp: z.string().datetime(),
    userId: z.string().uuid().optional(),
    cost: z.number().min(0).optional(),
    processingTime: z.number().min(0).optional(),
  }).optional(),
});

export const PaginatedResponseSchema = PlanningApiResponseSchema.extend({
  pagination: z.object({
    page: z.number().min(1),
    limit: z.number().min(1),
    total: z.number().min(0),
    totalPages: z.number().min(0),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }).optional(),
});

// ===========================================
// 콘텐츠 관리 대시보드 스키마
// ===========================================

export const ContentTypeSchema = z.enum(['scenario', 'prompt', 'image', 'video', 'planning_project', 'story_step', 'shot_sequence']);

export const ContentSortSchema = z.enum(['created_at', 'updated_at', 'name', 'title', 'usage_count', 'size']);

export const ContentFilterSchema = z.object({
  type: ContentTypeSchema.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: ContentSortSchema.default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export const ContentItemMetadataSchema = z.object({
  id: z.string().uuid(),
  type: ContentTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  file_size: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  usage_count: z.number().min(0).default(0),
  status: z.string().optional(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // 특정 타입별 추가 메타데이터
  type_specific_data: z.record(z.any()).optional(),
});

export const ContentStatsSchema = z.object({
  total_count: z.number().min(0),
  count_by_type: z.record(ContentTypeSchema, z.number().min(0)),
  total_size_bytes: z.number().min(0),
  recent_activity_count: z.number().min(0),
  this_week_created: z.number().min(0),
  this_month_created: z.number().min(0),
  storage_usage_by_type: z.record(ContentTypeSchema, z.number().min(0)),
  top_tags: z.array(z.object({
    tag: z.string(),
    count: z.number().min(0),
  })).max(20),
});

export const ContentUpdateRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  status: z.string().max(50).optional(),
  metadata: z.record(z.any()).optional(),
});

export const BatchOperationSchema = z.object({
  operation: z.enum(['delete', 'update_tags', 'change_status', 'move_to_project']),
  content_ids: z.array(z.string().uuid()).min(1).max(100),
  parameters: z.record(z.any()).optional(),
});

export const BatchOperationResultSchema = z.object({
  operation: z.string(),
  total_count: z.number().min(0),
  success_count: z.number().min(0),
  failed_count: z.number().min(0),
  failed_items: z.array(z.object({
    id: z.string().uuid(),
    error: z.string(),
  })).optional(),
  processing_time_ms: z.number().min(0),
});

// ===========================================
// 타입 추론
// ===========================================

export type StoryGenerationRequest = z.infer<typeof StoryGenerationRequestSchema>;
export type StoryGenerationResponse = z.infer<typeof StoryGenerationResponseSchema>;
export type ScenarioCreateRequest = z.infer<typeof ScenarioCreateRequestSchema>;
export type ScenarioUpdateRequest = z.infer<typeof ScenarioUpdateRequestSchema>;
export type SceneCreateRequest = z.infer<typeof SceneCreateRequestSchema>;
export type SceneUpdateRequest = z.infer<typeof SceneUpdateRequestSchema>;
export type SceneReorderRequest = z.infer<typeof SceneReorderRequestSchema>;
export type SceneBulkUpdateRequest = z.infer<typeof SceneBulkUpdateRequestSchema>;
export type TemplateCreateRequest = z.infer<typeof TemplateCreateRequestSchema>;
export type TemplateUpdateRequest = z.infer<typeof TemplateUpdateRequestSchema>;
export type PlanningSearchFilter = z.infer<typeof PlanningSearchFilterSchema>;
export type PlanningApiResponse = z.infer<typeof PlanningApiResponseSchema>;
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;

export type Scene = z.infer<typeof SceneSchema>;
export type VisualElement = z.infer<typeof VisualElementSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type ScenarioStatus = z.infer<typeof ScenarioStatusSchema>;
export type SceneType = z.infer<typeof SceneTypeSchema>;
export type StoryStyle = z.infer<typeof StoryStyleSchema>;
export type StoryTone = z.infer<typeof StoryToneSchema>;

// 콘텐츠 관리 타입들
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type ContentSort = z.infer<typeof ContentSortSchema>;
export type ContentFilter = z.infer<typeof ContentFilterSchema>;
export type ContentItemMetadata = z.infer<typeof ContentItemMetadataSchema>;
export type ContentStats = z.infer<typeof ContentStatsSchema>;
export type ContentUpdateRequest = z.infer<typeof ContentUpdateRequestSchema>;
export type BatchOperation = z.infer<typeof BatchOperationSchema>;
export type BatchOperationResult = z.infer<typeof BatchOperationResultSchema>;