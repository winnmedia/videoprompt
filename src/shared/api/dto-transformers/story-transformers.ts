/**
 * 스토리 관련 DTO 변환 계층
 * API 응답 ↔ 도메인 모델 간 안전한 데이터 변환
 * FSD shared 레이어 - Anti-Corruption Layer 역할
 */

import { StoryInput, StoryStep } from '@/entities/scenario';
import { CreateStoryRequestSchema, StorySchema } from '@/shared/schemas/story.schema';
import { z } from 'zod';

// API 요청/응답 타입 정의
export interface ApiStoryInput {
  title: string;
  oneLineStory: string;
  toneAndManner: string[];
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

export interface ApiStoryStep {
  id: string;
  title: string;
  summary: string;
  content: string;
  goal: string;
  lengthHint: string;
  order?: number;
}

export interface ApiStoryResponse {
  success: boolean;
  data?: {
    steps?: ApiStoryStep[];
    structure?: {
      act1?: { title: string; summary: string };
      act2?: { title: string; summary: string };
      act3?: { title: string; summary: string };
      act4?: { title: string; summary: string };
    };
  };
  message: string;
  timestamp?: string;
  requestId?: string;
}

// 런타임 검증 스키마
const ApiStoryStepSchema = z.object({
  id: z.string().uuid('유효하지 않은 ID 형식입니다'),
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목이 너무 깁니다'),
  summary: z.string().min(1, '요약은 필수입니다').max(500, '요약이 너무 깁니다'),
  content: z.string().min(1, '내용은 필수입니다'),
  goal: z.string().default(''),
  lengthHint: z.string().default(''),
  order: z.number().int().min(0).optional(),
});

const ApiStoryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    steps: z.array(ApiStoryStepSchema).optional(),
    structure: z.object({
      act1: z.object({ title: z.string(), summary: z.string() }).optional(),
      act2: z.object({ title: z.string(), summary: z.string() }).optional(),
      act3: z.object({ title: z.string(), summary: z.string() }).optional(),
      act4: z.object({ title: z.string(), summary: z.string() }).optional(),
    }).optional(),
  }).optional(),
  message: z.string(),
  timestamp: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * StoryInput → API 요청 변환
 */
export function transformStoryInputToApiRequest(storyInput: StoryInput): ApiStoryInput {
  try {
    // 입력 검증
    if (!storyInput.title?.trim()) {
      throw new Error('제목은 필수입니다');
    }

    if (!storyInput.oneLineStory?.trim()) {
      throw new Error('한 줄 스토리는 필수입니다');
    }

    if (!Array.isArray(storyInput.toneAndManner) || storyInput.toneAndManner.length === 0) {
      throw new Error('톤앤매너는 최소 하나 이상 선택해야 합니다');
    }

    // 안전한 변환
    return {
      title: storyInput.title.trim(),
      oneLineStory: storyInput.oneLineStory.trim(),
      toneAndManner: storyInput.toneAndManner.filter(tone => tone?.trim()).map(tone => tone.trim()),
      genre: storyInput.genre || 'Drama',
      target: storyInput.target || 'General',
      duration: storyInput.duration || '1분',
      format: storyInput.format || '16:9',
      tempo: storyInput.tempo || '보통',
      developmentMethod: storyInput.developmentMethod || '직선적',
      developmentIntensity: storyInput.developmentIntensity || '보통',
    };
  } catch (error) {
    throw new Error(`StoryInput 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 응답 → StoryStep[] 변환
 */
export function transformApiResponseToStorySteps(
  apiResponse: unknown,
  context: string = 'API Response'
): StoryStep[] {
  try {
    // 런타임 타입 검증
    const validatedResponse = ApiStoryResponseSchema.parse(apiResponse);

    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || 'API 요청이 실패했습니다');
    }

    if (!validatedResponse.data?.steps) {
      // 구조화된 응답인 경우 steps로 변환 시도
      if (validatedResponse.data?.structure) {
        return transformStructureToStorySteps(validatedResponse.data.structure);
      }
      throw new Error('API 응답에 스토리 단계 데이터가 없습니다');
    }

    // ApiStoryStep[] → StoryStep[] 변환
    const steps = validatedResponse.data.steps.map((apiStep, index): StoryStep => ({
      id: apiStep.id,
      title: apiStep.title,
      summary: apiStep.summary,
      content: apiStep.content,
      goal: apiStep.goal || `${index + 1}단계의 목표`,
      lengthHint: apiStep.lengthHint || calculateLengthHint(index, validatedResponse.data.steps.length),
      isEditing: false, // 클라이언트 상태
    }));

    // 최소 단계 수 검증
    if (steps.length === 0) {
      throw new Error('스토리 단계가 생성되지 않았습니다');
    }

    // 권장 단계 수 검증 (4단계)
    if (steps.length !== 4) {
      console.warn(`권장되는 4단계와 다른 ${steps.length}단계가 생성되었습니다`);
    }

    return steps;

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`${context} 데이터 검증 실패: ${errorDetails}`);
    }

    throw new Error(`${context} 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 구조화된 응답 → StoryStep[] 변환 (백워드 호환성)
 */
function transformStructureToStorySteps(structure: {
  act1?: { title: string; summary: string };
  act2?: { title: string; summary: string };
  act3?: { title: string; summary: string };
  act4?: { title: string; summary: string };
}): StoryStep[] {
  const acts = [structure.act1, structure.act2, structure.act3, structure.act4].filter(Boolean);

  if (acts.length === 0) {
    throw new Error('구조화된 데이터에서 유효한 막을 찾을 수 없습니다');
  }

  return acts.map((act, index): StoryStep => ({
    id: `step-${index + 1}-${Date.now()}`,
    title: act!.title,
    summary: act!.summary,
    content: act!.summary, // 초기 내용은 요약으로 설정
    goal: `${index + 1}막의 목표`,
    lengthHint: calculateLengthHint(index, acts.length),
    isEditing: false,
  }));
}

/**
 * 단계별 길이 힌트 계산
 */
function calculateLengthHint(stepIndex: number, totalSteps: number): string {
  if (totalSteps === 4) {
    // 4막 구조 기본 비율
    const ratios = ['25%', '25%', '25%', '25%'];
    return `전체 영상의 약 ${ratios[stepIndex]} (${stepIndex + 1}/4 단계)`;
  }

  const percentage = Math.round((1 / totalSteps) * 100);
  return `전체 영상의 약 ${percentage}% (${stepIndex + 1}/${totalSteps} 단계)`;
}

/**
 * StoryStep → API 저장 요청 변환
 */
export function transformStoryStepsToApiRequest(
  steps: StoryStep[],
  storyInput: StoryInput,
  projectId?: string
): {
  projectId?: string;
  storyInput: ApiStoryInput;
  steps: ApiStoryStep[];
} {
  try {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('저장할 스토리 단계가 없습니다');
    }

    // 단계별 검증 및 변환
    const apiSteps: ApiStoryStep[] = steps.map((step, index) => {
      if (!step.id?.trim()) {
        throw new Error(`${index + 1}번째 단계의 ID가 유효하지 않습니다`);
      }

      if (!step.title?.trim()) {
        throw new Error(`${index + 1}번째 단계의 제목이 필요합니다`);
      }

      return {
        id: step.id,
        title: step.title.trim(),
        summary: step.summary?.trim() || '',
        content: step.content?.trim() || '',
        goal: step.goal?.trim() || '',
        lengthHint: step.lengthHint?.trim() || '',
        order: index,
      };
    });

    return {
      projectId,
      storyInput: transformStoryInputToApiRequest(storyInput),
      steps: apiSteps,
    };

  } catch (error) {
    throw new Error(`스토리 저장 데이터 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 에러 응답 변환
 */
export function transformApiError(error: unknown, context: string = 'API 호출'): string {
  // 네트워크 오류
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return `${context} - 네트워크 연결 오류: 인터넷 연결을 확인해주세요`;
  }

  // HTTP 오류
  if (error instanceof Error) {
    if (error.message.includes('404')) {
      return `${context} - API 엔드포인트를 찾을 수 없습니다`;
    }

    if (error.message.includes('401')) {
      return `${context} - 인증이 필요합니다. 다시 로그인해주세요`;
    }

    if (error.message.includes('403')) {
      return `${context} - 접근 권한이 없습니다`;
    }

    if (error.message.includes('429')) {
      return `${context} - 요청이 너무 많습니다. 잠시 후 다시 시도해주세요`;
    }

    if (error.message.includes('500')) {
      return `${context} - 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요`;
    }

    return `${context} - ${error.message}`;
  }

  // 알 수 없는 오류
  return `${context} - 알 수 없는 오류가 발생했습니다`;
}

/**
 * 안전한 스토리 데이터 검증
 */
export function validateStoryData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    if (!data || typeof data !== 'object') {
      errors.push('유효하지 않은 데이터 형식입니다');
      return { isValid: false, errors };
    }

    // 타입 가드를 통한 안전한 검증
    const obj = data as Record<string, unknown>;

    // 기본 구조 검증
    if (!obj.success && !obj.data) {
      errors.push('API 응답 구조가 올바르지 않습니다');
    }

    // 데이터 구체적 검증
    if (obj.data && typeof obj.data === 'object') {
      const dataObj = obj.data as Record<string, unknown>;

      if (dataObj.steps && Array.isArray(dataObj.steps)) {
        dataObj.steps.forEach((step, index) => {
          if (!step || typeof step !== 'object') {
            errors.push(`${index + 1}번째 단계 데이터가 유효하지 않습니다`);
            return;
          }

          const stepObj = step as Record<string, unknown>;

          if (!stepObj.id || typeof stepObj.id !== 'string') {
            errors.push(`${index + 1}번째 단계의 ID가 유효하지 않습니다`);
          }

          if (!stepObj.title || typeof stepObj.title !== 'string') {
            errors.push(`${index + 1}번째 단계의 제목이 유효하지 않습니다`);
          }
        });
      }
    }

    return { isValid: errors.length === 0, errors };

  } catch (error) {
    errors.push(`데이터 검증 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    return { isValid: false, errors };
  }
}

/**
 * 스토리 데이터 정규화 (일관성 보장)
 */
export function normalizeStorySteps(steps: StoryStep[]): StoryStep[] {
  return steps.map((step, index) => ({
    ...step,
    title: step.title?.trim() || `${index + 1}단계`,
    summary: step.summary?.trim() || '',
    content: step.content?.trim() || '',
    goal: step.goal?.trim() || `${index + 1}단계의 목표`,
    lengthHint: step.lengthHint?.trim() || calculateLengthHint(index, steps.length),
    isEditing: false, // 정규화 시 편집 모드 해제
  }));
}