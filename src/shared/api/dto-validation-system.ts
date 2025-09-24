/**
 * DTO → 도메인 모델 변환 검증 시스템
 * 서버 응답 데이터의 무결성을 보장하고 타입 안전성을 제공
 * Zod 스키마 기반 런타임 검증 및 변환
 */

import { z } from 'zod';

// 기본 데이터 타입 스키마들
const BaseSchemas = {
  id: z.string().min(1, 'ID는 필수입니다'),
  timestamp: z.union([
    z.string().datetime(),
    z.number().int().positive(),
  ]).transform(val => typeof val === 'string' ? new Date(val) : new Date(val)),
  url: z.string().url().optional(),
  email: z.string().email().optional(),
  uuid: z.string().uuid().optional(),
} as const;

// 사용자 관련 스키마
export const UserDTOSchema = z.object({
  id: BaseSchemas.id,
  email: z.string().email('유효한 이메일 주소가 필요합니다'),
  name: z.string().min(1, '이름은 필수입니다'),
  avatar_url: BaseSchemas.url,
  created_at: BaseSchemas.timestamp,
  updated_at: BaseSchemas.timestamp,
  subscription_tier: z.enum(['free', 'pro', 'enterprise']).default('free'),
  usage_stats: z.object({
    api_calls_today: z.number().int().min(0).default(0),
    cost_today: z.number().min(0).default(0),
    projects_count: z.number().int().min(0).default(0),
  }).optional(),
});

export const UserDomainSchema = UserDTOSchema.transform(dto => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  avatarUrl: dto.avatar_url,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  subscriptionTier: dto.subscription_tier,
  usageStats: dto.usage_stats ? {
    apiCallsToday: dto.usage_stats.api_calls_today,
    costToday: dto.usage_stats.cost_today,
    projectsCount: dto.usage_stats.projects_count,
  } : undefined,
}));

// 프로젝트 관련 스키마
export const ProjectDTOSchema = z.object({
  id: BaseSchemas.id,
  title: z.string().min(1, '프로젝트 제목은 필수입니다'),
  description: z.string().optional(),
  user_id: BaseSchemas.id,
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).default('draft'),
  metadata: z.record(z.unknown()).optional(),
  created_at: BaseSchemas.timestamp,
  updated_at: BaseSchemas.timestamp,
  scenes_count: z.number().int().min(0).default(0),
  estimated_cost: z.number().min(0).optional(),
});

export const ProjectDomainSchema = ProjectDTOSchema.transform(dto => ({
  id: dto.id,
  title: dto.title,
  description: dto.description,
  userId: dto.user_id,
  status: dto.status,
  metadata: dto.metadata,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  scenesCount: dto.scenes_count,
  estimatedCost: dto.estimated_cost,
}));

// 시나리오 관련 스키마
export const ScenarioDTOSchema = z.object({
  id: BaseSchemas.id,
  project_id: BaseSchemas.id,
  title: z.string().min(1, '시나리오 제목은 필수입니다'),
  content: z.string().min(10, '시나리오 내용은 최소 10자 이상이어야 합니다'),
  scenes: z.array(z.object({
    id: BaseSchemas.id,
    sequence_number: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string(),
    duration_seconds: z.number().min(0).optional(),
    location: z.string().optional(),
    characters: z.array(z.string()).default([]),
    props: z.array(z.string()).default([]),
    mood: z.enum(['dramatic', 'comedic', 'romantic', 'action', 'suspense']).optional(),
  })).default([]),
  genre: z.enum(['drama', 'comedy', 'action', 'romance', 'thriller', 'documentary']).optional(),
  target_duration: z.number().min(0).optional(),
  created_at: BaseSchemas.timestamp,
  updated_at: BaseSchemas.timestamp,
});

export const ScenarioDomainSchema = ScenarioDTOSchema.transform(dto => ({
  id: dto.id,
  projectId: dto.project_id,
  title: dto.title,
  content: dto.content,
  scenes: dto.scenes.map(scene => ({
    id: scene.id,
    sequenceNumber: scene.sequence_number,
    title: scene.title,
    description: scene.description,
    durationSeconds: scene.duration_seconds,
    location: scene.location,
    characters: scene.characters,
    props: scene.props,
    mood: scene.mood,
  })),
  genre: dto.genre,
  targetDuration: dto.target_duration,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
}));

// 스토리보드 관련 스키마
export const StoryboardDTOSchema = z.object({
  id: BaseSchemas.id,
  scenario_id: BaseSchemas.id,
  scene_id: BaseSchemas.id,
  sequence_number: z.number().int().min(1),
  image_url: BaseSchemas.url,
  image_prompt: z.string().min(10, '이미지 프롬프트는 최소 10자 이상이어야 합니다'),
  image_style: z.enum(['realistic', 'cartoon', 'anime', 'sketch', '3d']).optional(),
  camera_angle: z.enum(['wide', 'medium', 'close_up', 'extreme_close_up', 'bird_eye', 'worm_eye']).optional(),
  lighting: z.enum(['natural', 'dramatic', 'soft', 'hard', 'golden_hour', 'blue_hour']).optional(),
  mood: z.string().optional(),
  notes: z.string().optional(),
  generation_metadata: z.object({
    model: z.string(),
    provider: z.enum(['bytedance', 'openai', 'midjourney']),
    cost: z.number().min(0),
    generation_time_ms: z.number().int().min(0),
    prompt_tokens: z.number().int().min(0).optional(),
    seed: z.number().int().optional(),
  }).optional(),
  created_at: BaseSchemas.timestamp,
  updated_at: BaseSchemas.timestamp,
});

export const StoryboardDomainSchema = StoryboardDTOSchema.transform(dto => ({
  id: dto.id,
  scenarioId: dto.scenario_id,
  sceneId: dto.scene_id,
  sequenceNumber: dto.sequence_number,
  imageUrl: dto.image_url,
  imagePrompt: dto.image_prompt,
  imageStyle: dto.image_style,
  cameraAngle: dto.camera_angle,
  lighting: dto.lighting,
  mood: dto.mood,
  notes: dto.notes,
  generationMetadata: dto.generation_metadata ? {
    model: dto.generation_metadata.model,
    provider: dto.generation_metadata.provider,
    cost: dto.generation_metadata.cost,
    generationTimeMs: dto.generation_metadata.generation_time_ms,
    promptTokens: dto.generation_metadata.prompt_tokens,
    seed: dto.generation_metadata.seed,
  } : undefined,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
}));

// 비디오 생성 관련 스키마
export const VideoJobDTOSchema = z.object({
  id: BaseSchemas.id,
  storyboard_id: BaseSchemas.id,
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  video_url: BaseSchemas.url,
  thumbnail_url: BaseSchemas.url,
  duration_seconds: z.number().min(0).optional(),
  resolution: z.enum(['720p', '1080p', '4k']).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  format: z.enum(['mp4', 'webm', 'mov']).default('mp4'),
  provider_job_id: z.string().optional(),
  generation_metadata: z.object({
    provider: z.enum(['runway', 'pika', 'stable_video']),
    model: z.string(),
    cost: z.number().min(0),
    generation_time_ms: z.number().int().min(0),
    prompt: z.string(),
    style_preset: z.string().optional(),
    motion_strength: z.number().min(0).max(1).optional(),
  }).optional(),
  error_message: z.string().optional(),
  retry_count: z.number().int().min(0).default(0),
  created_at: BaseSchemas.timestamp,
  updated_at: BaseSchemas.timestamp,
  completed_at: BaseSchemas.timestamp.optional(),
});

export const VideoJobDomainSchema = VideoJobDTOSchema.transform(dto => ({
  id: dto.id,
  storyboardId: dto.storyboard_id,
  status: dto.status,
  videoUrl: dto.video_url,
  thumbnailUrl: dto.thumbnail_url,
  durationSeconds: dto.duration_seconds,
  resolution: dto.resolution,
  fps: dto.fps,
  format: dto.format,
  providerJobId: dto.provider_job_id,
  generationMetadata: dto.generation_metadata ? {
    provider: dto.generation_metadata.provider,
    model: dto.generation_metadata.model,
    cost: dto.generation_metadata.cost,
    generationTimeMs: dto.generation_metadata.generation_time_ms,
    prompt: dto.generation_metadata.prompt,
    stylePreset: dto.generation_metadata.style_preset,
    motionStrength: dto.generation_metadata.motion_strength,
  } : undefined,
  errorMessage: dto.error_message,
  retryCount: dto.retry_count,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  completedAt: dto.completed_at,
}));

// 타입 추론
export type UserDTO = z.infer<typeof UserDTOSchema>;
export type UserDomain = z.infer<typeof UserDomainSchema>;
export type ProjectDTO = z.infer<typeof ProjectDTOSchema>;
export type ProjectDomain = z.infer<typeof ProjectDomainSchema>;
export type ScenarioDTO = z.infer<typeof ScenarioDTOSchema>;
export type ScenarioDomain = z.infer<typeof ScenarioDomainSchema>;
export type StoryboardDTO = z.infer<typeof StoryboardDTOSchema>;
export type StoryboardDomain = z.infer<typeof StoryboardDomainSchema>;
export type VideoJobDTO = z.infer<typeof VideoJobDTOSchema>;
export type VideoJobDomain = z.infer<typeof VideoJobDomainSchema>;

// 검증 에러 타입
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly value: unknown,
    public readonly schema: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 변환 실패 에러 타입
export class TransformationError extends Error {
  constructor(
    message: string,
    public readonly originalData: unknown,
    public readonly schema: string,
    public readonly validationErrors: z.ZodError
  ) {
    super(message);
    this.name = 'TransformationError';
  }
}

/**
 * DTO 검증 및 변환 유틸리티 클래스
 */
export class DTOValidator {
  private static validationStats = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    transformationErrors: 0,
    validationsBySchema: new Map<string, number>(),
    errorsBySchema: new Map<string, number>(),
  };

  /**
   * DTO를 도메인 모델로 안전하게 변환
   */
  static validateAndTransform<T, U>(
    data: unknown,
    schema: z.ZodSchema<U>,
    schemaName: string
  ): U {
    this.validationStats.totalValidations++;
    this.validationStats.validationsBySchema.set(
      schemaName,
      (this.validationStats.validationsBySchema.get(schemaName) || 0) + 1
    );

    try {
      const result = schema.parse(data);
      this.validationStats.successfulValidations++;

      console.log(`[DTO Validation] ✅ ${schemaName} 검증 성공`, {
        schema: schemaName,
        dataSize: JSON.stringify(data).length,
      });

      return result;

    } catch (error) {
      this.validationStats.failedValidations++;
      this.validationStats.errorsBySchema.set(
        schemaName,
        (this.validationStats.errorsBySchema.get(schemaName) || 0) + 1
      );

      if (error instanceof z.ZodError) {
        const transformationError = new TransformationError(
          `${schemaName} 스키마 검증 실패: ${error.errors.map(e => e.message).join(', ')}`,
          data,
          schemaName,
          error
        );

        console.error(`[DTO Validation] ❌ ${schemaName} 검증 실패:`, {
          schema: schemaName,
          errors: error.errors,
          data: data,
        });

        // 개발 환경에서는 상세 정보와 함께 에러 발생
        if (process.env.NODE_ENV === 'development') {
          console.group(`🔍 [DTO Validation] ${schemaName} 상세 오류 정보`);
          console.log('입력 데이터:', data);
          console.log('검증 오류:', error.errors);
          console.log('스키마:', schemaName);
          console.groupEnd();
        }

        throw transformationError;
      }

      throw error;
    }
  }

  /**
   * 배열 데이터 검증 및 변환
   */
  static validateAndTransformArray<T, U>(
    dataArray: unknown[],
    schema: z.ZodSchema<U>,
    schemaName: string
  ): U[] {
    if (!Array.isArray(dataArray)) {
      throw new ValidationError(
        `배열이 예상되었지만 ${typeof dataArray}를 받았습니다`,
        'root',
        dataArray,
        schemaName
      );
    }

    const results: U[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    dataArray.forEach((item, index) => {
      try {
        const result = this.validateAndTransform(item, schema, `${schemaName}[${index}]`);
        results.push(result);
      } catch (error) {
        errors.push({ index, error: error as Error });
      }
    });

    if (errors.length > 0) {
      console.warn(`[DTO Validation] 배열 검증 중 ${errors.length}개 오류 발생:`, errors);

      // 50% 이상 실패시 전체 실패 처리
      if (errors.length / dataArray.length > 0.5) {
        throw new ValidationError(
          `배열 검증 실패: ${errors.length}/${dataArray.length}개 항목에서 오류`,
          'array',
          dataArray,
          schemaName
        );
      }
    }

    return results;
  }

  /**
   * 부분 검증 (일부 필드만 검증)
   */
  static validatePartial<T, U>(
    data: unknown,
    schema: z.ZodSchema<U>,
    schemaName: string
  ): Partial<U> {
    try {
      return (schema as any).partial().parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new TransformationError(
          `${schemaName} 부분 스키마 검증 실패`,
          data,
          schemaName,
          error
        );
      }
      throw error;
    }
  }

  /**
   * 검증 통계 조회
   */
  static getValidationStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0 ?
        (this.validationStats.successfulValidations / this.validationStats.totalValidations * 100).toFixed(2) + '%' :
        '0%',
      validationsBySchema: Object.fromEntries(this.validationStats.validationsBySchema),
      errorsBySchema: Object.fromEntries(this.validationStats.errorsBySchema),
    };
  }

  /**
   * 통계 초기화
   */
  static resetStats(): void {
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      transformationErrors: 0,
      validationsBySchema: new Map(),
      errorsBySchema: new Map(),
    };
    console.log('[DTO Validation] 통계가 초기화되었습니다.');
  }

  /**
   * 스키마 품질 검사
   */
  static validateSchemaQuality<T>(schema: z.ZodSchema<T>, schemaName: string): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // 스키마 자체 검증
      schema.safeParse({});

      // 기본 품질 체크들
      const schemaString = schema.toString();

      if (!schemaString.includes('min')) {
        recommendations.push('문자열 필드에 최소 길이 제한을 추가하는 것을 고려해보세요');
      }

      if (!schemaString.includes('email') && schemaName.toLowerCase().includes('user')) {
        recommendations.push('사용자 스키마에 이메일 검증을 추가하는 것을 고려해보세요');
      }

      if (!schemaString.includes('transform')) {
        recommendations.push('DTO → Domain 변환을 위한 transform 추가를 고려해보세요');
      }

    } catch (error) {
      issues.push(`스키마 자체에 오류가 있습니다: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}

// 편의 함수들
export const validateUser = (data: unknown) =>
  DTOValidator.validateAndTransform(data, UserDomainSchema as any, 'User');

export const validateProject = (data: unknown) =>
  DTOValidator.validateAndTransform(data, ProjectDomainSchema as any, 'Project');

export const validateScenario = (data: unknown) =>
  DTOValidator.validateAndTransform(data, ScenarioDomainSchema as any, 'Scenario');

export const validateStoryboard = (data: unknown) =>
  DTOValidator.validateAndTransform(data, StoryboardDomainSchema as any, 'Storyboard');

export const validateVideoJob = (data: unknown) =>
  DTOValidator.validateAndTransform(data, VideoJobDomainSchema as any, 'VideoJob');

// 배열 검증 편의 함수들
export const validateUsers = (data: unknown[]) =>
  DTOValidator.validateAndTransformArray(data, UserDomainSchema as any, 'User');

export const validateProjects = (data: unknown[]) =>
  DTOValidator.validateAndTransformArray(data, ProjectDomainSchema as any, 'Project');

export const validateScenarios = (data: unknown[]) =>
  DTOValidator.validateAndTransformArray(data, ScenarioDomainSchema as any, 'Scenario');

export const validateStoryboards = (data: unknown[]) =>
  DTOValidator.validateAndTransformArray(data, StoryboardDomainSchema as any, 'Storyboard');

export const validateVideoJobs = (data: unknown[]) =>
  DTOValidator.validateAndTransformArray(data, VideoJobDomainSchema as any, 'VideoJob');

// 개발 도구용 전역 객체
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).VideoPlanetDTOValidator = {
    DTOValidator,
    getValidationStats: () => DTOValidator.getValidationStats(),
    resetStats: () => DTOValidator.resetStats(),
    validateUser,
    validateProject,
    validateScenario,
    validateStoryboard,
    validateVideoJob,
    schemas: {
      UserDTOSchema,
      UserDomainSchema,
      ProjectDTOSchema,
      ProjectDomainSchema,
      ScenarioDTOSchema,
      ScenarioDomainSchema,
      StoryboardDTOSchema,
      StoryboardDomainSchema,
      VideoJobDTOSchema,
      VideoJobDomainSchema,
    },
  };

  console.log('🔍 [DTO Validation] 개발 도구가 window.VideoPlanetDTOValidator에 등록되었습니다.');
}