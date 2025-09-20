/**
 * RTK Query 스키마 검증 미들웨어
 * API 응답에 대한 런타임 검증 및 타입 안전성 보장
 * CLAUDE.md 데이터 계약 원칙에 따른 중앙화된 검증 시스템
 */

import { z } from 'zod';
import {
  StoryGenerationResponseSchema,
  StorySaveResponseSchema,
  StoryLoadResponseSchema,
  SavedStoriesResponseSchema,
  ScenarioSaveResponseSchema,
  PromptSaveResponseSchema,
  PromptsGetResponseSchema,
  VideoSaveResponseSchema,
  VideosGetResponseSchema,
  PipelineStatusResponseSchema,
  CreateProjectResponseSchema,
  UpdateProjectResponseSchema,
  GetProjectResponseSchema,
  GetProjectsResponseSchema,
  GetRecentProjectsResponseSchema,
  GetProjectStatsResponseSchema,
  GenerateShotsResponseSchema,
  GenerateStoryboardResponseSchema,
  SaveStoryboardResponseSchema,
  LoadStoryboardResponseSchema,
  GetSavedStoryboardsResponseSchema,
  ApiErrorSchema,
  validateSchema,
  validateSchemaStrict,
  type ValidationResult,
} from '@/shared/schemas/api-schemas';

// ============================================================================
// 스키마 검증 캐시 시스템
// ============================================================================

/**
 * 스키마 검증 결과 캐시
 * 동일한 데이터에 대한 반복 검증을 방지하여 성능 최적화
 */
class ValidationCache {
  private cache = new Map<string, { result: ValidationResult<any>; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5분

  private generateCacheKey(data: unknown, schemaName: string): string {
    // 단순하고 빠른 해시 생성 (성능 우선)
    return `${schemaName}_${JSON.stringify(data).substring(0, 100)}`;
  }

  get<T>(data: unknown, schemaName: string): ValidationResult<T> | null {
    const key = this.generateCacheKey(data, schemaName);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key); // 만료된 캐시 삭제
    }

    return null;
  }

  set<T>(data: unknown, schemaName: string, result: ValidationResult<T>): void {
    const key = this.generateCacheKey(data, schemaName);
    this.cache.set(key, { result, timestamp: Date.now() });

    // 캐시 크기 제한 (메모리 관리)
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate?: number } {
    return { size: this.cache.size };
  }
}

const validationCache = new ValidationCache();

// ============================================================================
// 스키마 레지스트리
// ============================================================================

/**
 * API 엔드포인트별 스키마 매핑
 */
const RESPONSE_SCHEMA_REGISTRY = {
  // Story API
  'generateStory': StoryGenerationResponseSchema,
  'saveStory': StorySaveResponseSchema,
  'loadStory': StoryLoadResponseSchema,
  'getSavedStories': SavedStoriesResponseSchema,

  // Scenario API
  'saveScenario': ScenarioSaveResponseSchema,

  // Prompt API
  'savePrompt': PromptSaveResponseSchema,
  'getPrompts': PromptsGetResponseSchema,

  // Video API
  'saveVideo': VideoSaveResponseSchema,
  'getVideos': VideosGetResponseSchema,

  // Pipeline API
  'getPipelineStatus': PipelineStatusResponseSchema,

  // Project API
  'createProject': CreateProjectResponseSchema,
  'updateProject': UpdateProjectResponseSchema,
  'getProject': GetProjectResponseSchema,
  'getProjects': GetProjectsResponseSchema,
  'getRecentProjects': GetRecentProjectsResponseSchema,
  'getProjectStats': GetProjectStatsResponseSchema,

  // Storyboard API
  'generateShots': GenerateShotsResponseSchema,
  'generateStoryboard': GenerateStoryboardResponseSchema,
  'saveStoryboard': SaveStoryboardResponseSchema,
  'loadStoryboard': LoadStoryboardResponseSchema,
  'getSavedStoryboards': GetSavedStoryboardsResponseSchema,
} as const;

type EndpointName = keyof typeof RESPONSE_SCHEMA_REGISTRY;

// ============================================================================
// 캐시된 스키마 검증 함수
// ============================================================================

/**
 * 캐시가 적용된 스키마 검증
 */
export function validateWithCache<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName: string,
  context: string = 'API Response'
): ValidationResult<T> {
  // 캐시 확인
  const cached = validationCache.get<T>(data, schemaName);
  if (cached) {
    return cached;
  }

  // 스키마 검증 수행
  const result = validateSchema(schema, data, context);

  // 성공한 결과만 캐시 (실패는 재시도 가능성 고려)
  if (result.success) {
    validationCache.set(data, schemaName, result);
  }

  return result;
}

/**
 * 엔드포인트별 응답 검증
 */
export function validateEndpointResponse<T extends EndpointName>(
  endpointName: T,
  responseData: unknown,
  context?: string
): ValidationResult<z.infer<typeof RESPONSE_SCHEMA_REGISTRY[T]>> {
  const schema = RESPONSE_SCHEMA_REGISTRY[endpointName];
  const validationContext = context || `${endpointName} API Response`;

  return validateWithCache(
    schema,
    responseData,
    endpointName,
    validationContext
  );
}

/**
 * 스트릭트 엔드포인트 응답 검증 (예외 발생)
 */
export function validateEndpointResponseStrict<T extends EndpointName>(
  endpointName: T,
  responseData: unknown,
  context?: string
): z.infer<typeof RESPONSE_SCHEMA_REGISTRY[T]> {
  const result = validateEndpointResponse(endpointName, responseData, context);

  if (!result.success) {
    throw new ApiValidationError(
      `${endpointName} API 응답 검증 실패: ${result.error?.message}`,
      endpointName,
      result.error?.issues || []
    );
  }

  return result.data!;
}

// ============================================================================
// 커스텀 에러 클래스
// ============================================================================

/**
 * API 검증 실패 에러
 */
export class ApiValidationError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'ApiValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      endpoint: this.endpoint,
      issues: this.issues,
    };
  }
}

/**
 * API 에러 응답 검증
 */
export function validateApiError(
  errorData: unknown,
  context: string = 'API Error'
): ValidationResult<z.infer<typeof ApiErrorSchema>> {
  return validateWithCache(ApiErrorSchema, errorData, 'ApiError', context);
}

// ============================================================================
// RTK Query 변환 미들웨어
// ============================================================================

/**
 * RTK Query 응답 변환 함수
 * API 응답을 스키마 검증 후 타입 안전한 데이터로 변환
 */
export function createResponseTransformer<T extends EndpointName>(
  endpointName: T
) {
  return (response: unknown, meta: any, arg: any) => {
    try {
      // 스키마 검증
      const validationResult = validateEndpointResponse(
        endpointName,
        response,
        `${endpointName} Response Transform`
      );

      if (!validationResult.success) {
        console.error(`❌ ${endpointName} 응답 검증 실패:`, {
          error: validationResult.error?.message,
          issues: validationResult.error?.issues,
          receivedData: response,
        });

        // Graceful degradation: 원본 데이터 반환하지만 타입 안전성 손실
        return response;
      }

      console.log(`✅ ${endpointName} 응답 검증 성공`);
      return validationResult.data;

    } catch (error) {
      console.error(`❌ ${endpointName} 응답 변환 중 예외:`, error);

      // 예외 발생 시 원본 데이터 반환
      return response;
    }
  };
}

/**
 * RTK Query 에러 변환 함수
 */
export function transformRTKQueryError(error: any): {
  isValidated: boolean;
  originalError: any;
  validatedError?: z.infer<typeof ApiErrorSchema>;
} {
  try {
    // FetchBaseQueryError 구조 확인
    if (error && typeof error === 'object' && 'data' in error) {
      const validationResult = validateApiError(error.data, 'RTK Query Error');

      if (validationResult.success) {
        return {
          isValidated: true,
          originalError: error,
          validatedError: validationResult.data,
        };
      }
    }

    return {
      isValidated: false,
      originalError: error,
    };

  } catch (validationError) {
    console.error('❌ RTK Query 에러 검증 중 예외:', validationError);

    return {
      isValidated: false,
      originalError: error,
    };
  }
}

// ============================================================================
// 유틸리티 및 모니터링
// ============================================================================

/**
 * 스키마 검증 통계
 */
export function getValidationStats() {
  return {
    cache: validationCache.getStats(),
    registeredSchemas: Object.keys(RESPONSE_SCHEMA_REGISTRY).length,
  };
}

/**
 * 캐시 리셋 (테스트 및 디버깅용)
 */
export function resetValidationCache() {
  validationCache.clear();
}

/**
 * 스키마 검증 건강성 체크
 */
export function validateSchemaHealth(): {
  healthy: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  try {
    // 기본 스키마 검증 테스트
    const testData = { success: true, data: {}, message: 'test' };
    const testResult = validateSchema(
      z.object({ success: z.boolean(), data: z.any(), message: z.string() }),
      testData,
      'Health Check'
    );

    if (!testResult.success) {
      issues.push('기본 스키마 검증 실패');
    }

    // 캐시 시스템 테스트
    const cacheStats = validationCache.getStats();
    if (typeof cacheStats.size !== 'number') {
      issues.push('캐시 시스템 이상');
    }

  } catch (error) {
    issues.push(`스키마 시스템 예외: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}