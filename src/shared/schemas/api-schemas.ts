/**
 * RTK Query API 스키마 정의 - 런타임 검증 및 타입 안전성 보장
 * CLAUDE.md 데이터 계약 원칙에 따른 Zod 기반 스키마 검증
 */

import { z } from 'zod';

// ============================================================================
// 기본 스키마 및 유틸리티
// ============================================================================

/**
 * 공통 API 응답 스키마
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
    timestamp: z.string().optional(),
  });

/**
 * 에러 응답 스키마
 */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string().optional(),
});

// ============================================================================
// Core Domain Schemas
// ============================================================================

/**
 * StoryInput 스키마 - 사용자 입력 데이터
 */
export const StoryInputSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(100, '제목은 100자 이하여야 합니다'),
  description: z.string().min(1, '설명은 필수입니다').max(500, '설명은 500자 이하여야 합니다'),
  duration: z.number().positive('재생시간은 양수여야 합니다').max(3600, '재생시간은 3600초 이하여야 합니다'),
  genre: z.string().min(1, '장르는 필수입니다'),
  target: z.string().min(1, '타겟 관객은 필수입니다'),
  format: z.string().min(1, '포맷은 필수입니다'),
  toneAndManner: z.array(z.string()).min(1, '톤앤매너는 최소 1개 이상이어야 합니다'),
  visualStyle: z.string().optional(),
});

/**
 * StoryStep 스키마 - 스토리 단계 데이터
 */
export const StoryStepSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  title: z.string().min(1, '제목은 필수입니다'),
  description: z.string().min(1, '설명은 필수입니다'),
  duration: z.number().positive('지속시간은 양수여야 합니다'),
  sequence: z.number().int().min(1, '순서는 1 이상이어야 합니다'),
  keyElements: z.array(z.string()),
  visualNotes: z.string().optional(),
});

/**
 * ScenarioData 스키마 - 시나리오 데이터
 */
export const ScenarioDataSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다'),
  logline: z.string().optional(),
  projectId: z.string().optional(),
  structure4: z.object({
    act1: z.object({
      title: z.string(),
      description: z.string(),
      emotional_arc: z.string(),
    }),
    act2: z.object({
      title: z.string(),
      description: z.string(),
      emotional_arc: z.string(),
    }),
    act3: z.object({
      title: z.string(),
      description: z.string(),
      emotional_arc: z.string(),
    }),
    act4: z.object({
      title: z.string(),
      description: z.string(),
      emotional_arc: z.string(),
    }),
  }).optional(),
  shots12: z.array(z.object({
    shot: z.number(),
    description: z.string(),
    duration: z.string(),
    camera_angle: z.string(),
    lighting: z.string(),
  })).optional(),
  pdfUrl: z.string().url().optional(),
});

/**
 * PromptData 스키마 - 프롬프트 데이터
 */
export const PromptDataSchema = z.object({
  scenarioTitle: z.string().min(1, '시나리오 제목은 필수입니다'),
  finalPrompt: z.string().min(1, '최종 프롬프트는 필수입니다'),
  keywords: z.array(z.string()).optional(),
  negativePrompt: z.string().optional(),
  visualStyle: z.string().optional(),
  mood: z.string().optional(),
  directorStyle: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * VideoData 스키마 - 비디오 데이터
 */
export const VideoDataSchema = z.object({
  url: z.string().url().optional(),
  status: z.enum(['generating', 'completed', 'failed']).optional(),
  duration: z.number().positive().optional(),
  format: z.string().optional(),
  size: z.number().positive().optional(),
  generatedAt: z.string().optional(),
  title: z.string().optional(),
  prompt: z.string().optional(),
  projectId: z.string().optional(),
});

/**
 * Shot 스키마 - 샷 데이터
 */
export const ShotSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  title: z.string().min(1, '제목은 필수입니다'),
  description: z.string().min(1, '설명은 필수입니다'),
  shotType: z.string().min(1, '샷 타입은 필수입니다'),
  camera: z.string().min(1, '카메라 정보는 필수입니다'),
  sequence: z.number().int().min(1, '순서는 1 이상이어야 합니다'),
  duration: z.number().positive().optional(),
});

/**
 * StoryboardShot 스키마 - 스토리보드 샷 데이터
 */
export const StoryboardShotSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  shotId: z.string().min(1, '샷 ID는 필수입니다'),
  imageUrl: z.string().url('유효한 이미지 URL이어야 합니다'),
  prompt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  generatedAt: z.string().optional(),
});

/**
 * Project 스키마 - 프로젝트 데이터
 */
export const ProjectSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  title: z.string().min(1, '제목은 필수입니다'),
  description: z.string().optional(),
  storyInput: StoryInputSchema,
  steps: z.array(StoryStepSchema),
  shots: z.array(ShotSchema),
  storyboardShots: z.array(StoryboardShotSchema),
  status: z.enum(['draft', 'story_complete', 'shots_complete', 'storyboard_complete', 'final']),
  userId: z.string().min(1, '사용자 ID는 필수입니다'),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastAccessedAt: z.string().optional(),
  isPublic: z.boolean(),
  tags: z.array(z.string()),
  collaborators: z.array(
    z.object({
      userId: z.string(),
      role: z.enum(['viewer', 'editor', 'admin']),
    })
  ).optional(),
});

/**
 * ProjectMetadata 스키마 - 프로젝트 메타데이터
 */
export const ProjectMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['draft', 'story_complete', 'shots_complete', 'storyboard_complete', 'final']),
  updatedAt: z.string(),
  thumbnail: z.string().url().optional(),
  tags: z.array(z.string()),
});

/**
 * ProjectListFilters 스키마 - 프로젝트 목록 필터
 */
export const ProjectListFiltersSchema = z.object({
  status: z.enum(['draft', 'story_complete', 'shots_complete', 'storyboard_complete', 'final']).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPublic: z.boolean().optional(),
});

// ============================================================================
// API Response Schemas
// ============================================================================

/**
 * StoryGeneration API 응답 스키마
 */
export const StoryGenerationResponseSchema = ApiResponseSchema(
  z.object({
    steps: z.array(StoryStepSchema),
    totalDuration: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  })
);

/**
 * StorySave API 응답 스키마
 */
export const StorySaveResponseSchema = ApiResponseSchema(
  z.object({
    projectId: z.string().min(1, 'projectId는 필수입니다'),
    savedAt: z.string(),
    version: z.string().optional(),
  })
);

/**
 * StoryLoad API 응답 스키마
 */
export const StoryLoadResponseSchema = ApiResponseSchema(
  z.object({
    storyInput: StoryInputSchema,
    steps: z.array(StoryStepSchema),
    savedAt: z.string(),
    version: z.string().optional(),
  })
);

/**
 * SavedStories API 응답 스키마
 */
export const SavedStoriesResponseSchema = ApiResponseSchema(
  z.object({
    stories: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        updatedAt: z.string(),
        genre: z.string().optional(),
        duration: z.number().optional(),
        status: z.enum(['draft', 'completed', 'published']).optional(),
      })
    ),
    total: z.number().int().min(0),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      hasNext: z.boolean(),
    }).optional(),
  })
);

/**
 * ScenarioSave API 응답 스키마
 */
export const ScenarioSaveResponseSchema = ApiResponseSchema(
  z.object({
    id: z.string(),
    savedAt: z.string(),
    version: z.string().optional(),
  })
);

/**
 * PromptSave API 응답 스키마
 */
export const PromptSaveResponseSchema = ApiResponseSchema(
  z.object({
    promptId: z.string(),
    savedAt: z.string(),
    version: z.string().optional(),
  })
);

/**
 * PromptsGet API 응답 스키마
 */
export const PromptsGetResponseSchema = ApiResponseSchema(
  z.object({
    prompts: z.array(
      z.object({
        id: z.string(),
        scenarioTitle: z.string(),
        version: z.string(),
        keywordCount: z.number().int().min(0),
        quality: z.enum(['low', 'medium', 'high', 'excellent']),
        createdAt: z.string(),
        finalPrompt: z.string(),
        keywords: z.array(z.string()),
        status: z.enum(['draft', 'reviewed', 'approved']).optional(),
      })
    ),
    total: z.number().int().min(0),
    timestamp: z.string(),
  })
);

/**
 * VideoSave API 응답 스키마
 */
export const VideoSaveResponseSchema = ApiResponseSchema(
  z.object({
    videoId: z.string(),
    savedAt: z.string(),
    processingStatus: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
  })
);

/**
 * VideosGet API 응답 스키마
 */
export const VideosGetResponseSchema = ApiResponseSchema(
  z.object({
    videos: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        url: z.string().url(),
        status: z.enum(['processing', 'completed', 'failed']),
        createdAt: z.string(),
        duration: z.number().optional(),
        thumbnailUrl: z.string().url().optional(),
        size: z.number().optional(),
      })
    ),
    total: z.number().int().min(0),
  })
);

/**
 * PipelineStatus API 응답 스키마
 */
export const PipelineStatusResponseSchema = ApiResponseSchema(
  z.object({
    projectId: z.string(),
    story: z.object({
      completed: z.boolean(),
      data: StoryInputSchema.optional(),
      lastUpdated: z.string().optional(),
    }),
    scenario: z.object({
      completed: z.boolean(),
      data: ScenarioDataSchema.optional(),
      lastUpdated: z.string().optional(),
    }),
    prompt: z.object({
      completed: z.boolean(),
      data: PromptDataSchema.optional(),
      lastUpdated: z.string().optional(),
    }),
    video: z.object({
      completed: z.boolean(),
      data: VideoDataSchema.optional(),
      lastUpdated: z.string().optional(),
    }),
    overall: z.object({
      progress: z.number().min(0).max(100),
      status: z.enum(['not_started', 'in_progress', 'completed', 'failed']),
      estimatedCompletion: z.string().optional(),
    }),
  })
);

/**
 * Project API 응답 스키마들
 */
export const CreateProjectResponseSchema = ApiResponseSchema(ProjectSchema);
export const UpdateProjectResponseSchema = ApiResponseSchema(ProjectSchema);
export const GetProjectResponseSchema = ApiResponseSchema(ProjectSchema);

export const GetProjectsResponseSchema = ApiResponseSchema(
  z.object({
    projects: z.array(ProjectMetadataSchema),
    pagination: z.object({
      currentPage: z.number().int().min(1),
      totalPages: z.number().int().min(0),
      totalCount: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrevious: z.boolean(),
    }),
  })
);

export const GetRecentProjectsResponseSchema = ApiResponseSchema(
  z.object({
    projects: z.array(ProjectMetadataSchema),
  })
);

export const GetProjectStatsResponseSchema = ApiResponseSchema(
  z.object({
    totalProjects: z.number().int().min(0),
    completedProjects: z.number().int().min(0),
    recentActivity: z.number().int().min(0),
    storageUsed: z.number().min(0),
    collaborationCount: z.number().int().min(0),
  })
);

/**
 * Storyboard API 응답 스키마들
 */
export const GenerateShotsResponseSchema = ApiResponseSchema(
  z.object({
    shots: z.array(ShotSchema),
  })
);

export const GenerateStoryboardResponseSchema = ApiResponseSchema(
  z.object({
    storyboardShots: z.array(StoryboardShotSchema),
  })
);

export const SaveStoryboardResponseSchema = ApiResponseSchema(
  z.object({
    projectId: z.string(),
    savedAt: z.string(),
  })
);

export const LoadStoryboardResponseSchema = ApiResponseSchema(
  z.object({
    shots: z.array(ShotSchema),
    storyboardShots: z.array(StoryboardShotSchema),
    savedAt: z.string(),
  })
);

export const GetSavedStoryboardsResponseSchema = ApiResponseSchema(
  z.object({
    storyboards: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        shotCount: z.number().int().min(0),
        updatedAt: z.string(),
      })
    ),
  })
);

// ============================================================================
// 타입 추출 (Type Inference)
// ============================================================================

// Core Domain Types
export type StoryInput = z.infer<typeof StoryInputSchema>;
export type StoryStep = z.infer<typeof StoryStepSchema>;
export type ScenarioData = z.infer<typeof ScenarioDataSchema>;
export type PromptData = z.infer<typeof PromptDataSchema>;
export type VideoData = z.infer<typeof VideoDataSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type ProjectListFilters = z.infer<typeof ProjectListFiltersSchema>;

// API Response Types
export type StoryGenerationResponse = z.infer<typeof StoryGenerationResponseSchema>;
export type StorySaveResponse = z.infer<typeof StorySaveResponseSchema>;
export type StoryLoadResponse = z.infer<typeof StoryLoadResponseSchema>;
export type SavedStoriesResponse = z.infer<typeof SavedStoriesResponseSchema>;
export type ScenarioSaveResponse = z.infer<typeof ScenarioSaveResponseSchema>;
export type PromptSaveResponse = z.infer<typeof PromptSaveResponseSchema>;
export type PromptsGetResponse = z.infer<typeof PromptsGetResponseSchema>;
export type VideoSaveResponse = z.infer<typeof VideoSaveResponseSchema>;
export type VideosGetResponse = z.infer<typeof VideosGetResponseSchema>;
export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;

// Project API Response Types
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;
export type UpdateProjectResponse = z.infer<typeof UpdateProjectResponseSchema>;
export type GetProjectResponse = z.infer<typeof GetProjectResponseSchema>;
export type GetProjectsResponse = z.infer<typeof GetProjectsResponseSchema>;
export type GetRecentProjectsResponse = z.infer<typeof GetRecentProjectsResponseSchema>;
export type GetProjectStatsResponse = z.infer<typeof GetProjectStatsResponseSchema>;

// Storyboard API Response Types
export type GenerateShotsResponse = z.infer<typeof GenerateShotsResponseSchema>;
export type GenerateStoryboardResponse = z.infer<typeof GenerateStoryboardResponseSchema>;
export type SaveStoryboardResponse = z.infer<typeof SaveStoryboardResponseSchema>;
export type LoadStoryboardResponse = z.infer<typeof LoadStoryboardResponseSchema>;
export type GetSavedStoryboardsResponse = z.infer<typeof GetSavedStoryboardsResponseSchema>;

// Error Types
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// 스키마 검증 유틸리티
// ============================================================================

/**
 * 스키마 검증 결과 타입
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    issues: z.ZodIssue[];
  };
}

/**
 * 안전한 스키마 검증 함수
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'Data'
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      console.warn(`⚠️ ${context} 스키마 검증 실패:`, result.error.issues);
      return {
        success: false,
        error: {
          message: `${context} 스키마 검증 실패: ${result.error.issues.map(i => i.message).join(', ')}`,
          issues: result.error.issues,
        },
      };
    }
  } catch (error) {
    console.error(`❌ ${context} 스키마 검증 중 예외 발생:`, error);
    return {
      success: false,
      error: {
        message: `${context} 스키마 검증 중 예외 발생: ${error instanceof Error ? error.message : String(error)}`,
        issues: [],
      },
    };
  }
}

/**
 * 스트릭트 스키마 검증 (예외 발생)
 */
export function validateSchemaStrict<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'Data'
): T {
  const result = validateSchema(schema, data, context);

  if (!result.success) {
    throw new Error(result.error?.message || `${context} 스키마 검증 실패`);
  }

  return result.data!;
}