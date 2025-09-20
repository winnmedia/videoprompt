/**
 * DTO 변환 계층 - API 응답을 View Model로 안전하게 변환
 * CLAUDE.md 데이터 계약 원칙에 따른 중앙화된 변환 로직
 *
 * v2.0 업데이트:
 * - Zod 스키마 검증 통합
 * - 성능 최적화된 캐싱 시스템
 * - 타입 안전성 강화
 */

import { logger } from '@/shared/lib/logger';
import {
  type StorySuccessResponse,
  type Act,
  validateStoryResponse,
  StoryContractViolationError
} from '@/shared/contracts/story.contract';
import { StoryStep, StoryInput } from '@/entities/scenario';
import {
  type SupabaseUserDTO,
  type PrismaUserDomain,
  SupabaseUserDTOSchema,
  PrismaUserDomainSchema,
  transformSupabaseUserToPrisma,
} from '@/shared/contracts/user-sync.schema';

// 새로운 Zod 기반 스키마 시스템 임포트
import {
  validateEndpointResponse,
  validateEndpointResponseStrict,
  ApiValidationError,
  type ValidationResult,
} from '@/shared/api/schema-validation';
import {
  type StoryGenerationResponse,
  type StoryStep as ZodStoryStep,
  type StoryInput as ZodStoryInput,
  type Project,
  type Shot,
  type StoryboardShot,
  StoryStepSchema,
  StoryInputSchema,
} from '@/shared/schemas/api-schemas';

/**
 * 스토리 기본 템플릿 (fallback)
 */
export function createFallbackStorySteps(
  context: string = 'Fallback Story Steps'
): StoryStep[] {
  console.warn(`⚠️ ${context}: 기본 스토리 템플릿을 사용합니다.`);

  const templates = [
    {
      title: 'AI 생성 스토리 - 1막',
      description: '스토리가 시작됩니다. 주인공과 상황을 소개합니다.',
      goal: '호기심과 기대감'
    },
    {
      title: 'AI 생성 스토리 - 2막',
      description: '갈등이 심화되고 문제가 복잡해집니다.',
      goal: '긴장감과 불안'
    },
    {
      title: 'AI 생성 스토리 - 3막',
      description: '절정에 도달하며 모든 갈등이 폭발합니다.',
      goal: '극도의 긴장과 몰입'
    },
    {
      title: 'AI 생성 스토리 - 4막',
      description: '갈등이 해결되고 이야기가 마무리됩니다.',
      goal: '카타르시스와 만족감'
    }
  ];

  return templates.map((template, index) => ({
    id: `fallback-step-${index + 1}`,
    title: template.title,
    summary: template.description,
    content: template.description,
    goal: template.goal,
    lengthHint: '전체의 25%',
    isEditing: false
  }));
}

/**
 * API Act DTO를 StoryStep View Model로 변환
 */
export function transformActToStoryStep(
  act: Act, 
  index: number,
  totalActs: number = 4
): StoryStep {
  return {
    id: `step-${index + 1}`,
    title: act.title,
    summary: act.description.length > 100 
      ? act.description.substring(0, 100) + '...'
      : act.description,
    content: act.description,
    goal: act.emotional_arc,
    lengthHint: `전체의 ${Math.round(100 / totalActs)}%`,
    isEditing: false,
  };
}

/**
 * 스토리 구조 DTO를 StoryStep 배열로 변환
 * 타입 안전성과 런타임 검증을 보장
 */
export function transformStoryStructureToSteps(
  response: unknown,
  context: string = 'Story API Response'
): StoryStep[] {
  // 먼저 스키마 검증으로 타입 안전성 보장
  let validatedResponse: StorySuccessResponse;
  try {
    validatedResponse = validateStoryResponse(response, context);
  } catch (error) {
    console.error(`DTO 변환 실패 - ${context}:`, error);

    // 검증 실패 시 기본 템플릿으로 대체 (graceful degradation)
    return createFallbackStorySteps(`${context} validation failed`);
  }

  const { structure } = validatedResponse;
  const acts = [structure.act1, structure.act2, structure.act3, structure.act4];

  return acts.map((act, index) => transformActToStoryStep(act, index, 4));
}

/**
 * Legacy 응답 구조 처리 (하위 호환성)
 * 기존 배열 형태 응답도 처리할 수 있도록 지원
 */
export function transformLegacyArrayToSteps(
  legacyStructure: any[],
  context: string = 'Legacy Structure'
): StoryStep[] {
  if (!Array.isArray(legacyStructure)) {
    console.warn(`Legacy 구조 변환 실패 - 배열이 아님 (${context})`);
    return createFallbackStorySteps(`${context} legacy structure invalid`);
  }

  return legacyStructure.map((step, index) => ({
    id: `step-${index + 1}`,
    title: step.title || `단계 ${index + 1}`,
    summary: step.summary || step.description || '',
    content: step.content || step.description || '',
    goal: step.goal || step.emotional_arc || '',
    lengthHint: step.lengthHint || `전체의 ${Math.round(100 / 4)}%`,
    isEditing: false,
  }));
}

/**
 * 통합 DTO 변환 함수 - API 응답을 StoryStep으로 안전하게 변환
 * 신규/레거시 구조 모두 처리
 */
export function transformApiResponseToStorySteps(
  apiResponse: unknown,
  context: string = 'API Response'
): StoryStep[] {
  if (!apiResponse || typeof apiResponse !== 'object') {
    console.error(`DTO 변환 실패 - 잘못된 응답 형식 (${context}):`, apiResponse);
    return [];
  }

  const response = apiResponse as Record<string, any>;

  // 새로운 Gemini API 응답 구조 (steps 배열) 처리 우선
  // API 응답이 {success: true, data: {steps: [...]}} 형태인 경우
  const stepsData = response.data?.steps || response.steps;
  if (stepsData && Array.isArray(stepsData)) {
    return stepsData.map((step: any, index: number) => ({
      id: `step-${step.step || index + 1}`,
      title: step.title || `단계 ${index + 1}`,
      summary: step.description && step.description.length > 100
        ? step.description.substring(0, 100) + '...'
        : step.description || '',
      content: step.description || '',
      goal: step.emotionalArc || '',
      lengthHint: step.duration || `전체의 ${Math.round(100 / 4)}%`,
      isEditing: false,
    }));
  }

  // 신규 구조 (structure 객체) 처리
  if (response.structure && typeof response.structure === 'object') {
    return transformStoryStructureToSteps(apiResponse, context);
  }

  // Legacy 배열 구조 처리
  if (Array.isArray(response)) {
    return transformLegacyArrayToSteps(response, context);
  }

  // 직접 배열이 포함된 경우
  if (response.acts && Array.isArray(response.acts)) {
    return transformLegacyArrayToSteps(response.acts, context);
  }

  console.warn(`알 수 없는 응답 구조 (${context}):`, apiResponse);
  return createFallbackStorySteps(`${context} unknown structure`);
}

/**
 * 에러 응답 변환 유틸리티
 */
export function transformApiError(
  error: unknown,
  context: string = 'API Error'
): string {
  if (error instanceof StoryContractViolationError) {
    return `데이터 형식 오류: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, any>;
    return errorObj.message || errorObj.error || '알 수 없는 오류가 발생했습니다';
  }

  return '예상치 못한 오류가 발생했습니다';
}

/**
 * 요청 DTO 변환 - StoryInput을 API 요청 형식으로 변환
 * API 계약 준수: toneAndManner 배열을 문자열로 안전하게 변환
 */
export function transformStoryInputToApiRequest(storyInput: any) {
  // toneAndManner 배열 또는 문자열을 문자열로 안전하게 변환
  let toneAndMannerString = '일반적';

  if (storyInput.toneAndManner) {
    if (Array.isArray(storyInput.toneAndManner)) {
      // 배열인 경우: 유효한 문자열들을 쉼표로 연결
      const validTones = storyInput.toneAndManner
        .filter((tone: string) => tone && typeof tone === 'string' && tone.trim())
        .map((tone: string) => tone.trim());

      if (validTones.length > 0) {
        toneAndMannerString = validTones.join(', ');
      }
    } else if (typeof storyInput.toneAndManner === 'string' && storyInput.toneAndManner.trim()) {
      // 이미 문자열인 경우: 그대로 사용
      toneAndMannerString = storyInput.toneAndManner.trim();
    }
  }

  return {
    title: storyInput.title?.trim() || '영상 시나리오',
    oneLineStory: storyInput.oneLineStory?.trim() || '영상 시나리오를 만들어주세요',
    genre: storyInput.genre?.trim() || '드라마',
    toneAndManner: toneAndMannerString,
    target: storyInput.target?.trim() || '일반 시청자',
    duration: storyInput.duration?.trim() || '60초',
    format: storyInput.format?.trim() || '16:9',
    tempo: storyInput.tempo?.trim() || '보통',
    developmentMethod: storyInput.developmentMethod?.trim() || '클래식 기승전결',
    developmentIntensity: storyInput.developmentIntensity?.trim() || '보통',
  };
}

// ============================================================================
// User 데이터 DTO 변환 (데이터 계약 준수)
// ============================================================================

/**
 * Supabase User DTO 검증 및 변환
 * 런타임에 스키마 계약 위반 검출
 */
export function validateAndTransformSupabaseUser(
  rawUserData: unknown,
  context: string = 'Supabase User'
): SupabaseUserDTO {
  const validationResult = SupabaseUserDTOSchema.safeParse(rawUserData);

  if (!validationResult.success) {
    const error = new Error(
      `${context} 데이터 계약 위반: ${validationResult.error.message}`
    );
    console.error('❌ Supabase User DTO 검증 실패:', {
      context,
      errors: validationResult.error.issues,
      receivedData: rawUserData,
    });
    throw error;
  }

  return validationResult.data;
}

/**
 * Prisma User 도메인 모델 검증
 */
export function validatePrismaUser(
  userData: unknown,
  context: string = 'Prisma User'
): PrismaUserDomain {
  const validationResult = PrismaUserDomainSchema.safeParse(userData);

  if (!validationResult.success) {
    const error = new Error(
      `${context} 도메인 모델 계약 위반: ${validationResult.error.message}`
    );
    console.error('❌ Prisma User 도메인 검증 실패:', {
      context,
      errors: validationResult.error.issues,
      receivedData: userData,
    });
    throw error;
  }

  return validationResult.data;
}

/**
 * 안전한 사용자 DTO 변환 (Supabase -> Prisma)
 * 데이터 계약 준수 및 에러 처리 내장
 */
export function safeTransformUserToPrisma(
  supabaseUserData: unknown,
  context: string = 'User Sync'
): Omit<PrismaUserDomain, 'passwordHash' | 'updatedAt'> | null {
  try {
    // 1. Supabase DTO 검증
    const validatedSupabaseUser = validateAndTransformSupabaseUser(supabaseUserData, context);

    // 2. Prisma 도메인 모델로 변환
    const prismaUserData = transformSupabaseUserToPrisma(validatedSupabaseUser);

    logger.info('✅ 사용자 DTO 변환 성공:', {
      context,
      userId: validatedSupabaseUser.id,
      email: validatedSupabaseUser.email,
    });

    return prismaUserData;

  } catch (error) {
    console.error(`❌ 사용자 DTO 변환 실패 (${context}):`, {
      error: error instanceof Error ? error.message : String(error),
      inputData: supabaseUserData,
    });

    return null; // graceful degradation
  }
}

/**
 * 데이터 품질 검증 유틸리티
 * 사용자 데이터의 완정성 및 일관성 검사
 */
export function validateUserDataQuality(userData: {
  id?: string;
  email?: string;
  username?: string;
}): {
  isValid: boolean;
  issues: string[];
  score: number; // 0-100 점수
} {
  const issues: string[] = [];
  let score = 100;

  // 필수 필드 검증
  if (!userData.id || !userData.id.trim()) {
    issues.push('ID가 누락되었습니다');
    score -= 40;
  }

  if (!userData.email || !userData.email.trim()) {
    issues.push('이메일이 누락되었습니다');
    score -= 30;
  }

  if (!userData.username || !userData.username.trim()) {
    issues.push('사용자명이 누락되었습니다');
    score -= 20;
  }

  // 형식 검증
  if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    issues.push('이메일 형식이 올바르지 않습니다');
    score -= 15;
  }

  if (userData.username && !/^[a-zA-Z0-9_-]{3,30}$/.test(userData.username)) {
    issues.push('사용자명 형식이 올바르지 않습니다 (3-30자, 영문/숫자/_/- 만 허용)');
    score -= 10;
  }

  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

// ============================================================================
// Zod 기반 새로운 변환 함수들 (v2.0)
// ============================================================================

/**
 * 안전한 스토리 생성 응답 변환
 * Zod 스키마 검증과 기존 호환성을 모두 보장
 */
export function transformStoryGenerationResponse(
  apiResponse: unknown,
  context: string = 'Story Generation API'
): StoryStep[] {
  try {
    // 1단계: Zod 스키마 검증
    const validationResult = validateEndpointResponse(
      'generateStory',
      apiResponse,
      context
    );

    if (validationResult.success) {
      const validatedData = validationResult.data.data;

      // 검증된 데이터를 레거시 StoryStep 형식으로 변환
      return validatedData.steps.map((step: ZodStoryStep, index: number) => ({
        id: step.id,
        title: step.title,
        summary: step.description.length > 100
          ? step.description.substring(0, 100) + '...'
          : step.description,
        content: step.description,
        goal: step.visualNotes || '',
        lengthHint: `전체의 ${Math.round(100 / validatedData.steps.length)}%`,
        isEditing: false,
      }));
    } else {
      console.warn(`⚠️ ${context} Zod 검증 실패, 레거시 변환으로 fallback:`,
        validationResult.error?.message);

      // Fallback: 기존 변환 함수 사용
      return transformApiResponseToStorySteps(apiResponse, context);
    }

  } catch (error) {
    console.error(`❌ ${context} 변환 중 예외:`, error);

    // Graceful degradation: 기본 템플릿 반환
    return createFallbackStorySteps(`${context} exception fallback`);
  }
}

/**
 * 안전한 프로젝트 데이터 변환
 */
export function transformProjectResponse(
  apiResponse: unknown,
  context: string = 'Project API'
): Project | null {
  try {
    const validationResult = validateEndpointResponse(
      'getProject',
      apiResponse,
      context
    );

    if (validationResult.success) {
      return validationResult.data.data;
    } else {
      console.error(`❌ ${context} 프로젝트 데이터 검증 실패:`,
        validationResult.error?.message);
      return null;
    }

  } catch (error) {
    console.error(`❌ ${context} 프로젝트 변환 중 예외:`, error);
    return null;
  }
}

/**
 * 안전한 샷 데이터 변환
 */
export function transformShotsResponse(
  apiResponse: unknown,
  context: string = 'Shots API'
): Shot[] {
  try {
    const validationResult = validateEndpointResponse(
      'generateShots',
      apiResponse,
      context
    );

    if (validationResult.success) {
      return validationResult.data.data.shots;
    } else {
      console.error(`❌ ${context} 샷 데이터 검증 실패:`,
        validationResult.error?.message);
      return [];
    }

  } catch (error) {
    console.error(`❌ ${context} 샷 변환 중 예외:`, error);
    return [];
  }
}

/**
 * 안전한 스토리보드 데이터 변환
 */
export function transformStoryboardResponse(
  apiResponse: unknown,
  context: string = 'Storyboard API'
): StoryboardShot[] {
  try {
    const validationResult = validateEndpointResponse(
      'generateStoryboard',
      apiResponse,
      context
    );

    if (validationResult.success) {
      return validationResult.data.data.storyboardShots;
    } else {
      console.error(`❌ ${context} 스토리보드 데이터 검증 실패:`,
        validationResult.error?.message);
      return [];
    }

  } catch (error) {
    console.error(`❌ ${context} 스토리보드 변환 중 예외:`, error);
    return [];
  }
}

/**
 * 타입 안전한 입력 데이터 검증 및 변환
 */
export function validateAndTransformStoryInput(
  storyInput: unknown,
  context: string = 'Story Input'
): ZodStoryInput | null {
  try {
    const validationResult = StoryInputSchema.safeParse(storyInput);

    if (validationResult.success) {
      return validationResult.data;
    } else {
      console.error(`❌ ${context} 입력 데이터 검증 실패:`,
        validationResult.error.issues);
      return null;
    }

  } catch (error) {
    console.error(`❌ ${context} 입력 검증 중 예외:`, error);
    return null;
  }
}

/**
 * 범용 API 응답 변환기 (타입 안전성 보장)
 */
export function transformApiResponseSafely<T>(
  apiResponse: unknown,
  endpointName: keyof typeof import('@/shared/api/schema-validation').RESPONSE_SCHEMA_REGISTRY,
  context?: string
): T | null {
  try {
    const validationResult = validateEndpointResponse(
      endpointName as any,
      apiResponse,
      context
    );

    if (validationResult.success) {
      return validationResult.data as T;
    } else {
      console.error(`❌ ${endpointName} 응답 변환 실패:`,
        validationResult.error?.message);
      return null;
    }

  } catch (error) {
    console.error(`❌ ${endpointName} 변환 중 예외:`, error);
    return null;
  }
}

/**
 * 데이터 품질 메트릭
 */
export interface DataQualityMetrics {
  validationSuccessRate: number;
  averageResponseTime: number;
  errorTypes: Record<string, number>;
  transformationStats: {
    total: number;
    successful: number;
    failed: number;
    fallbackUsed: number;
  };
}

/**
 * 데이터 품질 모니터링 (개발 환경)
 */
let dataQualityMetrics: DataQualityMetrics = {
  validationSuccessRate: 0,
  averageResponseTime: 0,
  errorTypes: {},
  transformationStats: {
    total: 0,
    successful: 0,
    failed: 0,
    fallbackUsed: 0,
  },
};

export function updateDataQualityMetrics(
  operation: 'success' | 'failed' | 'fallback',
  errorType?: string,
  responseTime?: number
) {
  if (process.env.NODE_ENV !== 'development') return;

  dataQualityMetrics.transformationStats.total++;
  dataQualityMetrics.transformationStats[operation]++;

  if (errorType) {
    dataQualityMetrics.errorTypes[errorType] =
      (dataQualityMetrics.errorTypes[errorType] || 0) + 1;
  }

  if (responseTime) {
    dataQualityMetrics.averageResponseTime =
      (dataQualityMetrics.averageResponseTime + responseTime) / 2;
  }

  dataQualityMetrics.validationSuccessRate =
    dataQualityMetrics.transformationStats.successful /
    dataQualityMetrics.transformationStats.total;
}

export function getDataQualityMetrics(): DataQualityMetrics {
  return { ...dataQualityMetrics };
}

export function resetDataQualityMetrics() {
  dataQualityMetrics = {
    validationSuccessRate: 0,
    averageResponseTime: 0,
    errorTypes: {},
    transformationStats: {
      total: 0,
      successful: 0,
      failed: 0,
      fallbackUsed: 0,
    },
  };
}
