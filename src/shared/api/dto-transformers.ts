/**
 * DTO ↔ 도메인 모델 변환기
 *
 * CLAUDE.md의 Anti-Corruption Layer 패턴 구현:
 * - Supabase DTO를 도메인 모델로 변환
 * - Zod를 통한 런타임 스키마 검증
 * - 타입 안전성 보장
 * - 불변성 유지
 */

import { z } from 'zod';
import {
  UserDTO,
  ProjectDTO,
  StoryDTO,
  ScenarioDTO,
  VideoGenerationDTO,
  PromptDTO,
  AssetDTO,
  UserDTOSchema,
  ProjectDTOSchema,
  StoryDTOSchema,
  ScenarioDTOSchema,
  VideoGenerationDTOSchema,
  PromptDTOSchema,
  AssetDTOSchema,
  ValidationError,
} from './types';

// ===========================================
// 도메인 모델 타입 (entities 레이어용)
// ===========================================

export interface User {
  readonly id: string;
  readonly email: string;
  readonly username?: string;
  readonly role: 'admin' | 'user' | 'guest';
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
  readonly apiUsage: {
    readonly today: number;
    readonly thisMonth: number;
  };
  readonly storageUsageBytes: number;
  readonly preferences: Readonly<Record<string, any>>;
  readonly notificationSettings: {
    readonly email: boolean;
    readonly push: boolean;
  };
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly lastLoginAt?: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface Project {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description?: string;
  readonly status: 'draft' | 'planning' | 'in_progress' | 'completed' | 'archived';
  readonly thumbnailUrl?: string;
  readonly settings: Readonly<Record<string, any>>;
  readonly brandGuidelines: Readonly<Record<string, any>>;
  readonly targetAudience?: string;
  readonly durationSeconds?: number;
  readonly collaborators: readonly string[];
  readonly isPublic: boolean;
  readonly shareToken?: string;
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface Story {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly title: string;
  readonly content: string;
  readonly storyType: 'advertisement' | 'education' | 'entertainment' | 'corporate' | 'social_media';
  readonly toneAndManner?: string;
  readonly targetAudience?: string;
  readonly aiMetadata: {
    readonly modelUsed?: string;
    readonly promptUsed?: string;
    readonly generationMetadata: Readonly<Record<string, any>>;
  };
  readonly structuredContent: Readonly<Record<string, any>>;
  readonly keywords: readonly string[];
  readonly estimatedDuration?: number;
  readonly version: number;
  readonly parentStoryId?: string;
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface Scenario {
  readonly id: string;
  readonly storyId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description?: string;
  readonly sceneOrder: number;
  readonly durationSeconds: number;
  readonly visualDescription?: string;
  readonly audioDescription?: string;
  readonly transition: {
    readonly type: string;
    readonly duration: number;
  };
  readonly prompt: {
    readonly image?: string;
    readonly negative?: string;
    readonly styleKeywords: readonly string[];
  };
  readonly technicalSpecs: Readonly<Record<string, any>>;
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface VideoGeneration {
  readonly id: string;
  readonly scenarioId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  readonly externalJobId?: string;
  readonly input: {
    readonly prompt: string;
    readonly imageUrl?: string;
    readonly settings: Readonly<Record<string, any>>;
  };
  readonly output: {
    readonly videoUrl?: string;
    readonly thumbnailUrl?: string;
    readonly metadata: Readonly<Record<string, any>>;
  };
  readonly progress: {
    readonly percentage: number;
    readonly queuePosition?: number;
    readonly estimatedCompletionAt?: Date;
  };
  readonly retry: {
    readonly count: number;
    readonly maxRetries: number;
    readonly lastErrorMessage?: string;
  };
  readonly cost: {
    readonly estimated?: number;
    readonly actual?: number;
  };
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly completedAt?: Date;
    readonly failedAt?: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface Prompt {
  readonly id: string;
  readonly userId?: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly isTemplate: boolean;
  readonly isPublic: boolean;
  readonly usageCount: number;
  readonly rating: number;
  readonly variables: Readonly<Record<string, any>>;
  readonly stylePresets: Readonly<Record<string, any>>;
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

export interface Asset {
  readonly id: string;
  readonly userId: string;
  readonly projectId?: string;
  readonly file: {
    readonly filename: string;
    readonly originalFilename: string;
    readonly path: string;
    readonly size: number;
    readonly mimeType: string;
    readonly type: 'image' | 'video' | 'audio' | 'template' | 'font';
  };
  readonly metadata: {
    readonly title?: string;
    readonly description?: string;
    readonly tags: readonly string[];
    readonly altText?: string;
  };
  readonly dimensions?: {
    readonly width: number;
    readonly height: number;
    readonly durationSeconds?: number;
  };
  readonly thumbnailUrl?: string;
  readonly usage: {
    readonly count: number;
    readonly lastUsedAt?: Date;
  };
  readonly urls: {
    readonly cdn?: string;
    readonly optimized: Readonly<Record<string, string>>;
  };
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
}

// ===========================================
// Gemini API 응답 타입 및 스키마
// ===========================================

// Gemini API 응답 스키마
const GeminiStoryResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string(),
          })
        ),
      }),
      finishReason: z.string().optional(),
      index: z.number(),
      safetyRatings: z.array(z.any()).optional(),
    })
  ),
  promptFeedback: z.object({
    safetyRatings: z.array(z.any()).optional(),
  }).optional(),
  usageMetadata: z.object({
    promptTokenCount: z.number(),
    candidatesTokenCount: z.number(),
    totalTokenCount: z.number(),
  }).optional(),
});

// 구조화된 스토리 스키마
const StructuredStorySchema = z.object({
  title: z.string().min(1, '스토리 제목은 필수입니다'),
  description: z.string().optional(),
  targetAudience: z.string().optional(),
  toneAndManner: z.string().optional(),
  estimatedDuration: z.number().positive().optional(),
  scenes: z.array(
    z.object({
      sceneNumber: z.number().positive(),
      title: z.string().min(1, '씬 제목은 필수입니다'),
      description: z.string().min(10, '씬 설명은 최소 10자 이상이어야 합니다'),
      duration: z.number().positive().min(1, '씬 지속시간은 1초 이상이어야 합니다'),
      visualDescription: z.string().min(5, '시각적 설명은 최소 5자 이상이어야 합니다'),
      audioDescription: z.string().optional(),
      transition: z.object({
        type: z.enum(['fade', 'cut', 'slide', 'zoom', 'dissolve']),
        duration: z.number().nonnegative(),
      }).optional(),
      prompt: z.object({
        image: z.string().min(5, '이미지 프롬프트는 최소 5자 이상이어야 합니다'),
        negative: z.string().optional(),
        styleKeywords: z.array(z.string()).default([]),
      }),
    })
  ).min(1, '최소 1개의 씬이 필요합니다'),
  keywords: z.array(z.string()).default([]),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    modelUsed: z.string(),
    promptUsed: z.string(),
    version: z.string().default('1.0'),
  }),
});

// 시나리오 기획 도메인 모델
export interface ScenarioPlanning {
  readonly id?: string;
  readonly projectId: string;
  readonly userId: string;
  readonly title: string;
  readonly description?: string;
  readonly targetAudience?: string;
  readonly toneAndManner?: string;
  readonly estimatedDuration?: number;
  readonly scenes: readonly ScenePlan[];
  readonly keywords: readonly string[];
  readonly metadata: {
    readonly generatedAt: Date;
    readonly modelUsed: string;
    readonly promptUsed: string;
    readonly version: string;
  };
  readonly qualityScore?: number;
  readonly validationResult?: {
    readonly isValid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  };
}

export interface ScenePlan {
  readonly sceneNumber: number;
  readonly title: string;
  readonly description: string;
  readonly duration: number;
  readonly visualDescription: string;
  readonly audioDescription?: string;
  readonly transition?: {
    readonly type: 'fade' | 'cut' | 'slide' | 'zoom' | 'dissolve';
    readonly duration: number;
  };
  readonly prompt: {
    readonly image: string;
    readonly negative?: string;
    readonly styleKeywords: readonly string[];
  };
}

// 데이터 품질 검사 결과
export interface DataQualityResult {
  readonly isValid: boolean;
  readonly score: number; // 0-100
  readonly errors: readonly QualityIssue[];
  readonly warnings: readonly QualityIssue[];
  readonly metrics: {
    readonly wordCount: number;
    readonly sceneCount: number;
    readonly averageSceneDuration: number;
    readonly duplicateScenes: number;
    readonly missingPrompts: number;
  };
}

export interface QualityIssue {
  readonly type: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly sceneNumber?: number;
  readonly field?: string;
  readonly suggestion?: string;
}

type GeminiStoryResponse = z.infer<typeof GeminiStoryResponseSchema>;
type StructuredStory = z.infer<typeof StructuredStorySchema>;

// ===========================================
// 변환 유틸리티 함수
// ===========================================

/**
 * ISO 문자열을 Date 객체로 안전하게 변환
 */
function safeParseDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * DTO 검증 및 에러 처리
 */
function validateDTO<T>(schema: z.ZodSchema<T>, data: unknown, entityName: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Invalid ${entityName} data`,
        {
          entityName,
          errors: error.errors,
          receivedData: data,
        }
      );
    }
    throw error;
  }
}

// ===========================================
// DTO → 도메인 모델 변환기
// ===========================================

class DTOTransformers {
  /**
   * User DTO → User 도메인 모델
   */
  userFromDTO(dto: unknown): User {
    const validated = validateDTO(UserDTOSchema, dto, 'User');

    return Object.freeze({
      id: validated.id,
      email: validated.email,
      username: validated.username,
      role: validated.role,
      displayName: validated.display_name,
      avatarUrl: validated.avatar_url,
      bio: validated.bio,
      apiUsage: Object.freeze({
        today: validated.api_calls_today,
        thisMonth: validated.api_calls_this_month,
      }),
      storageUsageBytes: validated.storage_usage_bytes,
      preferences: Object.freeze(validated.preferences),
      notificationSettings: Object.freeze({
        email: validated.notification_settings.email,
        push: validated.notification_settings.push,
      }),
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
        lastLoginAt: safeParseDate(validated.last_login_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * Project DTO → Project 도메인 모델
   */
  projectFromDTO(dto: unknown): Project {
    const validated = validateDTO(ProjectDTOSchema, dto, 'Project');

    return Object.freeze({
      id: validated.id,
      userId: validated.user_id,
      title: validated.title,
      description: validated.description,
      status: validated.status,
      thumbnailUrl: validated.thumbnail_url,
      settings: Object.freeze(validated.settings),
      brandGuidelines: Object.freeze(validated.brand_guidelines),
      targetAudience: validated.target_audience,
      durationSeconds: validated.duration_seconds,
      collaborators: Object.freeze(validated.collaborators),
      isPublic: validated.is_public,
      shareToken: validated.share_token,
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * Story DTO → Story 도메인 모델
   */
  storyFromDTO(dto: unknown): Story {
    const validated = validateDTO(StoryDTOSchema, dto, 'Story');

    return Object.freeze({
      id: validated.id,
      projectId: validated.project_id,
      userId: validated.user_id,
      title: validated.title,
      content: validated.content,
      storyType: validated.story_type,
      toneAndManner: validated.tone_and_manner,
      targetAudience: validated.target_audience,
      aiMetadata: Object.freeze({
        modelUsed: validated.ai_model_used,
        promptUsed: validated.prompt_used,
        generationMetadata: Object.freeze(validated.generation_metadata),
      }),
      structuredContent: Object.freeze(validated.structured_content),
      keywords: Object.freeze(validated.keywords),
      estimatedDuration: validated.estimated_duration,
      version: validated.version,
      parentStoryId: validated.parent_story_id,
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * Scenario DTO → Scenario 도메인 모델
   */
  scenarioFromDTO(dto: unknown): Scenario {
    const validated = validateDTO(ScenarioDTOSchema, dto, 'Scenario');

    return Object.freeze({
      id: validated.id,
      storyId: validated.story_id,
      projectId: validated.project_id,
      title: validated.title,
      description: validated.description,
      sceneOrder: validated.scene_order,
      durationSeconds: validated.duration_seconds,
      visualDescription: validated.visual_description,
      audioDescription: validated.audio_description,
      transition: Object.freeze({
        type: validated.transition_type,
        duration: validated.transition_duration,
      }),
      prompt: Object.freeze({
        image: validated.image_prompt,
        negative: validated.negative_prompt,
        styleKeywords: Object.freeze(validated.style_keywords),
      }),
      technicalSpecs: Object.freeze(validated.technical_specs),
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * VideoGeneration DTO → VideoGeneration 도메인 모델
   */
  videoGenerationFromDTO(dto: unknown): VideoGeneration {
    const validated = validateDTO(VideoGenerationDTOSchema, dto, 'VideoGeneration');

    return Object.freeze({
      id: validated.id,
      scenarioId: validated.scenario_id,
      projectId: validated.project_id,
      userId: validated.user_id,
      status: validated.status,
      externalJobId: validated.external_job_id,
      input: Object.freeze({
        prompt: validated.input_prompt,
        imageUrl: validated.input_image_url,
        settings: Object.freeze(validated.generation_settings),
      }),
      output: Object.freeze({
        videoUrl: validated.output_video_url,
        thumbnailUrl: validated.output_thumbnail_url,
        metadata: Object.freeze(validated.output_metadata),
      }),
      progress: Object.freeze({
        percentage: validated.progress_percentage,
        queuePosition: validated.queue_position,
        estimatedCompletionAt: safeParseDate(validated.estimated_completion_at),
      }),
      retry: Object.freeze({
        count: validated.retry_count,
        maxRetries: validated.max_retries,
        lastErrorMessage: validated.last_error_message,
      }),
      cost: Object.freeze({
        estimated: validated.estimated_cost,
        actual: validated.actual_cost,
      }),
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
        completedAt: safeParseDate(validated.completed_at),
        failedAt: safeParseDate(validated.failed_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * Prompt DTO → Prompt 도메인 모델
   */
  promptFromDTO(dto: unknown): Prompt {
    const validated = validateDTO(PromptDTOSchema, dto, 'Prompt');

    return Object.freeze({
      id: validated.id,
      userId: validated.user_id,
      title: validated.title,
      content: validated.content,
      category: validated.category,
      tags: Object.freeze(validated.tags),
      isTemplate: validated.is_template,
      isPublic: validated.is_public,
      usageCount: validated.usage_count,
      rating: validated.rating,
      variables: Object.freeze(validated.variables),
      stylePresets: Object.freeze(validated.style_presets),
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  /**
   * Asset DTO → Asset 도메인 모델
   */
  assetFromDTO(dto: unknown): Asset {
    const validated = validateDTO(AssetDTOSchema, dto, 'Asset');

    return Object.freeze({
      id: validated.id,
      userId: validated.user_id,
      projectId: validated.project_id,
      file: Object.freeze({
        filename: validated.filename,
        originalFilename: validated.original_filename,
        path: validated.file_path,
        size: validated.file_size,
        mimeType: validated.mime_type,
        type: validated.asset_type,
      }),
      metadata: Object.freeze({
        title: validated.title,
        description: validated.description,
        tags: Object.freeze(validated.tags),
        altText: validated.alt_text,
      }),
      dimensions: validated.width && validated.height ? Object.freeze({
        width: validated.width,
        height: validated.height,
        durationSeconds: validated.duration_seconds,
      }) : undefined,
      thumbnailUrl: validated.thumbnail_url,
      usage: Object.freeze({
        count: validated.usage_count,
        lastUsedAt: safeParseDate(validated.last_used_at),
      }),
      urls: Object.freeze({
        cdn: validated.cdn_url,
        optimized: Object.freeze(validated.optimized_urls),
      }),
      timestamps: Object.freeze({
        createdAt: new Date(validated.created_at),
        updatedAt: new Date(validated.updated_at),
      }),
      isDeleted: validated.is_deleted,
      deletedAt: safeParseDate(validated.deleted_at),
    });
  }

  // ===========================================
  // 도메인 모델 → DTO 변환기 (생성/수정용)
  // ===========================================

  /**
   * Project 도메인 모델 → Project Insert DTO
   */
  projectToInsertDTO(project: Omit<Project, 'id' | 'timestamps' | 'isDeleted' | 'deletedAt'>): any {
    return {
      user_id: project.userId,
      title: project.title,
      description: project.description,
      status: project.status,
      thumbnail_url: project.thumbnailUrl,
      settings: project.settings,
      brand_guidelines: project.brandGuidelines,
      target_audience: project.targetAudience,
      duration_seconds: project.durationSeconds,
      collaborators: [...project.collaborators],
      is_public: project.isPublic,
      share_token: project.shareToken,
    };
  }

  /**
   * Story 도메인 모델 → Story Insert DTO
   */
  storyToInsertDTO(story: Omit<Story, 'id' | 'timestamps' | 'isDeleted' | 'deletedAt' | 'version'>): any {
    return {
      project_id: story.projectId,
      user_id: story.userId,
      title: story.title,
      content: story.content,
      story_type: story.storyType,
      tone_and_manner: story.toneAndManner,
      target_audience: story.targetAudience,
      ai_model_used: story.aiMetadata.modelUsed,
      prompt_used: story.aiMetadata.promptUsed,
      generation_metadata: story.aiMetadata.generationMetadata,
      structured_content: story.structuredContent,
      keywords: [...story.keywords],
      estimated_duration: story.estimatedDuration,
      parent_story_id: story.parentStoryId,
    };
  }

  /**
   * 배열 변환기
   */
  arrayFromDTOs<T>(
    dtos: unknown[],
    transformer: (dto: unknown) => T
  ): readonly T[] {
    return Object.freeze(dtos.map(transformer));
  }

  // ===========================================
  // Gemini API 변환기 및 품질 검사
  // ===========================================

  /**
   * Gemini API 응답 → ScenarioPlanning 도메인 모델
   */
  scenarioPlanningFromGeminiResponse(
    response: unknown,
    projectId: string,
    userId: string,
    originalPrompt: string
  ): ScenarioPlanning {
    // Gemini 응답 검증
    const validatedResponse = validateDTO(GeminiStoryResponseSchema, response, 'GeminiResponse');

    if (!validatedResponse.candidates || validatedResponse.candidates.length === 0) {
      throw new ValidationError('Gemini API 응답에 후보가 없습니다', {
        entityName: 'GeminiResponse',
        errors: [{ message: '응답에 생성된 컨텐츠가 없습니다' }],
        receivedData: response,
      });
    }

    const firstCandidate = validatedResponse.candidates[0];
    if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0) {
      throw new ValidationError('Gemini API 응답에 컨텐츠가 없습니다', {
        entityName: 'GeminiResponse',
        errors: [{ message: '생성된 텍스트가 없습니다' }],
        receivedData: response,
      });
    }

    // JSON 파싱 시도
    const generatedText = firstCandidate.content.parts[0].text;
    let structuredStory: StructuredStory;

    try {
      const parsedJson = JSON.parse(generatedText);
      structuredStory = validateDTO(StructuredStorySchema, parsedJson, 'StructuredStory');
    } catch (error) {
      throw new ValidationError('Gemini 응답을 구조화된 스토리로 파싱할 수 없습니다', {
        entityName: 'StructuredStory',
        errors: [{ message: `파싱 오류: ${error}` }],
        receivedData: generatedText,
      });
    }

    // 도메인 모델로 변환
    const scenarioPlanning: ScenarioPlanning = Object.freeze({
      projectId,
      userId,
      title: structuredStory.title,
      description: structuredStory.description,
      targetAudience: structuredStory.targetAudience,
      toneAndManner: structuredStory.toneAndManner,
      estimatedDuration: structuredStory.estimatedDuration,
      scenes: Object.freeze(
        structuredStory.scenes.map((scene): ScenePlan =>
          Object.freeze({
            sceneNumber: scene.sceneNumber,
            title: scene.title,
            description: scene.description,
            duration: scene.duration,
            visualDescription: scene.visualDescription,
            audioDescription: scene.audioDescription,
            transition: scene.transition ? Object.freeze({
              type: scene.transition.type,
              duration: scene.transition.duration,
            }) : undefined,
            prompt: Object.freeze({
              image: scene.prompt.image,
              negative: scene.prompt.negative,
              styleKeywords: Object.freeze(scene.prompt.styleKeywords),
            }),
          })
        )
      ),
      keywords: Object.freeze(structuredStory.keywords),
      metadata: Object.freeze({
        generatedAt: new Date(structuredStory.metadata.generatedAt),
        modelUsed: structuredStory.metadata.modelUsed,
        promptUsed: originalPrompt,
        version: structuredStory.metadata.version,
      }),
    });

    // 데이터 품질 검사 수행
    const qualityResult = this.performDataQualityCheck(scenarioPlanning);

    return Object.freeze({
      ...scenarioPlanning,
      qualityScore: qualityResult.score,
      validationResult: Object.freeze({
        isValid: qualityResult.isValid,
        errors: Object.freeze(qualityResult.errors.map(e => e.message)),
        warnings: Object.freeze(qualityResult.warnings.map(w => w.message)),
      }),
    });
  }

  /**
   * 데이터 품질 검사 수행
   */
  performDataQualityCheck(scenarioPlanning: ScenarioPlanning): DataQualityResult {
    const errors: QualityIssue[] = [];
    const warnings: QualityIssue[] = [];

    // 기본 메트릭 계산
    const totalContent = scenarioPlanning.scenes.map(s => s.description).join(' ');
    const wordCount = totalContent.split(/\s+/).length;
    const sceneCount = scenarioPlanning.scenes.length;
    const averageSceneDuration = sceneCount > 0
      ? scenarioPlanning.scenes.reduce((sum, scene) => sum + scene.duration, 0) / sceneCount
      : 0;

    // 중복 씬 검사
    const sceneTitles = scenarioPlanning.scenes.map(s => s.title.toLowerCase());
    const uniqueTitles = new Set(sceneTitles);
    const duplicateScenes = sceneTitles.length - uniqueTitles.size;

    // 누락된 프롬프트 검사
    const missingPrompts = scenarioPlanning.scenes.filter(
      scene => !scene.prompt.image || scene.prompt.image.trim().length < 5
    ).length;

    // 품질 규칙 검증
    this.validateContentLength(wordCount, errors, warnings);
    this.validateSceneCount(sceneCount, errors, warnings);
    this.validateSceneDurations(scenarioPlanning.scenes, errors, warnings);
    this.validateDuplicateContent(duplicateScenes, errors, warnings);
    this.validatePromptQuality(scenarioPlanning.scenes, errors, warnings);
    this.validateSceneSequencing(scenarioPlanning.scenes, errors, warnings);

    // 품질 점수 계산 (0-100)
    const maxPossibleErrors = 10;
    const errorWeight = 2;
    const warningWeight = 1;
    const totalPenalty = (errors.length * errorWeight) + (warnings.length * warningWeight);
    const score = Math.max(0, 100 - (totalPenalty / maxPossibleErrors) * 100);

    return Object.freeze({
      isValid: errors.length === 0,
      score: Math.round(score),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      metrics: Object.freeze({
        wordCount,
        sceneCount,
        averageSceneDuration,
        duplicateScenes,
        missingPrompts,
      }),
    });
  }

  /**
   * 컨텐츠 길이 검증
   */
  private validateContentLength(wordCount: number, errors: QualityIssue[], warnings: QualityIssue[]): void {
    const { MIN_WORD_COUNT, MAX_WORD_COUNT } = (globalThis as any).SCENARIO_CONFIG?.STORY_QUALITY_THRESHOLDS || { MIN_WORD_COUNT: 50, MAX_WORD_COUNT: 2000 };

    if (wordCount < MIN_WORD_COUNT) {
      errors.push({
        type: 'error',
        code: 'CONTENT_TOO_SHORT',
        message: `스토리가 너무 짧습니다 (${wordCount}자, 최소 ${MIN_WORD_COUNT}자 필요)`,
        suggestion: '더 자세한 설명을 추가하세요',
      });
    } else if (wordCount > MAX_WORD_COUNT) {
      warnings.push({
        type: 'warning',
        code: 'CONTENT_TOO_LONG',
        message: `스토리가 너무 깁니다 (${wordCount}자, 권장 최대 ${MAX_WORD_COUNT}자)`,
        suggestion: '불필요한 내용을 줄이는 것을 고려하세요',
      });
    }
  }

  /**
   * 씬 개수 검증
   */
  private validateSceneCount(sceneCount: number, errors: QualityIssue[], warnings: QualityIssue[]): void {
    const { MIN_SCENES, MAX_SCENES } = (globalThis as any).SCENARIO_CONFIG?.STORY_QUALITY_THRESHOLDS || { MIN_SCENES: 3, MAX_SCENES: 30 };

    if (sceneCount < MIN_SCENES) {
      errors.push({
        type: 'error',
        code: 'INSUFFICIENT_SCENES',
        message: `씬이 너무 적습니다 (${sceneCount}개, 최소 ${MIN_SCENES}개 필요)`,
        suggestion: '스토리를 더 세분화하여 씬을 추가하세요',
      });
    } else if (sceneCount > MAX_SCENES) {
      warnings.push({
        type: 'warning',
        code: 'TOO_MANY_SCENES',
        message: `씬이 너무 많습니다 (${sceneCount}개, 권장 최대 ${MAX_SCENES}개)`,
        suggestion: '관련 씬들을 병합하는 것을 고려하세요',
      });
    }
  }

  /**
   * 씬 지속시간 검증
   */
  private validateSceneDurations(scenes: readonly ScenePlan[], errors: QualityIssue[], warnings: QualityIssue[]): void {
    const { MIN_SCENE_DURATION, MAX_SCENE_DURATION } = (globalThis as any).SCENARIO_CONFIG?.STORY_QUALITY_THRESHOLDS || { MIN_SCENE_DURATION: 2, MAX_SCENE_DURATION: 30 };

    scenes.forEach((scene, index) => {
      if (scene.duration < MIN_SCENE_DURATION) {
        warnings.push({
          type: 'warning',
          code: 'SCENE_TOO_SHORT',
          message: `씬 ${scene.sceneNumber}이 너무 짧습니다 (${scene.duration}초)`,
          sceneNumber: scene.sceneNumber,
          suggestion: `최소 ${MIN_SCENE_DURATION}초로 연장을 고려하세요`,
        });
      } else if (scene.duration > MAX_SCENE_DURATION) {
        warnings.push({
          type: 'warning',
          code: 'SCENE_TOO_LONG',
          message: `씬 ${scene.sceneNumber}이 너무 깁니다 (${scene.duration}초)`,
          sceneNumber: scene.sceneNumber,
          suggestion: `${MAX_SCENE_DURATION}초 이하로 단축을 고려하세요`,
        });
      }
    });
  }

  /**
   * 중복 컨텐츠 검증
   */
  private validateDuplicateContent(duplicateScenes: number, errors: QualityIssue[], warnings: QualityIssue[]): void {
    if (duplicateScenes > 0) {
      warnings.push({
        type: 'warning',
        code: 'DUPLICATE_SCENES',
        message: `중복된 씬 제목이 ${duplicateScenes}개 발견되었습니다`,
        suggestion: '각 씬에 고유한 제목을 부여하세요',
      });
    }
  }

  /**
   * 프롬프트 품질 검증
   */
  private validatePromptQuality(scenes: readonly ScenePlan[], errors: QualityIssue[], warnings: QualityIssue[]): void {
    scenes.forEach((scene) => {
      if (!scene.prompt.image || scene.prompt.image.trim().length < 5) {
        errors.push({
          type: 'error',
          code: 'MISSING_IMAGE_PROMPT',
          message: `씬 ${scene.sceneNumber}에 이미지 프롬프트가 누락되었습니다`,
          sceneNumber: scene.sceneNumber,
          field: 'prompt.image',
          suggestion: '시각적 요소를 설명하는 상세한 프롬프트를 추가하세요',
        });
      }

      if (!scene.visualDescription || scene.visualDescription.trim().length < 10) {
        warnings.push({
          type: 'warning',
          code: 'WEAK_VISUAL_DESCRIPTION',
          message: `씬 ${scene.sceneNumber}의 시각적 설명이 부족합니다`,
          sceneNumber: scene.sceneNumber,
          field: 'visualDescription',
          suggestion: '더 구체적이고 상세한 시각적 설명을 추가하세요',
        });
      }
    });
  }

  /**
   * 씬 순서 검증
   */
  private validateSceneSequencing(scenes: readonly ScenePlan[], errors: QualityIssue[], warnings: QualityIssue[]): void {
    const expectedSequence = scenes.map((_, index) => index + 1);
    const actualSequence = scenes.map(scene => scene.sceneNumber).sort((a, b) => a - b);

    const isSequenceValid = expectedSequence.every((expected, index) => expected === actualSequence[index]);

    if (!isSequenceValid) {
      errors.push({
        type: 'error',
        code: 'INVALID_SCENE_SEQUENCE',
        message: '씬 번호가 연속적이지 않습니다',
        suggestion: '씬 번호를 1부터 연속적으로 설정하세요',
      });
    }
  }
}

// 싱글톤 인스턴스 export
export const dataTransformers = new DTOTransformers();

// 타입 export
export type {
  User,
  Project,
  Story,
  Scenario,
  VideoGeneration,
  Prompt,
  Asset,
  ScenarioPlanning,
  ScenePlan,
  DataQualityResult,
  QualityIssue,
};