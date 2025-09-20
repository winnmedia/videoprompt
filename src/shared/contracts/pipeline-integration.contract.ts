/**
 * 파이프라인 통합 계약 정의
 * OpenAPI 기반 타입 안전 계약 (Benjamin's Contract-First Architecture)
 *
 * 핵심 원칙:
 * 1. OpenAPI 명세가 단일 소스 진실 (Single Source of Truth)
 * 2. Zod로 런타임 검증
 * 3. 타입 안전 보장
 * 4. Consumer-Driven Contract (CDC) 지원
 */

import { z } from 'zod';

// ============================================================================
// 기본 스키마 정의
// ============================================================================

/**
 * 파이프라인 단계 열거형
 */
export const PipelineStepSchema = z.enum(['story', 'scenario', 'prompt', 'video']);

/**
 * 파이프라인 상태 열거형
 */
export const PipelineStatusSchema = z.enum(['idle', 'processing', 'completed', 'failed']);

/**
 * UUID 검증 스키마
 */
export const UuidSchema = z.string().uuid();

/**
 * 날짜시간 검증 스키마
 */
export const DateTimeSchema = z.string().datetime();

// ============================================================================
// 메타데이터 스키마
// ============================================================================

/**
 * 파이프라인 메타데이터
 */
export const PipelineMetadataSchema = z.object({
  createdAt: DateTimeSchema,
  version: z.literal('1.0.0'),
  source: z.literal('pipeline-integration')
}).strict();

/**
 * 기본 파이프라인 페이로드
 */
export const BasePipelinePayloadSchema = z.object({
  projectId: UuidSchema,
  userId: z.string().optional(),
  correlationId: UuidSchema,
  metadata: PipelineMetadataSchema
}).strict();

// ============================================================================
// 1단계: 스토리 입력 계약
// ============================================================================

/**
 * 스토리 데이터 스키마
 */
export const StoryDataSchema = z.object({
  content: z.string()
    .min(10, '스토리는 최소 10자 이상이어야 합니다')
    .max(2000, '스토리는 2000자를 초과할 수 없습니다'),
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다'),
  genre: z.string().optional(),
  tone: z.string().optional(),
  targetAudience: z.string().optional()
}).strict();

/**
 * 스토리 입력 요청 스키마
 */
export const StoryInputRequestSchema = BasePipelinePayloadSchema.extend({
  story: StoryDataSchema
}).strict();

/**
 * 스토리 출력 응답 스키마
 */
export const StoryOutputResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    storyId: UuidSchema,
    content: z.string(),
    title: z.string(),
    processedAt: DateTimeSchema,
    nextStep: z.literal('scenario')
  }).strict().optional(),
  error: z.string().optional(),
  correlationId: UuidSchema
}).strict();

// ============================================================================
// 2단계: 시나리오 생성 계약
// ============================================================================

/**
 * 시나리오 데이터 스키마
 */
export const ScenarioDataSchema = z.object({
  genre: z.string().min(1, '장르는 필수입니다'),
  tone: z.string().min(1, '톤은 필수입니다'),
  structure: z.array(z.string()).min(1, '구조는 최소 1개 이상이어야 합니다'),
  target: z.string().min(1, '타겟은 필수입니다'),
  developmentMethod: z.string().optional(),
  developmentIntensity: z.enum(['low', 'medium', 'high']).optional()
}).strict();

/**
 * 시나리오 생성 요청 스키마
 */
export const ScenarioGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  storyId: UuidSchema,
  scenario: ScenarioDataSchema
}).strict();

/**
 * 시나리오 생성 응답 스키마
 */
export const ScenarioGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    scenarioId: UuidSchema,
    storyId: UuidSchema,
    generatedScenario: z.string().min(50, '생성된 시나리오는 최소 50자 이상이어야 합니다'),
    structure: z.array(z.string()),
    metadata: z.object({
      genre: z.string(),
      tone: z.string(),
      estimatedDuration: z.number().int().min(10).max(600)
    }).strict(),
    processedAt: DateTimeSchema,
    nextStep: z.literal('prompt')
  }).strict().optional(),
  error: z.string().optional(),
  correlationId: UuidSchema
}).strict();

// ============================================================================
// 3단계: 프롬프트 생성 계약
// ============================================================================

/**
 * 프롬프트 데이터 스키마
 */
export const PromptDataSchema = z.object({
  visualStyle: z.string().min(1, '비주얼 스타일은 필수입니다'),
  mood: z.string().min(1, '무드는 필수입니다'),
  quality: z.enum(['standard', 'premium', 'cinematic']),
  directorStyle: z.string().optional(),
  lighting: z.string().optional(),
  cameraAngle: z.string().optional(),
  movement: z.string().optional(),
  keywords: z.array(z.string()).max(20, '키워드는 최대 20개까지 가능합니다').optional()
}).strict();

/**
 * 프롬프트 생성 요청 스키마
 */
export const PromptGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  scenarioId: UuidSchema,
  prompt: PromptDataSchema
}).strict();

/**
 * 프롬프트 생성 응답 스키마
 */
export const PromptGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    promptId: UuidSchema,
    scenarioId: UuidSchema,
    finalPrompt: z.string().min(20, '최종 프롬프트는 최소 20자 이상이어야 합니다'),
    negativePrompt: z.string().optional(),
    enhancedKeywords: z.array(z.string()),
    metadata: z.object({
      quality: z.enum(['standard', 'premium', 'cinematic']),
      estimatedTokens: z.number().int().min(1),
      optimizationApplied: z.boolean()
    }).strict(),
    processedAt: DateTimeSchema,
    nextStep: z.literal('video')
  }).strict().optional(),
  error: z.string().optional(),
  correlationId: UuidSchema
}).strict();

// ============================================================================
// 4단계: 영상 생성 계약
// ============================================================================

/**
 * 영상 데이터 스키마
 */
export const VideoDataSchema = z.object({
  duration: z.number().int().min(5).max(180, '영상 길이는 5초~180초까지 가능합니다'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
  provider: z.enum(['seedance', 'runway', 'stable-video']).default('seedance'),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
}).strict();

/**
 * 영상 생성 요청 스키마
 */
export const VideoGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  promptId: UuidSchema,
  video: VideoDataSchema
}).strict();

/**
 * 영상 생성 응답 스키마
 */
export const VideoGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    videoId: UuidSchema,
    promptId: UuidSchema,
    jobId: z.string().min(1, 'Job ID는 필수입니다'),
    provider: z.string(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    estimatedCompletionTime: DateTimeSchema.optional(),
    queuePosition: z.number().int().min(0).optional(),
    processedAt: DateTimeSchema,
    nextStep: z.null()
  }).strict().optional(),
  error: z.string().optional(),
  correlationId: UuidSchema
}).strict();

// ============================================================================
// 파이프라인 상태 조회 계약
// ============================================================================

/**
 * 파이프라인 상태 요청 스키마
 */
export const PipelineStatusRequestSchema = z.object({
  projectId: UuidSchema,
  correlationId: UuidSchema.optional()
}).strict();

/**
 * 파이프라인 진행 상태 스키마
 */
export const PipelineProgressSchema = z.object({
  story: z.object({
    completed: z.boolean(),
    id: UuidSchema.optional()
  }).strict(),
  scenario: z.object({
    completed: z.boolean(),
    id: UuidSchema.optional()
  }).strict(),
  prompt: z.object({
    completed: z.boolean(),
    id: UuidSchema.optional()
  }).strict(),
  video: z.object({
    completed: z.boolean(),
    id: UuidSchema.optional(),
    jobId: z.string().optional()
  }).strict()
}).strict();

/**
 * 파이프라인 상태 응답 스키마
 */
export const PipelineStatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    projectId: UuidSchema,
    currentStep: PipelineStepSchema,
    status: PipelineStatusSchema,
    progress: PipelineProgressSchema,
    lastUpdated: DateTimeSchema,
    errors: z.array(z.object({
      step: PipelineStepSchema,
      message: z.string(),
      timestamp: DateTimeSchema
    }).strict()).optional()
  }).strict().optional(),
  error: z.string().optional()
}).strict();

// ============================================================================
// TypeScript 타입 정의 (자동 생성)
// ============================================================================

export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type PipelineMetadata = z.infer<typeof PipelineMetadataSchema>;
export type BasePipelinePayload = z.infer<typeof BasePipelinePayloadSchema>;

// 스토리 관련 타입
export type StoryData = z.infer<typeof StoryDataSchema>;
export type StoryInputRequest = z.infer<typeof StoryInputRequestSchema>;
export type StoryOutputResponse = z.infer<typeof StoryOutputResponseSchema>;

// 시나리오 관련 타입
export type ScenarioData = z.infer<typeof ScenarioDataSchema>;
export type ScenarioGenerationRequest = z.infer<typeof ScenarioGenerationRequestSchema>;
export type ScenarioGenerationResponse = z.infer<typeof ScenarioGenerationResponseSchema>;

// 프롬프트 관련 타입
export type PromptData = z.infer<typeof PromptDataSchema>;
export type PromptGenerationRequest = z.infer<typeof PromptGenerationRequestSchema>;
export type PromptGenerationResponse = z.infer<typeof PromptGenerationResponseSchema>;

// 영상 관련 타입
export type VideoData = z.infer<typeof VideoDataSchema>;
export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;
export type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>;

// 상태 관련 타입
export type PipelineStatusRequest = z.infer<typeof PipelineStatusRequestSchema>;
export type PipelineProgress = z.infer<typeof PipelineProgressSchema>;
export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;

// ============================================================================
// 계약 검증 유틸리티
// ============================================================================

/**
 * 타입 안전 계약 검증기
 */
export class PipelineContractValidator {

  /**
   * 스토리 입력 요청 검증
   */
  static validateStoryInput(data: unknown): {
    success: true;
    data: StoryInputRequest;
  } | {
    success: false;
    errors: string[];
  } {
    try {
      const validated = StoryInputRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 시나리오 생성 요청 검증
   */
  static validateScenarioGeneration(data: unknown): {
    success: true;
    data: ScenarioGenerationRequest;
  } | {
    success: false;
    errors: string[];
  } {
    try {
      const validated = ScenarioGenerationRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 프롬프트 생성 요청 검증
   */
  static validatePromptGeneration(data: unknown): {
    success: true;
    data: PromptGenerationRequest;
  } | {
    success: false;
    errors: string[];
  } {
    try {
      const validated = PromptGenerationRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 영상 생성 요청 검증
   */
  static validateVideoGeneration(data: unknown): {
    success: true;
    data: VideoGenerationRequest;
  } | {
    success: false;
    errors: string[];
  } {
    try {
      const validated = VideoGenerationRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 파이프라인 상태 응답 검증
   */
  static validatePipelineStatus(data: unknown): {
    success: true;
    data: PipelineStatusResponse;
  } | {
    success: false;
    errors: string[];
  } {
    try {
      const validated = PipelineStatusResponseSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }
}

// ============================================================================
// 테스트 데이터 팩토리
// ============================================================================

/**
 * 계약 테스트용 데이터 팩토리
 */
export class PipelineTestDataFactory {

  /**
   * 유효한 스토리 입력 요청 생성
   */
  static createStoryRequest(overrides: Partial<StoryInputRequest> = {}): StoryInputRequest {
    const now = new Date().toISOString();
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: now,
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      story: {
        content: '한 소년이 마법의 세계로 떠나는 모험 이야기입니다. 그는 용기와 지혜로 시련을 극복하고 성장하게 됩니다.',
        title: '마법 세계의 모험',
        genre: 'Fantasy',
        tone: 'Adventurous',
        targetAudience: 'Young Adults'
      },
      ...overrides
    };
  }

  /**
   * 유효한 시나리오 생성 요청 생성
   */
  static createScenarioRequest(overrides: Partial<ScenarioGenerationRequest> = {}): ScenarioGenerationRequest {
    const now = new Date().toISOString();
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: now,
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      storyId: '550e8400-e29b-41d4-a716-446655440002',
      scenario: {
        genre: 'Fantasy',
        tone: 'Adventurous',
        structure: ['설정', '갈등', '절정', '해결'],
        target: 'Young Adults',
        developmentMethod: 'character-driven',
        developmentIntensity: 'medium'
      },
      ...overrides
    };
  }

  /**
   * 유효한 프롬프트 생성 요청 생성
   */
  static createPromptRequest(overrides: Partial<PromptGenerationRequest> = {}): PromptGenerationRequest {
    const now = new Date().toISOString();
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: now,
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      scenarioId: '550e8400-e29b-41d4-a716-446655440003',
      prompt: {
        visualStyle: 'cinematic',
        mood: 'adventurous',
        quality: 'premium',
        directorStyle: 'Christopher Nolan',
        lighting: 'golden hour',
        cameraAngle: 'wide shot',
        movement: 'slow zoom',
        keywords: ['magic', 'adventure', 'young hero', 'fantasy world']
      },
      ...overrides
    };
  }

  /**
   * 유효한 영상 생성 요청 생성
   */
  static createVideoRequest(overrides: Partial<VideoGenerationRequest> = {}): VideoGenerationRequest {
    const now = new Date().toISOString();
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: now,
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      promptId: '550e8400-e29b-41d4-a716-446655440004',
      video: {
        duration: 30,
        aspectRatio: '16:9',
        resolution: '1080p',
        provider: 'seedance',
        priority: 'normal'
      },
      ...overrides
    };
  }

  /**
   * 유효한 파이프라인 상태 응답 생성
   */
  static createStatusResponse(overrides: Partial<PipelineStatusResponse> = {}): PipelineStatusResponse {
    const now = new Date().toISOString();
    return {
      success: true,
      data: {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        currentStep: 'prompt',
        status: 'processing',
        progress: {
          story: { completed: true, id: '550e8400-e29b-41d4-a716-446655440002' },
          scenario: { completed: true, id: '550e8400-e29b-41d4-a716-446655440003' },
          prompt: { completed: false },
          video: { completed: false }
        },
        lastUpdated: now,
        errors: []
      },
      ...overrides
    };
  }
}

// ============================================================================
// API 클라이언트 타입
// ============================================================================

/**
 * 파이프라인 API 클라이언트 인터페이스
 */
export interface PipelineApiClient {
  /**
   * 스토리 제출
   */
  submitStory(request: StoryInputRequest): Promise<StoryOutputResponse>;

  /**
   * 시나리오 생성
   */
  generateScenario(request: ScenarioGenerationRequest): Promise<ScenarioGenerationResponse>;

  /**
   * 프롬프트 생성
   */
  generatePrompt(request: PromptGenerationRequest): Promise<PromptGenerationResponse>;

  /**
   * 영상 생성
   */
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;

  /**
   * 파이프라인 상태 조회
   */
  getPipelineStatus(request: PipelineStatusRequest): Promise<PipelineStatusResponse>;
}

// ============================================================================
// 에러 타입 정의
// ============================================================================

/**
 * 파이프라인 에러 타입
 */
export interface PipelineError {
  type: 'validation' | 'business' | 'system';
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * 에러 응답 스키마
 */
export const PipelineErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  correlationId: UuidSchema.optional()
}).strict();

export type PipelineErrorResponse = z.infer<typeof PipelineErrorResponseSchema>;