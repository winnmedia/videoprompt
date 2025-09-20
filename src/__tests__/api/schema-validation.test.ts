/**
 * RTK Query 스키마 검증 시스템 테스트
 * CLAUDE.md TDD 원칙에 따른 포괄적 테스트 커버리지
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { z } from 'zod';

import {
  validateEndpointResponse,
  validateEndpointResponseStrict,
  ApiValidationError,
  validateApiError,
  createResponseTransformer,
  transformRTKQueryError,
  getValidationStats,
  resetValidationCache,
  validateSchemaHealth,
} from '@/shared/api/schema-validation';

import {
  StoryGenerationResponseSchema,
  StorySaveResponseSchema,
  ApiErrorSchema,
  StoryInputSchema,
  type StoryGenerationResponse,
  type StorySaveResponse,
} from '@/shared/schemas/api-schemas';

describe('Schema Validation System', () => {
  beforeEach(() => {
    resetValidationCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetValidationCache();
  });

  // ============================================================================
  // 성공 케이스 테스트
  // ============================================================================

  describe('Success Cases', () => {
    it('should validate correct story generation response', () => {
      const validResponse = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: '1막: 시작',
              description: '스토리가 시작됩니다',
              duration: 30,
              sequence: 1,
              keyElements: ['캐릭터 소개', '배경 설정'],
              visualNotes: '밝은 조명',
            },
          ],
          totalDuration: 30,
          metadata: { version: '1.0' },
        },
        message: 'Success',
      };

      const result = validateEndpointResponse('generateStory', validResponse);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.data.steps).toHaveLength(1);
      expect(result.data!.data.steps[0].title).toBe('1막: 시작');
    });

    it('should validate correct story save response', () => {
      const validResponse = {
        success: true,
        data: {
          projectId: 'proj-123',
          savedAt: '2024-01-01T00:00:00Z',
          version: '1.0',
        },
        message: 'Saved successfully',
      };

      const result = validateEndpointResponse('saveStory', validResponse);

      expect(result.success).toBe(true);
      expect(result.data!.data.projectId).toBe('proj-123');
    });

    it('should cache validation results for improved performance', () => {
      const validResponse = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: '테스트',
              description: '테스트 설명',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
            },
          ],
        },
      };

      // 첫 번째 검증
      const result1 = validateEndpointResponse('generateStory', validResponse);
      expect(result1.success).toBe(true);

      // 두 번째 검증 (캐시에서 가져와야 함)
      const result2 = validateEndpointResponse('generateStory', validResponse);
      expect(result2.success).toBe(true);

      // 캐시 통계 확인
      const stats = getValidationStats();
      expect(stats.cache.size).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 실패 케이스 테스트
  // ============================================================================

  describe('Failure Cases', () => {
    it('should handle missing required fields', () => {
      const invalidResponse = {
        success: true,
        data: {
          steps: [
            {
              // id 누락
              title: '1막: 시작',
              description: '스토리가 시작됩니다',
              // duration 누락
              sequence: 1,
              keyElements: ['캐릭터 소개'],
            },
          ],
        },
      };

      const result = validateEndpointResponse('generateStory', invalidResponse);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.arrayContaining(['id']) }),
          expect.objectContaining({ path: expect.arrayContaining(['duration']) }),
        ])
      );
    });

    it('should handle incorrect data types', () => {
      const invalidResponse = {
        success: true,
        data: {
          steps: [
            {
              id: 123, // 숫자가 아닌 문자열이어야 함
              title: '1막: 시작',
              description: '스토리가 시작됩니다',
              duration: '30분', // 문자열이 아닌 숫자여야 함
              sequence: 1,
              keyElements: 'test', // 배열이 아닌 문자열
            },
          ],
        },
      };

      const result = validateEndpointResponse('generateStory', invalidResponse);

      expect(result.success).toBe(false);
      expect(result.error!.issues).toHaveLength(3); // id, duration, keyElements
    });

    it('should handle malformed API responses', () => {
      const malformedResponses = [
        null,
        undefined,
        'string',
        123,
        [],
        { notAValidResponse: true },
      ];

      malformedResponses.forEach((response) => {
        const result = validateEndpointResponse('generateStory', response);
        expect(result.success).toBe(false);
      });
    });

    it('should throw error in strict mode', () => {
      const invalidResponse = {
        success: true,
        data: {
          steps: [], // 빈 배열은 유효하지만 steps가 없으면 실패할 수 있음
        },
      };

      expect(() => {
        validateEndpointResponseStrict('generateStory', { invalid: 'response' });
      }).toThrow(ApiValidationError);
    });
  });

  // ============================================================================
  // 에러 처리 테스트
  // ============================================================================

  describe('Error Handling', () => {
    it('should validate API error responses', () => {
      const apiError = {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { field: 'title', message: 'Required' },
      };

      const result = validateApiError(apiError);

      expect(result.success).toBe(true);
      expect(result.data!.error).toBe('Validation failed');
      expect(result.data!.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid error response format', () => {
      const invalidErrorResponses = [
        { error: 'No success field' },
        { success: 'not boolean', error: 'test' },
        null,
        undefined,
      ];

      invalidErrorResponses.forEach((errorResponse) => {
        const result = validateApiError(errorResponse);
        expect(result.success).toBe(false);
      });
    });

    it('should transform RTK Query errors correctly', () => {
      const mockError = {
        status: 400,
        data: {
          success: false,
          error: 'Bad Request',
          code: 'BAD_REQUEST',
        },
      };

      const transformResult = transformRTKQueryError(mockError);

      expect(transformResult.isValidated).toBe(true);
      expect(transformResult.validatedError).toBeDefined();
      expect(transformResult.validatedError!.error).toBe('Bad Request');
    });
  });

  // ============================================================================
  // 성능 테스트
  // ============================================================================

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeResponse = {
        success: true,
        data: {
          steps: Array.from({ length: 100 }, (_, i) => ({
            id: `step-${i}`,
            title: `Step ${i}`,
            description: `Description for step ${i}`,
            duration: 30,
            sequence: i + 1,
            keyElements: [`element-${i}`],
          })),
        },
      };

      const startTime = performance.now();
      const result = validateEndpointResponse('generateStory', largeResponse);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // 100ms 이하
    });

    it('should benefit from caching on repeated validations', () => {
      const response = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: 'Test',
              description: 'Test description',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
            },
          ],
        },
      };

      // 첫 번째 검증 (캐시 없음)
      const startTime1 = performance.now();
      validateEndpointResponse('generateStory', response);
      const endTime1 = performance.now();
      const firstValidationTime = endTime1 - startTime1;

      // 두 번째 검증 (캐시 사용)
      const startTime2 = performance.now();
      validateEndpointResponse('generateStory', response);
      const endTime2 = performance.now();
      const secondValidationTime = endTime2 - startTime2;

      // 캐시된 검증이 더 빨라야 함
      expect(secondValidationTime).toBeLessThan(firstValidationTime);
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle nested object validation errors', () => {
      const responseWithNestedErrors = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: 'Test',
              description: 'Test description',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
              visualNotes: {
                // visualNotes는 문자열이어야 하는데 객체가 옴
                invalid: 'structure',
              },
            },
          ],
        },
      };

      const result = validateEndpointResponse('generateStory', responseWithNestedErrors);

      expect(result.success).toBe(false);
      expect(result.error!.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['visualNotes']),
          }),
        ])
      );
    });

    it('should handle circular references gracefully', () => {
      const circularObject: any = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: 'Test',
              description: 'Test description',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
            },
          ],
        },
      };

      // 순환 참조 생성
      circularObject.data.steps[0].circular = circularObject;

      expect(() => {
        validateEndpointResponse('generateStory', circularObject);
      }).not.toThrow();
    });

    it('should handle very deep nested structures', () => {
      let deepNested: any = { value: 'deep' };
      for (let i = 0; i < 1000; i++) {
        deepNested = { nested: deepNested };
      }

      const responseWithDeepNesting = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: 'Test',
              description: 'Test description',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
              metadata: deepNested,
            },
          ],
        },
      };

      expect(() => {
        validateEndpointResponse('generateStory', responseWithDeepNesting);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 시스템 건강성 테스트
  // ============================================================================

  describe('System Health', () => {
    it('should report healthy system status', () => {
      const healthCheck = validateSchemaHealth();

      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.issues).toHaveLength(0);
    });

    it('should provide validation statistics', () => {
      // 몇 개의 검증 수행
      validateEndpointResponse('generateStory', {
        success: true,
        data: { steps: [] },
      });

      const stats = getValidationStats();

      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('registeredSchemas');
      expect(stats.registeredSchemas).toBeGreaterThan(0);
    });

    it('should handle cache reset correctly', () => {
      // 캐시에 데이터 추가
      validateEndpointResponse('generateStory', {
        success: true,
        data: { steps: [] },
      });

      let stats = getValidationStats();
      expect(stats.cache.size).toBeGreaterThan(0);

      // 캐시 리셋
      resetValidationCache();

      stats = getValidationStats();
      expect(stats.cache.size).toBe(0);
    });
  });

  // ============================================================================
  // Response Transformer 테스트
  // ============================================================================

  describe('Response Transformer', () => {
    it('should create working response transformer', () => {
      const transformer = createResponseTransformer('generateStory');

      const validResponse = {
        success: true,
        data: {
          steps: [
            {
              id: 'step-1',
              title: 'Test',
              description: 'Test description',
              duration: 30,
              sequence: 1,
              keyElements: ['test'],
            },
          ],
        },
      };

      const result = transformer(validResponse, {}, {});

      // 검증된 데이터가 반환되어야 함
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle transformer errors gracefully', () => {
      const transformer = createResponseTransformer('generateStory');

      const invalidResponse = { invalid: 'data' };

      // 변환 실패 시 원본 데이터 반환 (graceful degradation)
      const result = transformer(invalidResponse, {}, {});

      expect(result).toBe(invalidResponse);
    });
  });
});

// ============================================================================
// 입력 데이터 검증 테스트
// ============================================================================

describe('Input Data Validation', () => {
  describe('StoryInput Validation', () => {
    it('should validate correct story input', () => {
      const validInput = {
        title: 'Test Story',
        description: 'A test story description',
        duration: 60,
        genre: 'Drama',
        target: 'General Audience',
        format: '16:9',
        toneAndManner: ['Serious', 'Emotional'],
        visualStyle: 'Cinematic',
      };

      const result = StoryInputSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data!.title).toBe('Test Story');
    });

    it('should reject invalid story input', () => {
      const invalidInputs = [
        {
          // title 누락
          description: 'A test story description',
          duration: 60,
          genre: 'Drama',
          target: 'General Audience',
          format: '16:9',
          toneAndManner: ['Serious'],
        },
        {
          title: '', // 빈 문자열
          description: 'A test story description',
          duration: 60,
          genre: 'Drama',
          target: 'General Audience',
          format: '16:9',
          toneAndManner: ['Serious'],
        },
        {
          title: 'Test Story',
          description: 'A test story description',
          duration: -10, // 음수
          genre: 'Drama',
          target: 'General Audience',
          format: '16:9',
          toneAndManner: ['Serious'],
        },
        {
          title: 'Test Story',
          description: 'A test story description',
          duration: 60,
          genre: 'Drama',
          target: 'General Audience',
          format: '16:9',
          toneAndManner: [], // 빈 배열
        },
      ];

      invalidInputs.forEach((input) => {
        const result = StoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});

// ============================================================================
// 통합 테스트
// ============================================================================

describe('Integration Tests', () => {
  it('should handle complete validation workflow', async () => {
    // 1. 입력 데이터 검증
    const storyInput = {
      title: 'Integration Test Story',
      description: 'A story for integration testing',
      duration: 120,
      genre: 'Thriller',
      target: 'Adult Audience',
      format: '16:9',
      toneAndManner: ['Dark', 'Suspenseful'],
    };

    const inputValidation = StoryInputSchema.safeParse(storyInput);
    expect(inputValidation.success).toBe(true);

    // 2. API 응답 검증
    const apiResponse = {
      success: true,
      data: {
        steps: [
          {
            id: 'step-1',
            title: '1막: 설정',
            description: '스토리 설정 단계',
            duration: 30,
            sequence: 1,
            keyElements: ['캐릭터 소개', '배경 설명'],
          },
          {
            id: 'step-2',
            title: '2막: 발전',
            description: '갈등 발전 단계',
            duration: 60,
            sequence: 2,
            keyElements: ['갈등 심화', '위기 상황'],
          },
          {
            id: 'step-3',
            title: '3막: 절정',
            description: '클라이맥스 단계',
            duration: 20,
            sequence: 3,
            keyElements: ['절정', '전환점'],
          },
          {
            id: 'step-4',
            title: '4막: 해결',
            description: '결말 단계',
            duration: 10,
            sequence: 4,
            keyElements: ['해결', '결말'],
          },
        ],
        totalDuration: 120,
      },
      message: 'Story generated successfully',
    };

    const responseValidation = validateEndpointResponse('generateStory', apiResponse);
    expect(responseValidation.success).toBe(true);

    // 3. 저장 응답 검증
    const saveResponse = {
      success: true,
      data: {
        projectId: 'integration-test-proj-123',
        savedAt: new Date().toISOString(),
        version: '1.0',
      },
      message: 'Story saved successfully',
    };

    const saveValidation = validateEndpointResponse('saveStory', saveResponse);
    expect(saveValidation.success).toBe(true);

    // 4. 전체 워크플로우 검증
    expect(inputValidation.data!.title).toBe('Integration Test Story');
    expect(responseValidation.data!.data.steps).toHaveLength(4);
    expect(saveValidation.data!.data.projectId).toBe('integration-test-proj-123');
  });
});