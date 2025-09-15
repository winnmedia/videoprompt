import { z } from 'zod';
import { BaseApiResponseSchema, createApiResponseSchema, createPaginatedResponseSchema } from './api.schema';

// ===============================================
// STORY DOMAIN SCHEMAS
// ===============================================

/**
 * 스토리 구조 - 4막 구성 스키마
 */
const StoryActSchema = z.object({
  title: z.string().min(1, '막 제목이 필요합니다'),
  description: z.string().min(1, '막 설명이 필요합니다'),
  key_elements: z.array(z.string()).min(1, '최소 하나의 핵심 요소가 필요합니다'),
  emotional_arc: z.string().min(1, '감정 아크가 필요합니다'),
});

/**
 * 스토리 구조 전체 스키마
 */
const StoryStructureSchema = z.object({
  act1: StoryActSchema,
  act2: StoryActSchema,
  act3: StoryActSchema,
  act4: StoryActSchema,
}).strict();

/**
 * 장르 enum 스키마
 */
const GenreSchema = z.enum([
  'Drama',
  'Comedy',
  'Action',
  'Romance',
  'Thriller',
  'Horror',
  'SciFi',
  'Fantasy',
  'Documentary',
  'Musical',
  'Mystery',
  'Adventure',
  'Animation',
  'Family',
  'Crime',
  'War',
  'Historical',
  'Western'
]);

/**
 * 톤 enum 스키마
 */
const ToneSchema = z.enum([
  'Neutral',
  'Serious',
  'Lighthearted',
  'Dark',
  'Humorous',
  'Dramatic',
  'Suspenseful',
  'Romantic',
  'Inspiring',
  'Melancholic',
  'Energetic',
  'Calm',
  'Intense',
  'Whimsical'
], {
  message: '유효하지 않은 톤입니다'
});

/**
 * 타겟 대상 enum 스키마
 */
const TargetAudienceSchema = z.enum([
  'General',
  'Children',
  'Teens',
  'Young Adults',
  'Adults',
  'Seniors',
  'Family',
  'Professionals',
  'Students',
  'Niche'
]);

/**
 * 스토리 기본 스키마
 */
export const StorySchema = z.object({
  id: z.string().uuid(),
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다'),
  oneLineStory: z.string()
    .min(10, '한 줄 스토리는 최소 10자 이상이어야 합니다')
    .max(500, '한 줄 스토리는 500자를 초과할 수 없습니다'),
  genre: z.string(),
  tone: z.string(),
  target: z.string(),
  structure: StoryStructureSchema.optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ===============================================
// REQUEST SCHEMAS
// ===============================================

/**
 * 스토리 생성 요청 스키마
 */
export const CreateStoryRequestSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .transform(val => val.trim()),
  oneLineStory: z.string()
    .min(10, '한 줄 스토리는 최소 10자 이상이어야 합니다')
    .max(500, '한 줄 스토리는 500자를 초과할 수 없습니다')
    .transform(val => val.trim()),
  genre: z.string().optional().default('Drama'),
  tone: z.string().optional().default('Neutral'),
  target: z.string().optional().default('General'),
  structure: StoryStructureSchema.optional(),
});

/**
 * 스토리 업데이트 요청 스키마
 */
export const UpdateStoryRequestSchema = CreateStoryRequestSchema.partial();

/**
 * 스토리 목록 조회 쿼리 스키마
 */
export const GetStoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string()
    .optional()
    .transform(val => val ? val.trim() : undefined),
  genre: z.string().optional(),
  tone: z.string().optional(),
  target: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ===============================================
// RESPONSE SCHEMAS
// ===============================================

/**
 * 스토리 단일 응답 스키마
 */
export const StoryResponseSchema = createApiResponseSchema(StorySchema);

/**
 * 스토리 목록 응답 스키마
 */
export const StoriesResponseSchema = z.object({
  stories: z.array(StorySchema),
  pagination: z.object({
    currentPage: z.number().int().min(1),
    totalPages: z.number().int().min(0),
    totalItems: z.number().int().min(0),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

// ===============================================
// SHOT DEVELOPMENT SCHEMAS (12샷 분해)
// ===============================================

/**
 * 4구조 기본 요소 스키마
 */
const Structure4ItemSchema = z.object({
  title: z.string().min(1, '제목이 필요합니다'),
  summary: z.string().min(1, '요약이 필요합니다'),
});

/**
 * 12샷 분해 요청 스키마
 */
export const DevelopShotsRequestSchema = z.object({
  structure4: z.array(Structure4ItemSchema)
    .min(4, '정확히 4개의 구조가 필요합니다')
    .max(4, '정확히 4개의 구조가 필요합니다'),
  genre: GenreSchema,
  tone: ToneSchema,
});

/**
 * 개별 샷 스키마
 */
const ShotSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, '샷 제목이 필요합니다'),
  description: z.string().min(1, '샷 설명이 필요합니다'),
});

/**
 * 12샷 분해 응답 메타데이터 스키마
 */
const ShotDevelopmentMetadataSchema = z.object({
  originalStructure: z.array(Structure4ItemSchema),
  genre: GenreSchema,
  tone: ToneSchema,
  generatedAt: z.string().datetime(),
  aiModel: z.string(),
});

/**
 * 12샷 분해 응답 데이터 스키마
 */
const DevelopShotsDataSchema = z.object({
  shots12: z.array(ShotSchema)
    .min(12, '정확히 12개의 샷이 생성되어야 합니다')
    .max(12, '정확히 12개의 샷이 생성되어야 합니다'),
  metadata: ShotDevelopmentMetadataSchema,
});

/**
 * 12샷 분해 응답 스키마
 */
export const DevelopShotsResponseSchema = BaseApiResponseSchema.extend({
  data: DevelopShotsDataSchema.optional(),
});

// ===============================================
// SCENE AND PROJECT SCHEMAS
// ===============================================

/**
 * 타임라인 요소 스키마
 */
const TimelineElementSchema = z.object({
  sequence: z.number().int().min(1),
  timestamp: z.string().regex(/^\d{2}:\d{2}$/, '타임스탬프 형식이 잘못되었습니다 (MM:SS)'),
  action: z.string().min(1, '액션 설명이 필요합니다'),
  audio: z.string().min(1, '오디오 설명이 필요합니다'),
});

/**
 * 장면 프롬프트 메타데이터 스키마
 */
const ScenePromptMetadataSchema = z.object({
  prompt_name: z.string().min(1, '프롬프트 이름이 필요합니다'),
  base_style: z.string().min(1, '기본 스타일이 필요합니다'),
  aspect_ratio: z.string().regex(/^\d+:\d+$/, '종횡비 형식이 잘못되었습니다 (예: 16:9)'),
  room_description: z.string().min(1, '공간 설명이 필요합니다'),
  camera_setup: z.string().min(1, '카메라 설정이 필요합니다'),
});

/**
 * 장면 프롬프트 스키마
 */
const ScenePromptSchema = z.object({
  metadata: ScenePromptMetadataSchema,
  key_elements: z.array(z.string()).min(1, '최소 하나의 핵심 요소가 필요합니다'),
  assembled_elements: z.array(z.string()).min(1, '최소 하나의 조합 요소가 필요합니다'),
  negative_prompts: z.array(z.string()).optional(),
  timeline: z.array(TimelineElementSchema),
  text: z.union([z.string(), z.literal('none')]),
  keywords: z.array(z.string()),
});

/**
 * 장면 상태 enum 스키마
 */
const SceneStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);

/**
 * 장면 스키마
 */
export const SceneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, '장면 제목이 필요합니다'),
  description: z.string().min(1, '장면 설명이 필요합니다'),
  prompt: ScenePromptSchema,
  thumbnail: z.string().url().optional(),
  duration: z.number().min(0),
  order: z.number().int().min(0),
  status: SceneStatusSchema,
  aiGenerated: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ===============================================
// VALIDATION UTILITIES
// ===============================================

/**
 * 스토리 필드별 개별 검증 함수들
 */
export const storyValidators = {
  title: (title: string) => {
    const result = z.string().min(1).max(200).safeParse(title);
    return result.success ? null : result.error.issues[0].message;
  },
  
  oneLineStory: (story: string) => {
    const result = z.string().min(10).max(500).safeParse(story);
    return result.success ? null : result.error.issues[0].message;
  },
  
  genre: (genre: string) => {
    const result = GenreSchema.safeParse(genre);
    return result.success ? null : '유효하지 않은 장르입니다';
  },
  
  tone: (tone: string) => {
    const result = ToneSchema.safeParse(tone);
    return result.success ? null : '유효하지 않은 톤입니다';
  },
  
  target: (target: string) => {
    const result = TargetAudienceSchema.safeParse(target);
    return result.success ? null : '유효하지 않은 타겟 대상입니다';
  }
};

/**
 * 구조 검증 함수
 */
export function validateStoryStructure(structure: any): string | null {
  const result = StoryStructureSchema.safeParse(structure);
  if (!result.success) {
    return result.error.issues[0].message;
  }
  return null;
}

/**
 * 12샷 분해 요청 검증 함수
 */
export function validateDevelopShotsRequest(request: any): string | null {
  const result = DevelopShotsRequestSchema.safeParse(request);
  if (!result.success) {
    return result.error.issues[0].message;
  }
  return null;
}

// ===============================================
// TYPE EXPORTS
// ===============================================

export type Story = z.infer<typeof StorySchema>;
export type CreateStoryRequest = z.infer<typeof CreateStoryRequestSchema>;
export type UpdateStoryRequest = z.infer<typeof UpdateStoryRequestSchema>;
export type GetStoriesQuery = z.infer<typeof GetStoriesQuerySchema>;
export type StoryResponse = z.infer<typeof StoryResponseSchema>;
export type StoriesResponse = z.infer<typeof StoriesResponseSchema>;
export type DevelopShotsRequest = z.infer<typeof DevelopShotsRequestSchema>;
export type DevelopShotsResponse = z.infer<typeof DevelopShotsResponseSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type ScenePrompt = z.infer<typeof ScenePromptSchema>;
export type TimelineElement = z.infer<typeof TimelineElementSchema>;

// Genre, Tone, Target 타입들을 문자열 리터럴로 export
export type Genre = z.infer<typeof GenreSchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type TargetAudience = z.infer<typeof TargetAudienceSchema>;