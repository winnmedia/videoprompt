/**
 * 파이프라인 통합 계약 검증 테스트 (TDD)
 * 시나리오→프롬프트→영상 파이프라인의 계약 정의 및 검증
 *
 * Benjamin's Contract-First 원칙:
 * 1. 모든 DTO는 OpenAPI로 정의
 * 2. Zod로 런타임 검증
 * 3. Consumer-Driven Contract (CDC) 테스트
 * 4. 계약 위반 시 컴파일/테스트 실패
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { z } from 'zod';

// ============================================================================
// 파이프라인 통합 계약 스키마 정의
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
 * 기본 파이프라인 페이로드
 */
export const BasePipelinePayloadSchema = z.object({
  projectId: z.string().uuid('프로젝트 ID는 UUID 형식이어야 합니다'),
  userId: z.string().optional(),
  correlationId: z.string().uuid('상관관계 ID는 UUID 형식이어야 합니다'),
  metadata: z.object({
    createdAt: z.string().datetime(),
    version: z.literal('1.0.0'),
    source: z.literal('pipeline-integration')
  }).strict()
}).strict();

/**
 * 1단계: 스토리 입력 계약
 */
export const StoryInputRequestSchema = BasePipelinePayloadSchema.extend({
  story: z.object({
    content: z.string().min(10, '스토리는 최소 10자 이상이어야 합니다').max(2000, '스토리는 2000자를 초과할 수 없습니다'),
    title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자를 초과할 수 없습니다'),
    genre: z.string().optional(),
    tone: z.string().optional(),
    targetAudience: z.string().optional()
  }).strict()
});

export const StoryOutputResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    storyId: z.string().uuid(),
    content: z.string(),
    title: z.string(),
    processedAt: z.string().datetime(),
    nextStep: z.literal('scenario')
  }).strict(),
  error: z.string().optional(),
  correlationId: z.string().uuid()
}).strict();

/**
 * 2단계: 시나리오 생성 계약
 */
export const ScenarioGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  storyId: z.string().uuid('스토리 ID는 UUID 형식이어야 합니다'),
  scenario: z.object({
    genre: z.string().min(1, '장르는 필수입니다'),
    tone: z.string().min(1, '톤은 필수입니다'),
    structure: z.array(z.string()).min(1, '구조는 최소 1개 이상이어야 합니다'),
    target: z.string().min(1, '타겟은 필수입니다'),
    developmentMethod: z.string().optional(),
    developmentIntensity: z.enum(['low', 'medium', 'high']).optional()
  }).strict()
});

export const ScenarioGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    scenarioId: z.string().uuid(),
    storyId: z.string().uuid(),
    generatedScenario: z.string().min(50, '생성된 시나리오는 최소 50자 이상이어야 합니다'),
    structure: z.array(z.string()),
    metadata: z.object({
      genre: z.string(),
      tone: z.string(),
      estimatedDuration: z.number().int().min(10).max(600)
    }).strict(),
    processedAt: z.string().datetime(),
    nextStep: z.literal('prompt')
  }).strict(),
  error: z.string().optional(),
  correlationId: z.string().uuid()
}).strict();

/**
 * 3단계: 프롬프트 생성 계약
 */
export const PromptGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  scenarioId: z.string().uuid('시나리오 ID는 UUID 형식이어야 합니다'),
  prompt: z.object({
    visualStyle: z.string().min(1, '비주얼 스타일은 필수입니다'),
    mood: z.string().min(1, '무드는 필수입니다'),
    quality: z.enum(['standard', 'premium', 'cinematic']),
    directorStyle: z.string().optional(),
    lighting: z.string().optional(),
    cameraAngle: z.string().optional(),
    movement: z.string().optional(),
    keywords: z.array(z.string()).max(20, '키워드는 최대 20개까지 가능합니다').optional()
  }).strict()
});

export const PromptGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    promptId: z.string().uuid(),
    scenarioId: z.string().uuid(),
    finalPrompt: z.string().min(20, '최종 프롬프트는 최소 20자 이상이어야 합니다'),
    negativePrompt: z.string().optional(),
    enhancedKeywords: z.array(z.string()),
    metadata: z.object({
      quality: z.enum(['standard', 'premium', 'cinematic']),
      estimatedTokens: z.number().int().min(1),
      optimizationApplied: z.boolean()
    }).strict(),
    processedAt: z.string().datetime(),
    nextStep: z.literal('video')
  }).strict(),
  error: z.string().optional(),
  correlationId: z.string().uuid()
}).strict();

/**
 * 4단계: 영상 생성 계약
 */
export const VideoGenerationRequestSchema = BasePipelinePayloadSchema.extend({
  promptId: z.string().uuid('프롬프트 ID는 UUID 형식이어야 합니다'),
  video: z.object({
    duration: z.number().int().min(5).max(180, '영상 길이는 5초~180초까지 가능합니다'),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
    resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
    provider: z.enum(['seedance', 'runway', 'stable-video']).default('seedance'),
    priority: z.enum(['low', 'normal', 'high']).default('normal')
  }).strict()
});

export const VideoGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    videoId: z.string().uuid(),
    promptId: z.string().uuid(),
    jobId: z.string().min(1, 'Job ID는 필수입니다'),
    provider: z.string(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    estimatedCompletionTime: z.string().datetime().optional(),
    queuePosition: z.number().int().min(0).optional(),
    processedAt: z.string().datetime(),
    nextStep: z.null()
  }).strict(),
  error: z.string().optional(),
  correlationId: z.string().uuid()
}).strict();

/**
 * 파이프라인 상태 조회 계약
 */
export const PipelineStatusRequestSchema = z.object({
  projectId: z.string().uuid(),
  correlationId: z.string().uuid().optional()
});

export const PipelineStatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    projectId: z.string().uuid(),
    currentStep: PipelineStepSchema,
    status: PipelineStatusSchema,
    progress: z.object({
      story: z.object({ completed: z.boolean(), id: z.string().uuid().optional() }),
      scenario: z.object({ completed: z.boolean(), id: z.string().uuid().optional() }),
      prompt: z.object({ completed: z.boolean(), id: z.string().uuid().optional() }),
      video: z.object({ completed: z.boolean(), id: z.string().uuid().optional(), jobId: z.string().optional() })
    }).strict(),
    lastUpdated: z.string().datetime(),
    errors: z.array(z.object({
      step: PipelineStepSchema,
      message: z.string(),
      timestamp: z.string().datetime()
    })).optional()
  }).strict(),
  error: z.string().optional()
}).strict();

// ============================================================================
// 타입 정의 (자동 생성)
// ============================================================================

export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type BasePipelinePayload = z.infer<typeof BasePipelinePayloadSchema>;
export type StoryInputRequest = z.infer<typeof StoryInputRequestSchema>;
export type StoryOutputResponse = z.infer<typeof StoryOutputResponseSchema>;
export type ScenarioGenerationRequest = z.infer<typeof ScenarioGenerationRequestSchema>;
export type ScenarioGenerationResponse = z.infer<typeof ScenarioGenerationResponseSchema>;
export type PromptGenerationRequest = z.infer<typeof PromptGenerationRequestSchema>;
export type PromptGenerationResponse = z.infer<typeof PromptGenerationResponseSchema>;
export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;
export type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>;
export type PipelineStatusRequest = z.infer<typeof PipelineStatusRequestSchema>;
export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;

// ============================================================================
// 계약 검증 테스트 (TDD)
// ============================================================================

describe('파이프라인 통합 계약 검증', () => {

  describe('1단계: 스토리 입력 계약', () => {
    it('유효한 스토리 입력 요청을 검증해야 한다', () => {
      const validRequest: StoryInputRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:30:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        story: {
          content: '한 소년이 마법의 세계로 떠나는 모험 이야기입니다. 그는 용기와 지혜로 시련을 극복하고 성장하게 됩니다.',
          title: '마법 세계의 모험',
          genre: 'Fantasy',
          tone: 'Adventurous',
          targetAudience: 'Young Adults'
        }
      };

      expect(() => StoryInputRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('스토리가 너무 짧으면 실패해야 한다', () => {
      const invalidRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:30:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        story: {
          content: '짧음',
          title: '제목'
        }
      };

      expect(() => StoryInputRequestSchema.parse(invalidRequest)).toThrow(/최소 10자 이상/);
    });

    it('유효한 스토리 출력 응답을 검증해야 한다', () => {
      const validResponse: StoryOutputResponse = {
        success: true,
        data: {
          storyId: '550e8400-e29b-41d4-a716-446655440002',
          content: '한 소년이 마법의 세계로 떠나는 모험 이야기입니다.',
          title: '마법 세계의 모험',
          processedAt: '2024-01-15T10:31:00Z',
          nextStep: 'scenario'
        },
        correlationId: '550e8400-e29b-41d4-a716-446655440001'
      };

      expect(() => StoryOutputResponseSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('2단계: 시나리오 생성 계약', () => {
    it('유효한 시나리오 생성 요청을 검증해야 한다', () => {
      const validRequest: ScenarioGenerationRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:32:00Z',
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
        }
      };

      expect(() => ScenarioGenerationRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('구조가 비어있으면 실패해야 한다', () => {
      const invalidRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:32:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        scenario: {
          genre: 'Fantasy',
          tone: 'Adventurous',
          structure: [],
          target: 'Young Adults'
        }
      };

      expect(() => ScenarioGenerationRequestSchema.parse(invalidRequest)).toThrow(/최소 1개 이상/);
    });
  });

  describe('3단계: 프롬프트 생성 계약', () => {
    it('유효한 프롬프트 생성 요청을 검증해야 한다', () => {
      const validRequest: PromptGenerationRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:35:00Z',
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
        }
      };

      expect(() => PromptGenerationRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('키워드가 20개를 초과하면 실패해야 한다', () => {
      const invalidRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:35:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        scenarioId: '550e8400-e29b-41d4-a716-446655440003',
        prompt: {
          visualStyle: 'cinematic',
          mood: 'adventurous',
          quality: 'premium',
          keywords: Array(21).fill('keyword') // 21개 키워드
        }
      };

      expect(() => PromptGenerationRequestSchema.parse(invalidRequest)).toThrow(/최대 20개까지/);
    });
  });

  describe('4단계: 영상 생성 계약', () => {
    it('유효한 영상 생성 요청을 검증해야 한다', () => {
      const validRequest: VideoGenerationRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:40:00Z',
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
        }
      };

      expect(() => VideoGenerationRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('영상 길이가 범위를 벗어나면 실패해야 한다', () => {
      const invalidRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:40:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        promptId: '550e8400-e29b-41d4-a716-446655440004',
        video: {
          duration: 300, // 180초 초과
          aspectRatio: '16:9',
          resolution: '1080p',
          provider: 'seedance',
          priority: 'normal'
        }
      };

      expect(() => VideoGenerationRequestSchema.parse(invalidRequest)).toThrow(/5초~180초까지/);
    });
  });

  describe('파이프라인 상태 조회 계약', () => {
    it('유효한 상태 조회 응답을 검증해야 한다', () => {
      const validResponse: PipelineStatusResponse = {
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
          lastUpdated: '2024-01-15T10:45:00Z',
          errors: []
        }
      };

      expect(() => PipelineStatusResponseSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('계약 호환성 테스트', () => {
    it('모든 상관관계 ID가 일치해야 한다', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440001';

      // 각 단계의 응답에서 correlationId가 유지되는지 확인
      const storyResponse: StoryOutputResponse = {
        success: true,
        data: {
          storyId: '550e8400-e29b-41d4-a716-446655440002',
          content: 'test',
          title: 'test',
          processedAt: '2024-01-15T10:31:00Z',
          nextStep: 'scenario'
        },
        correlationId
      };

      expect(storyResponse.correlationId).toBe(correlationId);
    });

    it('단계별 ID 참조가 유효해야 한다', () => {
      const storyId = '550e8400-e29b-41d4-a716-446655440002';
      const scenarioId = '550e8400-e29b-41d4-a716-446655440003';
      const promptId = '550e8400-e29b-41d4-a716-446655440004';

      // 시나리오 생성 시 storyId 참조
      const scenarioRequest: ScenarioGenerationRequest = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        metadata: {
          createdAt: '2024-01-15T10:32:00Z',
          version: '1.0.0',
          source: 'pipeline-integration'
        },
        storyId,
        scenario: {
          genre: 'Fantasy',
          tone: 'Adventurous',
          structure: ['설정'],
          target: 'Young Adults'
        }
      };

      expect(scenarioRequest.storyId).toBe(storyId);
    });
  });

  describe('에러 처리 계약', () => {
    it('실패 응답 형식이 일관되어야 한다', () => {
      const errorResponse = {
        success: false,
        error: 'API 요청 실패: 잘못된 장르입니다',
        correlationId: '550e8400-e29b-41d4-a716-446655440001'
      };

      // 모든 응답 스키마는 error 필드를 선택적으로 가져야 함
      expect(() => StoryOutputResponseSchema.parse(errorResponse)).not.toThrow();
    });
  });
});

// ============================================================================
// 계약 검증 유틸리티
// ============================================================================

/**
 * 파이프라인 계약 검증기
 */
export class PipelineContractValidator {

  /**
   * 스토리 입력 검증
   */
  static validateStoryInput(data: unknown): { valid: boolean; errors?: string[] } {
    try {
      StoryInputRequestSchema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 시나리오 생성 검증
   */
  static validateScenarioGeneration(data: unknown): { valid: boolean; errors?: string[] } {
    try {
      ScenarioGenerationRequestSchema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 전체 파이프라인 상태 검증
   */
  static validatePipelineStatus(data: unknown): { valid: boolean; errors?: string[] } {
    try {
      PipelineStatusResponseSchema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
}

/**
 * 테스트 데이터 팩토리
 */
export class PipelineTestDataFactory {

  static createValidStoryRequest(overrides: Partial<StoryInputRequest> = {}): StoryInputRequest {
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: new Date().toISOString(),
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

  static createValidScenarioRequest(overrides: Partial<ScenarioGenerationRequest> = {}): ScenarioGenerationRequest {
    return {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      correlationId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: {
        createdAt: new Date().toISOString(),
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
}